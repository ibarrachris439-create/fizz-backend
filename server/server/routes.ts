import type { Express, Request, Response } from 'express';
import { createPersonasRouter } from '../shared/personas';
import { createSchemaRouter } from '../shared/schema';
import { createPromptTemplatesRouter } from '../shared/promptTemplates';

export async function registerRoutes(app: Express) {

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // Personas
  app.use("/api/personas", createPersonasRouter());

  // Schema
  app.use("/api/schema", createSchemaRouter());

  // Prompt Templates
  app.use("/api/prompts", createPromptTemplatesRouter());

  const server = app.listen(0);
  return server;
}
