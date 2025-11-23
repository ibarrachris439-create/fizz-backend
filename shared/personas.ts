import { Router } from "express";
import { personas } from "./personas"; // your existing data file

export function createPersonasRouter() {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(personas);
  });

  router.get("/:id", (req, res) => {
    const found = personas.find(p => p.id === req.params.id);
    if (!found) return res.status(404).json({ error: "Persona not found" });
    res.json(found);
  });

  return router;
}
