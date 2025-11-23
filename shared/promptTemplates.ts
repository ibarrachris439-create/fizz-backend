import { Router } from "express";
import { conversations, messages } from "./schema"; // your drizzle tables

export function createSchemaRouter() {
  const router = Router();

  // Example test route
  router.get("/test", (_req, res) => {
    res.json({ status: "schema ok" });
  });

  return router;
}
