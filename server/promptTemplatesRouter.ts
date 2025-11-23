import { Router } from "express";
import { promptTemplates } from "../shared/promptTemplates";

export function createPromptTemplatesRouter() {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(promptTemplates);
  });

  router.get("/:id", (req, res) => {
    const template = promptTemplates.find(t => t.id === req.params.id);
    if (!template) return res.status(404).json({ error: "Not found" });
    res.json(template);
  });

  return router;
}
