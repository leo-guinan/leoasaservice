import { defineConfig } from "drizzle-kit";
import { getDrizzleConfig } from "./shared/postgres";

const config = getDrizzleConfig();

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: config.url,
    ssl: config.ssl,
  },
  verbose: true,
  strict: true,
});
