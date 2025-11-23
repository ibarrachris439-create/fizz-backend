import { pgTable, text, varchar, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email"),
  createdAt: timestamp("created_at").defaultNow()
});

export const personas = pgTable("personas", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  name: text("name"),
  systemPrompt: text("system_prompt"),
  createdAt: timestamp("created_at").defaultNow()
});

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull()
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);
