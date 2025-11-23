import {
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type User,
  type UpsertUser,
  type CustomPersona,
  type InsertCustomPersona,
  conversations,
  messages,
  users,
  customPersonas,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, desc, asc, and } from "drizzle-orm";
import { randomUUID } from "crypto";

const sqlClient = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlClient);

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, stripeInfo: { stripeCustomerId?: string; stripeSubscriptionId?: string | null }): Promise<User>;
  updateUserPlan(userId: string, plan: string): Promise<User>;
  updateUserMemory(userId: string, memory: string[]): Promise<User>;
  updateUserPreferences(userId: string, preferences: Record<string, any>): Promise<User>;
  
  // Conversations
  getConversations(userId: string): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation, userId: string | null): Promise<Conversation>;
  updateConversationTitle(id: string, title: string): Promise<void>;
  deleteConversation(id: string, userId: string): Promise<void>;
  
  // Messages
  getMessages(conversationId: string): Promise<Message[]>;
  getMessage(id: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: string, updates: Partial<Message>): Promise<Message>;
  deleteMessage(id: string): Promise<void>;
  deleteMessagesAfter(messageId: string, conversationId: string): Promise<void>;
  pinMessage(id: string, isPinned: boolean): Promise<Message>;
  addReaction(messageId: string, reaction: { emoji: string; userId: string }): Promise<Message>;
  
  // Custom Personas
  getCustomPersonas(userId: string): Promise<CustomPersona[]>;
  getCustomPersona(id: string, userId: string): Promise<CustomPersona | undefined>;
  createCustomPersona(persona: InsertCustomPersona, userId: string): Promise<CustomPersona>;
  updateCustomPersona(id: string, userId: string, persona: Partial<InsertCustomPersona>): Promise<CustomPersona>;
  deleteCustomPersona(id: string, userId: string): Promise<void>;
  
  // Stripe (queries from stripe.* schema)
  getProduct(productId: string): Promise<any>;
  listProducts(active?: boolean, limit?: number, offset?: number): Promise<any[]>;
  getPrice(priceId: string): Promise<any>;
  listPrices(active?: boolean, limit?: number, offset?: number): Promise<any[]>;
  getSubscription(subscriptionId: string): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserStripeInfo(userId: string, stripeInfo: { stripeCustomerId?: string; stripeSubscriptionId?: string | null }): Promise<User> {
    const updates: any = { updatedAt: new Date() };
    if (stripeInfo.stripeCustomerId !== undefined) {
      updates.stripeCustomerId = stripeInfo.stripeCustomerId;
    }
    if (stripeInfo.stripeSubscriptionId !== undefined) {
      updates.stripeSubscriptionId = stripeInfo.stripeSubscriptionId;
    }
    
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserPlan(userId: string, plan: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        plan,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserMemory(userId: string, memory: string[]): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        memory,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserPreferences(userId: string, preferences: Record<string, any>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        preferences,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Conversations
  async getConversations(userId: string): Promise<Conversation[]> {
    return await db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.createdAt));
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const result = await db.select().from(conversations).where(eq(conversations.id, id));
    return result[0];
  }

  async createConversation(
    insertConversation: InsertConversation,
    userId: string | null
  ): Promise<Conversation> {
    const id = randomUUID();
    const result = await db.insert(conversations).values({
      ...insertConversation,
      id,
      userId,
    }).returning();
    return result[0];
  }

  async updateConversationTitle(id: string, title: string): Promise<void> {
    await db.update(conversations).set({ title }).where(eq(conversations.id, id));
  }

  async deleteConversation(id: string, userId: string): Promise<void> {
    await db.delete(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  }

  // Messages
  async getMessages(conversationId: string): Promise<Message[]> {
    return await db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));
  }

  async getMessage(id: string): Promise<Message | undefined> {
    const result = await db.select().from(messages).where(eq(messages.id, id));
    return result[0];
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const result = await db.insert(messages).values({
      ...insertMessage,
      id,
    }).returning();
    return result[0];
  }

  async updateMessage(id: string, updates: Partial<Message>): Promise<Message> {
    const [message] = await db.update(messages)
      .set({
        ...updates,
        editedAt: new Date(),
      })
      .where(eq(messages.id, id))
      .returning();
    return message;
  }

  async deleteMessage(id: string): Promise<void> {
    await db.delete(messages).where(eq(messages.id, id));
  }

  async deleteMessagesAfter(messageId: string, conversationId: string): Promise<void> {
    const message = await this.getMessage(messageId);
    if (!message) return;
    
    const allMessages = await this.getMessages(conversationId);
    const messageIndex = allMessages.findIndex(m => m.id === messageId);
    
    if (messageIndex === -1) return;
    
    const messagesToDelete = allMessages.slice(messageIndex + 1);
    
    for (const msg of messagesToDelete) {
      await this.deleteMessage(msg.id);
    }
  }

  async pinMessage(id: string, isPinned: boolean): Promise<Message> {
    const [message] = await db.update(messages)
      .set({
        isPinned: isPinned ? "true" : "false",
      })
      .where(eq(messages.id, id))
      .returning();
    return message;
  }

  async addReaction(messageId: string, reaction: { emoji: string; userId: string }): Promise<Message> {
    const message = await this.getMessage(messageId);
    if (!message) throw new Error("Message not found");
    
    let currentReactions: any[] = [];
    if (Array.isArray(message.reactions)) {
      currentReactions = message.reactions;
    } else if (typeof message.reactions === 'string') {
      try {
        const parsed = JSON.parse(message.reactions as string);
        currentReactions = Array.isArray(parsed) ? parsed : [];
      } catch {
        currentReactions = [];
      }
    }
    
    const existingIndex = currentReactions.findIndex(
      r => r && r.emoji === reaction.emoji && r.userId === reaction.userId
    );
    
    let newReactions;
    if (existingIndex >= 0) {
      newReactions = currentReactions.filter((_, i) => i !== existingIndex);
    } else {
      newReactions = [...currentReactions, reaction];
    }
    
    const [updatedMessage] = await db.update(messages)
      .set({ reactions: newReactions })
      .where(eq(messages.id, messageId))
      .returning();
    
    return updatedMessage;
  }

  // Custom Personas
  async getCustomPersonas(userId: string): Promise<CustomPersona[]> {
    return await db.select().from(customPersonas)
      .where(eq(customPersonas.userId, userId))
      .orderBy(desc(customPersonas.createdAt));
  }

  async getCustomPersona(id: string, userId: string): Promise<CustomPersona | undefined> {
    const [persona] = await db.select().from(customPersonas)
      .where(and(
        eq(customPersonas.id, id),
        eq(customPersonas.userId, userId)
      ));
    return persona;
  }

  async createCustomPersona(insertPersona: InsertCustomPersona, userId: string): Promise<CustomPersona> {
    const id = randomUUID();
    const [persona] = await db.insert(customPersonas).values({
      ...insertPersona,
      id,
      userId,
    }).returning();
    return persona;
  }

  async updateCustomPersona(id: string, userId: string, updates: Partial<InsertCustomPersona>): Promise<CustomPersona> {
    const [persona] = await db.update(customPersonas)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(
        eq(customPersonas.id, id),
        eq(customPersonas.userId, userId)
      ))
      .returning();
    return persona;
  }

  async deleteCustomPersona(id: string, userId: string): Promise<void> {
    await db.delete(customPersonas)
      .where(and(
        eq(customPersonas.id, id),
        eq(customPersonas.userId, userId)
      ));
  }

  // Stripe (queries from stripe.* schema created by stripe-replit-sync)
  async getProduct(productId: string): Promise<any> {
    const result = await sqlClient(
      `SELECT * FROM stripe.products WHERE id = $1`, [productId]
    );
    return result[0] || null;
  }

  async listProducts(active = true, limit = 20, offset = 0): Promise<any[]> {
    const result = await sqlClient(
      `SELECT * FROM stripe.products WHERE active = $1 ORDER BY created DESC LIMIT $2 OFFSET $3`,
      [active, limit, offset]
    );
    return result;
  }

  async getPrice(priceId: string): Promise<any> {
    const result = await sqlClient(
      `SELECT * FROM stripe.prices WHERE id = $1`, [priceId]
    );
    return result[0] || null;
  }

  async listPrices(active = true, limit = 20, offset = 0): Promise<any[]> {
    const result = await sqlClient(
      `SELECT * FROM stripe.prices WHERE active = $1 ORDER BY created DESC LIMIT $2 OFFSET $3`,
      [active, limit, offset]
    );
    return result;
  }

  async getSubscription(subscriptionId: string): Promise<any> {
    const result = await sqlClient(
      `SELECT * FROM stripe.subscriptions WHERE id = $1`, [subscriptionId]
    );
    return result[0] || null;
  }
}

export const storage = new DatabaseStorage();
