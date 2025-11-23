import { Router } from "express";
import { conversations, messages, users } from "../shared/schema";

export function createSchemaRouter() {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({
      conversations,
      messages,
      users
    });
  });

  return router;
}
