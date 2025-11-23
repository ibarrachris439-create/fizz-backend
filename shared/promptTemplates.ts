import { Router } from "express";
import { promptTemplates } from "./promptTemplates";

export function createPromptTemplatesRouter() {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(promptTemplates);
  });

  router.get("/:id", (req, res) => {
    const found = promptTemplates.find(t => t.id === req.params.id);
    if (!found) return res.status(404).json({ error: "Template not found" });
    res.json(found);
  });

  return router;
}
