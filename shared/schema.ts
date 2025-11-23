import { pgTable, text, varchar, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  plan: varchar("plan").notNull().default("free"),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  memory: jsonb("memory").default('[]'),
  preferences: jsonb("preferences").default('{}'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id), // Optional for now until auth is implemented
  title: text("title").notNull(),
  persona: varchar("persona").notNull().default("general"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey(),
  conversationId: varchar("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  isPinned: text("is_pinned").default("false"), // "true" or "false" as text
  reactions: jsonb("reactions").default('[]'), // Array of {emoji: string, userId: string}
  parentMessageId: varchar("parent_message_id"), // For conversation branching
  editedAt: timestamp("edited_at"), // Track when message was edited
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customPersonas = pgTable("custom_personas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").notNull(),
  icon: varchar("icon").notNull(),
  description: text("description").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  userId: true, // Server will add userId based on authentication
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertCustomPersonaSchema = createInsertSchema(customPersonas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true, // Server will add userId based on authentication
}).extend({
  name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name must be at most 50 characters"),
  icon: z.string().min(1, "Icon is required").max(2, "Icon must be 1-2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters").max(500, "Description must be at most 500 characters"),
  systemPrompt: z.string().min(50, "Personality definition must be at least 50 characters to ensure the AI can properly adapt to your specifications").max(5000, "Personality definition must be at most 5000 characters"),
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertCustomPersona = z.infer<typeof insertCustomPersonaSchema>;
export type CustomPersona = typeof customPersonas.$inferSelect;

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
