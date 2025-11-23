import { Router } from "express";
import * as schema from "../shared/schema";

export function createSchemaRouter() {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(schema);
  });

  return router;
}
