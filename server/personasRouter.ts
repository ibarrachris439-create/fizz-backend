import { Router } from "express";
import { personas } from "../shared/personas";

export function createPersonasRouter() {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(personas);
  });

  router.get("/:id", (req, res) => {
    const persona = personas.find(p => p.id === req.params.id);
    if (!persona) return res.status(404).json({ error: "Not found" });
    res.json(persona);
  });

  return router;
}
