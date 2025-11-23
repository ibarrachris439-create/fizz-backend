import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertConversationSchema,
  insertMessageSchema,
  insertCustomPersonaSchema,
  type Message,
} from "@shared/schema";
import { getPersonaSystemPrompt, personas } from "@shared/personas";
import { z } from "zod";
import Stripe from "stripe";

// Type helpers for expanded Stripe objects
type ExpandedInvoice = Stripe.Invoice & {
  payment_intent?: Stripe.PaymentIntent | string;
};

type ExpandedSubscription = Stripe.Subscription & {
  latest_invoice?: ExpandedInvoice | string;
};

// Schema for client message requests (no role field - server adds it)
const clientMessageSchema = z.object({
  conversationId: z.string(),
  content: z.string(),
  imageUrl: z.string().optional(),
});
import OpenAI from "openai";
import { getUncachableStripeClient } from "./stripeClient";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

const MESSAGE_LIMIT = 15;

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Auth route to get current user (no middleware - handles both authenticated and unauthenticated)
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.claims?.sub) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user memory
  app.put("/api/user/memory", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { memory } = req.body;
      
      if (!Array.isArray(memory)) {
        return res.status(400).json({ error: "Memory must be an array of strings" });
      }
      
      // Validate and sanitize memory items
      const MAX_MEMORY_ITEMS = 50;
      const MAX_ITEM_LENGTH = 500;
      
      if (memory.length > MAX_MEMORY_ITEMS) {
        return res.status(400).json({ error: `Memory cannot exceed ${MAX_MEMORY_ITEMS} items` });
      }
      
      const sanitizedMemory: string[] = [];
      for (const item of memory) {
        if (typeof item !== "string") {
          return res.status(400).json({ error: "All memory items must be strings" });
        }
        
        const trimmed = item.trim();
        if (trimmed.length === 0) {
          continue; // Skip empty strings
        }
        
        if (trimmed.length > MAX_ITEM_LENGTH) {
          return res.status(400).json({ 
            error: `Each memory item must be ${MAX_ITEM_LENGTH} characters or less` 
          });
        }
        
        sanitizedMemory.push(trimmed);
      }
      
      const user = await storage.updateUserMemory(userId, sanitizedMemory);
      res.json(user);
    } catch (error) {
      console.error("Error updating user memory:", error);
      res.status(500).json({ error: "Failed to update user memory" });
    }
  });

  // Update user preferences
  app.put("/api/user/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { preferences } = req.body;
      
      if (typeof preferences !== "object" || preferences === null || Array.isArray(preferences)) {
        return res.status(400).json({ error: "Preferences must be a plain object" });
      }
      
      // Sanitize preferences to prevent prototype pollution
      const sanitizedPreferences: Record<string, any> = {};
      const ALLOWED_KEYS = ["defaultPersona", "theme", "notifications", "language"];
      const MAX_PREFERENCE_VALUE_LENGTH = 1000;
      
      for (const key of Object.keys(preferences)) {
        // Prevent prototype pollution
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
          continue;
        }
        
        // Only allow known preference keys
        if (!ALLOWED_KEYS.includes(key)) {
          continue;
        }
        
        const value = preferences[key];
        
        // Only allow simple types (string, number, boolean)
        if (typeof value === "string") {
          if (value.length > MAX_PREFERENCE_VALUE_LENGTH) {
            return res.status(400).json({ 
              error: `Preference values must be ${MAX_PREFERENCE_VALUE_LENGTH} characters or less` 
            });
          }
          sanitizedPreferences[key] = value;
        } else if (typeof value === "number" || typeof value === "boolean") {
          sanitizedPreferences[key] = value;
        }
        // Skip objects, arrays, functions, etc.
      }
      
      const user = await storage.updateUserPreferences(userId, sanitizedPreferences);
      res.json(user);
    } catch (error) {
      console.error("Error updating user preferences:", error);
      res.status(500).json({ error: "Failed to update user preferences" });
    }
  });

  // Get message count for unauthenticated users
  app.get("/api/message-count", async (req: any, res) => {
    try {
      // Authenticated users have unlimited messages
      if (req.isAuthenticated() && req.user?.claims?.sub) {
        return res.json({ count: 0, limit: MESSAGE_LIMIT, unlimited: true });
      }
      
      // For unauthenticated users, get count from session
      const count = req.session.unauthMessageCount || 0;
      res.json({ count, limit: MESSAGE_LIMIT, unlimited: false });
    } catch (error) {
      console.error("Error fetching message count:", error);
      res.status(500).json({ error: "Failed to fetch message count" });
    }
  });

  // Get all conversations (supports both authenticated and unauthenticated users)
  app.get("/api/conversations", async (req: any, res) => {
    try {
      // For unauthenticated users, return empty array (they only have one active conversation)
      if (!req.isAuthenticated() || !req.user?.claims?.sub) {
        return res.json([]);
      }
      const userId = req.user.claims.sub;
      const conversations = await storage.getConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Create a new conversation (supports both authenticated and unauthenticated users)
  app.post("/api/conversations", async (req: any, res) => {
    try {
      const userId = req.isAuthenticated() && req.user?.claims?.sub ? req.user.claims.sub : null;
      const validatedData = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(validatedData, userId);
      res.json(conversation);
    } catch (error) {
      console.error("Conversation creation error:", error);
      res.status(400).json({ error: "Invalid conversation data" });
    }
  });

  // Delete a conversation (authenticated users only)
  app.delete("/api/conversations/:id", async (req: any, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.claims?.sub) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      // Verify conversation exists and belongs to user
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      if (conversation.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.deleteConversation(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // Get messages for a conversation (supports both authenticated and unauthenticated users)
  app.get("/api/messages/:conversationId", async (req: any, res) => {
    try {
      const { conversationId } = req.params;
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      // For authenticated users, verify ownership
      if (req.isAuthenticated() && req.user?.claims?.sub) {
        const userId = req.user.claims.sub;
        if (conversation.userId && conversation.userId !== userId) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      const messages = await storage.getMessages(conversationId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Polling-based chat endpoint (fallback for restricted networks that block SSE)
  app.post("/api/messages/poll", async (req: any, res) => {
    // Validate request
    let validatedData;
    try {
      validatedData = clientMessageSchema.parse(req.body);
      
      // Validate image URL format if present
      if (validatedData.imageUrl) {
        const isDataUri = validatedData.imageUrl.startsWith('data:image/');
        const isHttpUrl = validatedData.imageUrl.startsWith('http://') || validatedData.imageUrl.startsWith('https://');
        
        if (!isDataUri && !isHttpUrl) {
          return res.status(400).json({ 
            error: "Invalid image format",
            message: "Image must be a data URI or valid URL" 
          });
        }
        
        // Basic validation for data URI
        if (isDataUri && validatedData.imageUrl.length < 100) {
          return res.status(400).json({ 
            error: "Invalid image data",
            message: "Image data appears to be corrupted or too small" 
          });
        }
      }
    } catch (error: any) {
      console.error("Validation error:", error);
      return res.status(400).json({ 
        error: "Invalid request data",
        details: error.issues || error.message 
      });
    }
    
    // Check message limit for unauthenticated users
    if (!req.isAuthenticated() || !req.user?.claims?.sub) {
      const currentCount = req.session.unauthMessageCount || 0;
      if (currentCount >= MESSAGE_LIMIT) {
        return res.status(429).json({ 
          error: "Message limit reached",
          message: `You've reached the limit of ${MESSAGE_LIMIT} free messages. Please sign up to continue.`,
          limit: MESSAGE_LIMIT,
          count: currentCount
        });
      }
      req.session.unauthMessageCount = currentCount + 1;
    }
    
    // Verify conversation exists and user has access
    const conversation = await storage.getConversation(validatedData.conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    
    // For authenticated users, verify ownership
    if (req.isAuthenticated() && req.user?.claims?.sub) {
      const userId = req.user.claims.sub;
      if (conversation.userId && conversation.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    
    try {
      // Save user message
      const userMessage = await storage.createMessage({
        conversationId: validatedData.conversationId,
        role: "user",
        content: validatedData.content,
        imageUrl: validatedData.imageUrl,
      });

      // Get conversation history
      const conversationMessages = await storage.getMessages(validatedData.conversationId);

      // Prepare messages for OpenAI
      const conversationHistoryMessages = conversationMessages
        .slice(-20)
        .map((msg) => {
          if (msg.imageUrl && msg.role === "user") {
            return {
              role: "user" as const,
              content: [
                { type: "text" as const, text: msg.content },
                { 
                  type: "image_url" as const, 
                  image_url: { 
                    url: msg.imageUrl,
                    detail: "high" // High detail for homework problems - better OCR and equation recognition
                  } 
                }
              ]
            };
          } else {
            return {
              role: msg.role as "user" | "assistant",
              content: msg.content,
            };
          }
        });

      // Get system prompt
      let systemPrompt: string;
      if (conversation.persona && conversation.persona.startsWith("custom-")) {
        const personaId = conversation.persona.substring(7);
        const userId = req.isAuthenticated() ? req.user.claims.sub : null;
        if (!userId) {
          return res.status(401).json({ error: "Authentication required for custom personas" });
        }
        const customPersona = await storage.getCustomPersona(personaId, userId);
        systemPrompt = customPersona ? customPersona.systemPrompt : getPersonaSystemPrompt("general");
      } else {
        systemPrompt = getPersonaSystemPrompt(conversation.persona || "general");
      }

      // Add user memory to system prompt if authenticated and has memory
      if (req.isAuthenticated() && req.user?.claims?.sub) {
        const user = await storage.getUser(req.user.claims.sub);
        if (user && user.memory && Array.isArray(user.memory) && user.memory.length > 0) {
          const memoryContext = `\n\nIMPORTANT - User Context (remember these facts about the user):\n${user.memory.map(fact => `- ${fact}`).join('\n')}`;
          systemPrompt += memoryContext;
        }
      }
      
      // If user sent an image, enhance prompt for homework problem solving
      if (validatedData.imageUrl) {
        const homeworkGuidance = `\n\nIMAGE ANALYSIS INSTRUCTIONS:
- Carefully examine all text, equations, diagrams, and mathematical notation in the image
- For homework problems: Provide step-by-step solutions with clear explanations
- For math: Show all work, explain each step, and box/highlight the final answer
- For diagrams/graphs: Describe what you see and explain the concepts
- For handwritten work: Read carefully and help correct any errors
- Be thorough and educational - help the student understand the concept, not just get the answer`;
        systemPrompt += homeworkGuidance;
      }
      
      const openaiMessages: any[] = [
        { role: "system" as const, content: systemPrompt },
        ...conversationHistoryMessages
      ];

      // Debug logging for image messages (metadata only for security)
      if (validatedData.imageUrl) {
        console.log("Sending message with image to OpenAI - Image length:", validatedData.imageUrl.length);
      }

      // Get AI response (stream internally but buffer for client)
      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: openaiMessages,
        max_completion_tokens: 1000,
        temperature: 0.7,
        stream: true,
        stream_options: { include_usage: false },
      });

      let aiResponse = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          aiResponse += content;
        }
      }

      // Save AI response
      const aiMessage = await storage.createMessage({
        conversationId: validatedData.conversationId,
        role: "assistant",
        content: aiResponse || "I'm sorry, I couldn't generate a response.",
      });

      // Return complete response as JSON
      res.json({
        userMessage,
        aiMessage,
        content: aiResponse
      });
    } catch (error: any) {
      console.error("Runtime error processing message:", error);
      
      // Check if it's an OpenAI API error
      if (error.status === 400 || error.message?.includes('Invalid image') || error.message?.includes('image data')) {
        return res.status(400).json({ 
          error: "Invalid image data",
          message: "The image you provided could not be processed. Please try a different image." 
        });
      }
      
      res.status(500).json({ 
        error: error?.message || "Failed to process message" 
      });
    }
  });

  // Send a message and get AI response with streaming (supports both authenticated and unauthenticated users)
  app.post("/api/messages", async (req: any, res) => {
    // Validate request FIRST before setting SSE headers
    // This allows validation errors to return 4xx JSON responses
    let validatedData;
    try {
      validatedData = clientMessageSchema.parse(req.body);
      
      // Validate image URL format if present
      if (validatedData.imageUrl) {
        const isDataUri = validatedData.imageUrl.startsWith('data:image/');
        const isHttpUrl = validatedData.imageUrl.startsWith('http://') || validatedData.imageUrl.startsWith('https://');
        
        if (!isDataUri && !isHttpUrl) {
          return res.status(400).json({ 
            error: "Invalid image format",
            message: "Image must be a data URI or valid URL" 
          });
        }
        
        // Basic validation for data URI
        if (isDataUri && validatedData.imageUrl.length < 100) {
          return res.status(400).json({ 
            error: "Invalid image data",
            message: "Image data appears to be corrupted or too small" 
          });
        }
      }
    } catch (error: any) {
      console.error("Validation error:", error);
      return res.status(400).json({ 
        error: "Invalid request data",
        details: error.issues || error.message 
      });
    }
    
    // Check message limit for unauthenticated users BEFORE processing
    if (!req.isAuthenticated() || !req.user?.claims?.sub) {
      const currentCount = req.session.unauthMessageCount || 0;
      if (currentCount >= MESSAGE_LIMIT) {
        return res.status(429).json({ 
          error: "Message limit reached",
          message: `You've reached the limit of ${MESSAGE_LIMIT} free messages. Please sign up to continue.`,
          limit: MESSAGE_LIMIT,
          count: currentCount
        });
      }
      // Increment message count in session
      req.session.unauthMessageCount = currentCount + 1;
    }
    
    // Verify conversation exists and user has access
    const conversation = await storage.getConversation(validatedData.conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    
    // For authenticated users, verify ownership
    if (req.isAuthenticated() && req.user?.claims?.sub) {
      const userId = req.user.claims.sub;
      if (conversation.userId && conversation.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    
    // Now set SSE headers for streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    
    try {
      // Optimize: Run all database operations in parallel to reduce latency
      const [userMessage, conversationMessages] = await Promise.all([
        // Save user message (including optional image)
        storage.createMessage({
          conversationId: validatedData.conversationId,
          role: "user",
          content: validatedData.content,
          imageUrl: validatedData.imageUrl,
        }),
        // Get conversation history for context
        storage.getMessages(validatedData.conversationId)
      ]);

      // Support vision by formatting messages with images properly
      const conversationHistoryMessages = conversationMessages
        .slice(-20)
        .map((msg) => {
          if (msg.imageUrl) {
            // Message with image - use content array format
            if (msg.role === "user") {
              return {
                role: "user" as const,
                content: [
                  { type: "text" as const, text: msg.content },
                  { 
                    type: "image_url" as const, 
                    image_url: { 
                      url: msg.imageUrl,
                      detail: "high" as const // High detail for homework problems - better OCR and equation recognition
                    }
                  }
                ]
              };
            } else {
              return {
                role: "assistant" as const,
                content: msg.content
              };
            }
          } else {
            // Text-only message
            if (msg.role === "user") {
              return {
                role: "user" as const,
                content: msg.content,
              };
            } else {
              return {
                role: "assistant" as const,
                content: msg.content,
              };
            }
          }
        });

      // Optimize: Load user data and custom persona in parallel
      const userId = req.isAuthenticated() ? req.user.claims.sub : null;
      const isCustomPersona = conversation.persona && conversation.persona.startsWith("custom-");
      
      const [customPersona, user] = await Promise.all([
        // Load custom persona if needed
        isCustomPersona && userId 
          ? storage.getCustomPersona(conversation.persona!.substring(7), userId)
          : Promise.resolve(null),
        // Load user data for memory
        userId ? storage.getUser(userId) : Promise.resolve(null)
      ]);

      // Use persona-specific system prompt (support custom personas)
      let systemPrompt: string;
      if (isCustomPersona) {
        if (!userId) {
          return res.status(401).json({ error: "Authentication required for custom personas" });
        }
        if (!customPersona) {
          // Fallback to general if custom persona not found
          systemPrompt = getPersonaSystemPrompt("general");
        } else {
          systemPrompt = customPersona.systemPrompt;
        }
      } else {
        // Default persona
        systemPrompt = getPersonaSystemPrompt(conversation.persona || "general");
      }

      // Add user memory to system prompt if authenticated and has memory
      if (user && user.memory && Array.isArray(user.memory) && user.memory.length > 0) {
        const memoryContext = `\n\nIMPORTANT - User Context (remember these facts about the user):\n${user.memory.map(fact => `- ${fact}`).join('\n')}`;
        systemPrompt += memoryContext;
      }
      
      // If user sent an image, enhance prompt for homework problem solving
      if (validatedData.imageUrl) {
        const homeworkGuidance = `\n\nIMAGE ANALYSIS INSTRUCTIONS:
- Carefully examine all text, equations, diagrams, and mathematical notation in the image
- For homework problems: Provide step-by-step solutions with clear explanations
- For math: Show all work, explain each step, and box/highlight the final answer
- For diagrams/graphs: Describe what you see and explain the concepts
- For handwritten work: Read carefully and help correct any errors
- Be thorough and educational - help the student understand the concept, not just get the answer`;
        systemPrompt += homeworkGuidance;
      }
      
      const openaiMessages: any[] = [
        {
          role: "system" as const,
          content: systemPrompt
        },
        ...conversationHistoryMessages
      ];

      // Send user message first
      res.write(`data: ${JSON.stringify({ type: "userMessage", data: userMessage })}\n\n`);

      // Define image generation tool for function calling
      const tools = [{
        type: "function" as const,
        function: {
          name: "generate_image",
          description: "Generate an image based on a text description using DALL-E. Use this when the user explicitly asks to create, draw, generate, or visualize an image.",
          parameters: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description: "A detailed description of the image to generate. Be specific and descriptive."
              }
            },
            required: ["prompt"]
          }
        }
      }];

      // Get AI response using streaming with tools
      // Using GPT-4o-mini for faster responses
      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: openaiMessages,
        max_completion_tokens: 1000,
        temperature: 0.7,
        tools: tools,
        stream: true,
        stream_options: { include_usage: false },
      });

      let aiResponse = "";
      let generatedImageUrl: string | null = null;
      let toolCalls: any[] = [];

      // Stream tokens to client - each write is sent immediately
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        
        // Handle text content
        const content = delta?.content || "";
        if (content) {
          aiResponse += content;
          res.write(`data: ${JSON.stringify({ type: "token", data: content })}\n\n`);
        }

        // Handle tool calls
        if (delta?.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            const index = toolCall.index;
            if (!toolCalls[index]) {
              toolCalls[index] = {
                id: toolCall.id || "",
                type: "function",
                function: { name: toolCall.function?.name || "", arguments: "" }
              };
            }
            if (toolCall.function?.arguments) {
              toolCalls[index].function.arguments += toolCall.function.arguments;
            }
          }
        }
      }

      // Process any tool calls (image generation)
      if (toolCalls.length > 0) {
        // Build tool results for second completion
        const toolResults: any[] = [];

        for (const toolCall of toolCalls) {
          if (toolCall.function.name === "generate_image") {
            // Check if user has Plus or Pro subscription
            const userId = req.isAuthenticated() ? req.user.claims.sub : null;
            let userPlan = 'free';
            
            if (userId) {
              const user = await storage.getUser(userId);
              userPlan = user?.plan || 'free';
            }

            // Only allow image generation for Plus and Pro users
            if (userPlan !== 'plus' && userPlan !== 'pro') {
              // Send upgrade required event to client
              res.write(`data: ${JSON.stringify({ 
                type: "upgrade_required", 
                data: { 
                  feature: "image_generation",
                  message: "Image generation is available for Plus and Pro subscribers only. Upgrade to unlock this feature!"
                } 
              })}\n\n`);
              
              toolResults.push({
                tool_call_id: toolCall.id,
                role: "tool" as const,
                content: "Image generation is only available for Plus and Pro subscribers. Please upgrade to use this feature."
              });
              continue;
            }

            try {
              const args = JSON.parse(toolCall.function.arguments);
              const imagePrompt = args.prompt;

              // Generate the image
              const imageResponse = await openai.images.generate({
                model: "dall-e-3",
                prompt: imagePrompt,
                n: 1,
                size: "1024x1024",
                quality: "standard",
              });

              if (imageResponse.data && imageResponse.data[0]?.url) {
                generatedImageUrl = imageResponse.data[0].url;
                
                // Send image event to client
                res.write(`data: ${JSON.stringify({ 
                  type: "image", 
                  data: { imageUrl: generatedImageUrl, prompt: imagePrompt } 
                })}\n\n`);
                
                // Add tool result for follow-up completion
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: "tool" as const,
                  content: `Image generated successfully: ${generatedImageUrl}`
                });
              }
            } catch (error) {
              console.error("Error generating image:", error);
              toolResults.push({
                tool_call_id: toolCall.id,
                role: "tool" as const,
                content: "Failed to generate image"
              });
            }
          }
        }

        // Complete the function calling loop with tool results
        if (toolResults.length > 0) {
          // Add assistant message with tool calls
          const messagesWithTools = [
            ...openaiMessages,
            { role: "assistant" as const, content: aiResponse || null, tool_calls: toolCalls },
            ...toolResults
          ];

          // Get final response from AI after seeing tool results
          const finalStream = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messagesWithTools,
            max_completion_tokens: 2000,
            temperature: 0.7,
            stream: true,
            stream_options: { include_usage: false },
          });

          // Stream final response
          for await (const chunk of finalStream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              aiResponse += content;
              res.write(`data: ${JSON.stringify({ type: "token", data: content })}\n\n`);
            }
          }
        }
      }

      // Save complete AI response (with image URL if generated)
      const aiMessage = await storage.createMessage({
        conversationId: validatedData.conversationId,
        role: "assistant",
        content: aiResponse || "I'm sorry, I couldn't generate a response.",
        imageUrl: generatedImageUrl,
      });

      // Generate context-aware follow-up suggestions
      try {
        const suggestionPrompt = `Based on this conversation, suggest 3 brief follow-up questions the user might ask next. Return ONLY a JSON array of strings, no other text:

User: ${validatedData.content}
Assistant: ${aiResponse.substring(0, 300)}...

Format: ["question 1", "question 2", "question 3"]`;

        const suggestionResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: suggestionPrompt }],
          max_completion_tokens: 200,
          temperature: 0.8,
        });

        const suggestionsText = suggestionResponse.choices[0]?.message?.content || "[]";
        let suggestions: string[] = [];
        try {
          suggestions = JSON.parse(suggestionsText);
          if (!Array.isArray(suggestions)) suggestions = [];
          suggestions = suggestions.slice(0, 3).filter(s => s && s.trim());
        } catch {
          suggestions = [];
        }

        // Send suggestions if we got any
        if (suggestions.length > 0) {
          res.write(`data: ${JSON.stringify({ type: "suggestions", data: suggestions })}\n\n`);
        }
      } catch (error) {
        console.error("Error generating suggestions:", error);
        // Don't fail the request if suggestions fail
      }

      // Send completion event
      res.write(`data: ${JSON.stringify({ type: "complete", data: aiMessage })}\n\n`);
      res.end();
    } catch (error: any) {
      // Errors here are runtime errors (OpenAI API, storage, etc.) not validation
      console.error("Runtime error processing message:", error);
      let errorMessage = error?.message || "Failed to process message";
      
      // Check if it's an OpenAI API error related to images
      if (error.status === 400 || errorMessage?.includes('Invalid image') || errorMessage?.includes('image data')) {
        errorMessage = "The image you provided could not be processed. Please try a different image.";
      }
      
      console.error("Error details:", { message: errorMessage, stack: error?.stack });
      
      // Send SSE error event (headers already set)
      res.write(`data: ${JSON.stringify({ type: "error", data: { error: errorMessage } })}\n\n`);
      res.end();
    }
  });

  // Image Generation Route
  app.post("/api/generate-image", async (req: any, res) => {
    try {
      // Check if user has Plus or Pro subscription
      const userId = req.isAuthenticated() ? req.user.claims.sub : null;
      let userPlan = 'free';
      
      if (userId) {
        const user = await storage.getUser(userId);
        userPlan = user?.plan || 'free';
      }

      // Only allow image generation for Plus and Pro users
      if (userPlan !== 'plus' && userPlan !== 'pro') {
        return res.status(403).json({ 
          error: "Image generation is only available for Plus and Pro subscribers. Upgrade to unlock this feature!" 
        });
      }

      const { prompt } = req.body;
      
      if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      // Generate image using DALL-E 3
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt.trim(),
        n: 1,
        size: "1024x1024",
        quality: "standard",
      });

      if (!response.data || !response.data[0]?.url) {
        throw new Error("No image URL returned from API");
      }

      const imageUrl = response.data[0].url;

      res.json({ imageUrl });
    } catch (error: any) {
      console.error("Error generating image:", error);
      res.status(500).json({ 
        error: error?.message || "Failed to generate image" 
      });
    }
  });

  // Message Operations Routes

  // Edit a message and regenerate AI response
  app.patch("/api/messages/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      
      if (!content || !content.trim()) {
        return res.status(400).json({ error: "Content is required" });
      }

      const message = await storage.getMessage(id);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      if (message.role !== "user") {
        return res.status(400).json({ error: "Can only edit user messages" });
      }

      const conversation = await storage.getConversation(message.conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      if (conversation.userId) {
        if (!req.user || conversation.userId !== req.user.claims.sub) {
          return res.status(403).json({ error: "Unauthorized to edit this message" });
        }
      }

      await storage.updateMessage(id, { content: content.trim() });
      await storage.deleteMessagesAfter(id, message.conversationId);

      res.json({ success: true, messageId: id });
    } catch (error) {
      console.error("Error editing message:", error);
      res.status(500).json({ error: "Failed to edit message" });
    }
  });

  // Pin or unpin a message
  app.patch("/api/messages/:id/pin", async (req: any, res) => {
    try {
      const { id } = req.params;
      const { isPinned } = req.body;

      const message = await storage.getMessage(id);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      const conversation = await storage.getConversation(message.conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      if (conversation.userId) {
        if (!req.user || conversation.userId !== req.user.claims.sub) {
          return res.status(403).json({ error: "Unauthorized to pin this message" });
        }
      }

      const updatedMessage = await storage.pinMessage(id, isPinned);
      res.json(updatedMessage);
    } catch (error) {
      console.error("Error pinning message:", error);
      res.status(500).json({ error: "Failed to pin message" });
    }
  });

  // Add or remove a reaction to a message
  app.post("/api/messages/:id/reaction", async (req: any, res) => {
    try {
      const { id } = req.params;
      const { emoji } = req.body;
      const userId = req.user?.claims?.sub || "anonymous";

      if (!emoji) {
        return res.status(400).json({ error: "Emoji is required" });
      }

      const message = await storage.getMessage(id);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      const conversation = await storage.getConversation(message.conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      if (conversation.userId) {
        if (!req.user || conversation.userId !== req.user.claims.sub) {
          return res.status(403).json({ error: "Unauthorized to react to this message" });
        }
      }

      const updatedMessage = await storage.addReaction(id, { emoji, userId });
      res.json(updatedMessage);
    } catch (error) {
      console.error("Error adding reaction:", error);
      res.status(500).json({ error: "Failed to add reaction" });
    }
  });

  // Delete a message
  app.delete("/api/messages/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteMessage(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  // Search messages across all conversations
  app.get("/api/search", async (req: any, res) => {
    try {
      const { q } = req.query;
      const userId = req.user?.claims?.sub;

      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: "Search query is required" });
      }

      const searchQuery = q.toLowerCase().trim();
      
      // Get conversations for authenticated user only
      // Unauthenticated users don't have persistent conversations to search
      const conversations = userId 
        ? await storage.getConversations(userId)
        : [];

      // Search through all messages in all conversations
      const results: Array<{
        conversationId: string;
        conversationTitle: string;
        message: Message;
      }> = [];

      for (const conv of conversations) {
        const messages = await storage.getMessages(conv.id);
        const matchingMessages = messages.filter((msg: Message) =>
          msg.content.toLowerCase().includes(searchQuery)
        );

        for (const msg of matchingMessages) {
          results.push({
            conversationId: conv.id,
            conversationTitle: conv.title,
            message: msg,
          });
        }
      }

      // Sort by most recent first
      results.sort((a, b) => 
        new Date(b.message.createdAt).getTime() - new Date(a.message.createdAt).getTime()
      );

      res.json({ results, totalResults: results.length });
    } catch (error) {
      console.error("Error searching messages:", error);
      res.status(500).json({ error: "Failed to search messages" });
    }
  });

  // Custom Personas Routes (authenticated users only)
  
  // Get all custom personas for user
  app.get("/api/personas", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const personas = await storage.getCustomPersonas(userId);
      res.json(personas);
    } catch (error) {
      console.error("Error fetching custom personas:", error);
      res.status(500).json({ error: "Failed to fetch custom personas" });
    }
  });

  // Create a new custom persona (Plus/Pro only)
  app.post("/api/personas", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Verify user has Plus or Pro plan
      const user = await storage.getUser(userId);
      if (!user || user.plan === 'free') {
        return res.status(403).json({ 
          error: "Upgrade required", 
          message: "Custom personas are available on Plus and Pro plans only." 
        });
      }
      
      const validatedData = insertCustomPersonaSchema.parse(req.body);
      const persona = await storage.createCustomPersona(validatedData, userId);
      res.status(201).json(persona);
    } catch (error) {
      console.error("Error creating custom persona:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid persona data", 
          details: error.errors 
        });
      }
      res.status(500).json({ error: "Failed to create custom persona" });
    }
  });

  // Update a custom persona
  app.patch("/api/personas/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      // Use partial but maintain validation rules when fields are provided
      const updates = insertCustomPersonaSchema.partial().parse(req.body);
      
      // Ensure we don't allow empty updates
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No update data provided" });
      }
      
      const persona = await storage.updateCustomPersona(id, userId, updates);
      if (!persona) {
        return res.status(404).json({ error: "Persona not found" });
      }
      res.json(persona);
    } catch (error) {
      console.error("Error updating custom persona:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid persona data", 
          details: error.errors 
        });
      }
      res.status(500).json({ error: "Failed to update custom persona" });
    }
  });

  // Delete a custom persona
  app.delete("/api/personas/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      await storage.deleteCustomPersona(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting custom persona:", error);
      res.status(500).json({ error: "Failed to delete custom persona" });
    }
  });

  // Stripe subscription endpoint - using Replit's Stripe integration blueprint
  app.post("/api/create-subscription", isAuthenticated, async (req: any, res) => {
    // Hoist userId outside try/catch so it's accessible in error recovery
    const userId = req.user.claims.sub;
    
    try {
      const stripe = await getUncachableStripeClient();

      let user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { plan } = req.body;
      
      // Validate plan input
      if (!plan || !['Plus', 'Pro'].includes(plan)) {
        return res.status(400).json({ error: "Invalid plan. Must be 'Plus' or 'Pro'." });
      }
      
      // If user already has a subscription, check its status
      if (user.stripeSubscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
            expand: ['latest_invoice.payment_intent'],
          });
          
          // If subscription is already active or trialing, user is already subscribed
          if (subscription.status === 'active' || subscription.status === 'trialing') {
            return res.status(400).json({ 
              error: "You already have an active subscription. Please manage your subscription from your profile." 
            });
          }
          
          // If subscription exists but requires payment, return the payment intent
          if (subscription.status === 'incomplete' || subscription.status === 'past_due') {
            const expandedSub = subscription as ExpandedSubscription;
            const latestInvoice = expandedSub.latest_invoice;
            
            if (latestInvoice && typeof latestInvoice !== 'string') {
              const paymentIntent = latestInvoice.payment_intent;
              
              if (paymentIntent && typeof paymentIntent !== 'string') {
                // Only return client secret if payment intent requires action
                if (paymentIntent.status === 'requires_payment_method' || paymentIntent.status === 'requires_action') {
                  return res.json({
                    subscriptionId: subscription.id,
                    clientSecret: paymentIntent.client_secret,
                  });
                }
              }
            }
          }
        } catch (err) {
          // If subscription not found, continue to create new one
          console.log("Existing subscription not found, creating new one");
        }
      }

      // Create new customer and subscription
      if (!user.email) {
        return res.status(400).json({ error: "User email is required for subscription" });
      }

      // Create or retrieve Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email,
          metadata: {
            userId: userId,
          },
        });
        customerId = customer.id;
      }

      // Use actual Stripe price IDs instead of inline pricing
      const priceId = plan === 'Plus' 
        ? 'price_1SV35cCdxLCQQWG4YDdnrGbd'  // Fizz Plus - $4.99/month
        : 'price_1SV35fCdxLCQQWG4r3fGHIUh'; // Fizz Pro - $14.99/month

      // Create subscription with proper settings for payment collection
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { 
          save_default_payment_method: 'on_subscription',
          payment_method_types: ['card'],
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId: userId,
          plan: plan,
        },
      });

      // Update user with Stripe IDs
      await storage.updateUserStripeInfo(userId, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
      });

      const expandedSub = subscription as ExpandedSubscription;
      const latestInvoice = expandedSub.latest_invoice;
      if (!latestInvoice || typeof latestInvoice === 'string') {
        throw new Error("Failed to create invoice");
      }
      
      const paymentIntent = latestInvoice.payment_intent;
      if (!paymentIntent || typeof paymentIntent === 'string' || !paymentIntent.client_secret) {
        throw new Error("Failed to create payment intent");
      }

      res.json({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error: any) {
      console.error("Stripe subscription error:", error);
      
      // If Stripe error occurred during subscription creation, the subscription may still exist in incomplete state
      // Try to retrieve it and return the payment intent for retry
      if (error.type === 'StripeCardError' || error.type === 'StripeInvalidRequestError') {
        try {
          // Get the user again to check if subscription was created
          const userAfterError = await storage.getUser(userId);
          
          if (userAfterError?.stripeSubscriptionId) {
            const stripeRetry = await getUncachableStripeClient();
            const subscription = await stripeRetry.subscriptions.retrieve(
              userAfterError.stripeSubscriptionId,
              { expand: ['latest_invoice.payment_intent'] }
            ) as ExpandedSubscription;
            
            const latestInvoice = subscription.latest_invoice;
            const paymentIntent = (latestInvoice && typeof latestInvoice !== 'string') 
              ? latestInvoice.payment_intent 
              : null;
            
            if (paymentIntent && typeof paymentIntent !== 'string' && 
                (paymentIntent.status === 'requires_payment_method' || 
                 paymentIntent.status === 'requires_action')) {
              return res.status(400).json({
                error: error.message,
                clientSecret: paymentIntent.client_secret,
                subscriptionId: subscription.id,
                retryable: true,
              });
            }
          }
        } catch (retryError) {
          console.error("Failed to retrieve subscription for retry:", retryError);
        }
      }
      
      // For other errors or if retry not possible, return without client secret
      res.status(500).json({ 
        error: error.message || "Failed to create subscription" 
      });
    }
  });

  // Create Checkout Session for subscription purchase
  app.post("/api/create-checkout-session", isAuthenticated, async (req: any, res) => {
    try {
      const stripe = await getUncachableStripeClient();

      const userId = req.user.claims.sub;
      const { plan } = req.body;

      if (!['Plus', 'Pro'].includes(plan)) {
        return res.status(400).json({ error: "Invalid plan selected" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.email) {
        return res.status(400).json({ error: "User email is required for subscription" });
      }

      // Check if user already has active subscription
      if (user.stripeSubscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
          if (subscription.status === 'active' || subscription.status === 'trialing') {
            return res.status(400).json({
              error: "You already have an active subscription. Please manage it from your profile."
            });
          }
        } catch (err) {
          console.log("Existing subscription not found, creating new checkout session");
        }
      }

      // Create or retrieve Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email,
          metadata: { userId },
        });
        customerId = customer.id;
        await storage.updateUserStripeInfo(userId, { stripeCustomerId: customerId });
      }

      // Stripe price IDs from Stripe Dashboard (LIVE MODE)
      const priceId = plan === 'Plus' 
        ? 'price_1SVOt04ZvMd9Y1Q0O3BtIgtG'  // Fizz Plus - $4.99/month (LIVE)
        : 'price_1SVOsz4ZvMd9Y1Q0TGT9Vcaa'; // Fizz Pro - $14.99/month (LIVE)

      // Build base URL from environment
      const baseUrl = process.env.REPLIT_DEPLOYMENT === '1' && process.env.REPLIT_DOMAINS
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'http://localhost:5000';

      // Create Checkout Session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: `${baseUrl}/chat?success=true`,
        cancel_url: `${baseUrl}/#pricing`,
        subscription_data: {
          metadata: {
            userId,
            plan,
          },
        },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Checkout session error:", error);
      res.status(500).json({ 
        error: error.message || "Failed to create checkout session" 
      });
    }
  });

  // Create Customer Portal Session for subscription management
  app.post("/api/create-portal-session", isAuthenticated, async (req: any, res) => {
    try {
      const stripe = await getUncachableStripeClient();

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.stripeCustomerId) {
        return res.status(400).json({ error: "No customer found. Please subscribe first." });
      }

      // Build base URL from environment
      const baseUrl = process.env.REPLIT_DEPLOYMENT === '1' && process.env.REPLIT_DOMAINS
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'http://localhost:5000';

      // Create portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${baseUrl}/profile`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Portal session error:", error);
      res.status(500).json({ 
        error: error.message || "Failed to create portal session" 
      });
    }
  });

  // Get subscription status
  app.get("/api/subscription-status", isAuthenticated, async (req: any, res) => {
    try {
      const stripe = await getUncachableStripeClient();

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // If no subscription ID, user is on free plan
      if (!user.stripeSubscriptionId) {
        return res.json({
          plan: user.plan || 'free',
          status: 'none',
          hasActiveSubscription: false,
        });
      }

      // Fetch subscription from Stripe
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId) as any;

      // Security: Verify subscription belongs to this user's customer
      if (subscription.customer !== user.stripeCustomerId) {
        console.error(`Security violation: User ${userId} attempted to access subscription ${user.stripeSubscriptionId} belonging to customer ${subscription.customer}`);
        return res.status(403).json({ error: "Unauthorized access to subscription" });
      }

      res.json({
        plan: user.plan || 'free',
        status: subscription.status,
        hasActiveSubscription: subscription.status === 'active' || subscription.status === 'trialing',
        currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
      });
    } catch (error: any) {
      console.error("Subscription status error:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch subscription status" 
      });
    }
  });

  // Webhook to handle Stripe events (for subscription status updates)
  // Note: This endpoint expects raw body for signature verification
  app.post("/api/stripe/webhook", async (req, res) => {
    try {
      const stripe = await getUncachableStripeClient();
      // Get the signature from headers
      const sig = req.headers['stripe-signature'];
      
      if (!sig) {
        console.error("Missing stripe-signature header");
        return res.status(400).send("Missing signature");
      }

      // Verify webhook signature - CRITICAL for security
      // Note: In production, you'll need to set STRIPE_WEBHOOK_SECRET environment variable
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      let event: Stripe.Event;
      
      if (webhookSecret) {
        // Verify the signature using the raw body
        try {
          // Use rawBody for signature verification (set by express.json verify function)
          const rawBody = (req as any).rawBody;
          if (!rawBody) {
            throw new Error("Raw body not available for signature verification");
          }
          
          event = stripe.webhooks.constructEvent(
            rawBody,
            sig,
            webhookSecret
          );
        } catch (err: any) {
          console.error("Webhook signature verification failed:", err.message);
          return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
        }
      } else {
        // In development without webhook secret, parse the body directly
        // WARNING: This is NOT secure and should only be used in development
        console.warn("STRIPE_WEBHOOK_SECRET not set - webhook verification disabled (development only)");
        event = req.body as Stripe.Event;
      }

      // Handle the verified event
      switch (event.type) {
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          const subscription = event.data.object as Stripe.Subscription;
          
          // Update user plan based on subscription status
          if (subscription.metadata?.userId) {
            const newPlan = subscription.status === 'active' 
              ? (subscription.items.data[0].price.unit_amount === 499 ? 'plus' : 'pro')
              : 'free';
            
            await storage.updateUserPlan(subscription.metadata.userId, newPlan);
            console.log(`Updated user ${subscription.metadata.userId} plan to ${newPlan}`);
          }
          break;
        
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  });

  // Debug endpoint to test Stripe API connection and specific price IDs
  app.get("/api/debug/stripe-products", async (req, res) => {
    try {
      const stripe = await getUncachableStripeClient();
      
      console.log("===== STRIPE DEBUG START =====");
      
      // Test retrieving specific price IDs directly
      const testPriceIds = [
        'price_1SVOap4ZvMd9Y1Q0QvuL48Fe', // Fizz Plus
        'price_1SVOaz4ZvMd9Y1Q07ONU4ytg'  // Fizz Pro
      ];
      
      const priceTests = [];
      for (const priceId of testPriceIds) {
        try {
          const price = await stripe.prices.retrieve(priceId);
          console.log(`✓ Price ${priceId} exists:`, {
            id: price.id,
            product: price.product,
            amount: price.unit_amount,
            currency: price.currency,
            active: price.active
          });
          priceTests.push({ priceId, status: 'found', price });
        } catch (err: any) {
          console.log(`✗ Price ${priceId} NOT found:`, err.message);
          priceTests.push({ priceId, status: 'not_found', error: err.message });
        }
      }
      
      // Try to fetch ALL products (not just active)
      const allProducts = await stripe.products.list({ limit: 100 });
      console.log("Total products (all statuses):", allProducts.data.length);
      
      // Fetch ALL prices
      const allPrices = await stripe.prices.list({ limit: 100 });
      console.log("Total prices (all statuses):", allPrices.data.length);
      
      console.log("===== STRIPE DEBUG END =====");
      
      res.json({
        priceTests,
        totalProductsCount: allProducts.data.length,
        totalPricesCount: allPrices.data.length,
        allProducts: allProducts.data.map(p => ({
          id: p.id,
          name: p.name,
          active: p.active,
        })),
        allPrices: allPrices.data.map(p => ({
          id: p.id,
          product: p.product,
          unit_amount: p.unit_amount,
          currency: p.currency,
          active: p.active,
        })),
      });
    } catch (error: any) {
      console.error("Stripe products debug error:", error);
      res.status(500).json({ 
        error: error.message,
        type: error.type,
        code: error.code 
      });
    }
  });

  // AI Debate endpoint - streams alternating messages from two personas in real-time
  app.post("/api/debate", async (req: any, res) => {
    try {
      const { conversationId, topic, persona1, persona2 } = req.body;
      
      if (!conversationId || !topic || !persona1 || !persona2) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      if (persona1 === persona2) {
        return res.status(400).json({ error: "Personas must be different" });
      }

      // Verify conversation exists
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Set SSE headers for streaming
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Access-Control-Allow-Origin", "*");

      const persona1Name = personas.find(p => p.id === persona1)?.name || "Persona 1";
      const persona2Name = personas.find(p => p.id === persona2)?.name || "Persona 2";

      // Generate 3 rounds of debate (6 messages total) - streamed in real-time
      const rounds = 3;
      let conversationHistory: any[] = [];

      for (let round = 0; round < rounds; round++) {
        // Persona 1's turn - stream response
        const persona1Prompt = `You are ${persona1Name} in a debate. Topic: "${topic}". ${round === 0 ? 'Present your opening argument.' : round === 1 ? 'Respond to the previous argument and strengthen your position.' : 'Make your final closing statement.'} Keep it concise (2-3 paragraphs).`;
        
        let persona1Text = "";
        res.write(`data: ${JSON.stringify({ type: "speaker", data: persona1Name })}\n\n`);
        
        const persona1Stream = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: getPersonaSystemPrompt(persona1) },
            ...conversationHistory,
            { role: "user", content: persona1Prompt }
          ],
          max_completion_tokens: 400,
          temperature: 0.8,
          stream: true,
          stream_options: { include_usage: false },
        });

        // Stream persona 1's response token by token
        for await (const chunk of persona1Stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            persona1Text += content;
            res.write(`data: ${JSON.stringify({ type: "token", speaker: persona1, data: content })}\n\n`);
          }
        }
        
        // Save persona 1 message
        await storage.createMessage({
          conversationId,
          role: "assistant",
          content: `**${persona1Name}**: ${persona1Text}`,
        });

        conversationHistory.push({ role: "assistant", content: persona1Text });

        // Persona 2's turn - stream response
        const persona2Prompt = `You are ${persona2Name} in a debate. Topic: "${topic}". ${round === 0 ? 'Present your opening argument with a different perspective.' : round === 1 ? 'Counter the previous argument and defend your position.' : 'Make your final rebuttal and closing statement.'} Keep it concise (2-3 paragraphs).`;
        
        let persona2Text = "";
        res.write(`data: ${JSON.stringify({ type: "speaker", data: persona2Name })}\n\n`);
        
        const persona2Stream = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: getPersonaSystemPrompt(persona2) },
            ...conversationHistory,
            { role: "user", content: persona2Prompt }
          ],
          max_completion_tokens: 400,
          temperature: 0.8,
          stream: true,
          stream_options: { include_usage: false },
        });

        // Stream persona 2's response token by token
        for await (const chunk of persona2Stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            persona2Text += content;
            res.write(`data: ${JSON.stringify({ type: "token", speaker: persona2, data: content })}\n\n`);
          }
        }
        
        // Save persona 2 message
        await storage.createMessage({
          conversationId,
          role: "assistant",
          content: `**${persona2Name}**: ${persona2Text}`,
        });

        conversationHistory.push({ role: "assistant", content: persona2Text });
      }

      res.write(`data: ${JSON.stringify({ type: "complete", data: { success: true, rounds } })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error("Error generating debate:", error);
      res.write(`data: ${JSON.stringify({ type: "error", data: { error: "Failed to generate debate" } })}\n\n`);
      res.end();
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
