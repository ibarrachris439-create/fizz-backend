import type { Express, Request, Response } from "express";

// ⭐ IMPORTANT: Use .js extension for ESM/TypeScript on Railway
import { createPersonasRouter } from "../shared/personas.js";
import { createSchemaRouter } from "../shared/schema.js";
import { createPromptTemplatesRouter } from "../shared/promptTemplates.js";

export async function registerRoutes(app: Express) {
  // Health endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // Personas routes
  app.use("/api/personas", createPersonasRouter());

  // Database schema routes
  app.use("/api/schema", createSchemaRouter());

  // Prompt templates routes
  app.use("/api/prompts", createPromptTemplatesRouter());

  // Return server instance
  const server = app.listen(0);
  return server;
}
