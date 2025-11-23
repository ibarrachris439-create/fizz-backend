import { Router } from "express";

export interface PersonaDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  systemPrompt: string;
}

export const personas: PersonaDefinition[] = [
  {
    id: "general",
    name: "Fizz",
    icon: "○",
    description: "Your versatile AI assistant for anything",
    systemPrompt: `You are Fizz...`
  },
  // your other personas...
];

// ⭐ Get persona by ID
export function getPersonaById(id: string): PersonaDefinition {
  const persona = personas.find((p) => p.id === id);
  return persona || personas[0];
}

// ⭐ Get the system prompt only
export function getPersonaSystemPrompt(id: string): string {
  return getPersonaById(id).systemPrompt;
}

// ⭐ FIX: Create Express router wrapper
export function createPersonasRouter() {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(personas);
  });

  router.get("/:id", (req, res) => {
    const persona = getPersonaById(req.params.id);
