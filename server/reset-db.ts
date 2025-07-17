import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import * as schema from "../shared/schema";

// Reset mode: 'delete' only deletes data, 'drop' drops all tables including drizzle migrations
type ResetMode = "delete" | "drop";

// Reset options
type ResetOptions = {
  dry?: boolean; // If true, only logs what would be done without actually making changes
};

/**
 * Resets the database based on the specified mode
 * @param mode 'delete' to only delete data, 'drop' to drop all tables including drizzle migrations
 * @param options Additional options including dry run mode
 */
export async function resetDatabase(mode: ResetMode = "delete", options: ResetOptions = {}): Promise<void> {
  const isDryRun = options.dry === true;
  const dryRunPrefix = isDryRun ? "[DRY RUN] Would" : "Will";

  console.warn(`${dryRunPrefix} start database reset in '${mode}' mode...`);

  try {
    const db = getDb();
    
    if (mode === "delete") {
      await deleteAllData(db, isDryRun);
      console.log(`${isDryRun ? "[DRY RUN] Would have deleted" : "Successfully deleted"} all data from tables`);
    }
    else if (mode === "drop") {
      await dropAllTables(db, isDryRun);
      console.log(`${isDryRun ? "[DRY RUN] Would have dropped" : "Successfully dropped"} all tables including drizzle migrations`);
    }
    else {
      throw new Error(`Invalid reset mode: ${mode}. Must be 'delete' or 'drop'.`);
    }

    console.log(`Database reset ${isDryRun ? "dry run" : "operation"} completed successfully`);
  }
  catch (error) {
    console.error("Error resetting database:", error);
    throw error;
  }
}

/**
 * Deletes all data from all tables without dropping the tables
 * @param db Database instance
 * @param isDryRun If true, only logs what would be done without actually making changes
 */
async function deleteAllData(db: any, isDryRun = false): Promise<void> {
  // Get all tables from the schema - only the actual table objects, not the schema objects
  const tables = [schema.users, schema.urls, schema.chatMessages, schema.leoQuestions];

  console.log(`Found ${tables.length} tables to clear data from`);

  // Process tables in reverse to handle dependencies
  // This approach tries to handle foreign key constraints by starting with tables that are referenced by others
  for (const table of tables) {
    try {
      const tableName = (table as any).name;
      console.log(`${isDryRun ? "[DRY RUN] Would delete" : "Deleting"} data from table: ${tableName}`);

      if (!isDryRun) {
        await db.delete(table);
      }
    }
    catch (error) {
      console.error(`Error with table ${(table as any).name}:`, error);
      // Continue with other tables even if one fails
    }
  }
}

/**
 * Drops all tables including the drizzle migrations table
 * @param db Database instance
 * @param isDryRun If true, only logs what would be done without actually making changes
 */
async function dropAllTables(db: any, isDryRun = false): Promise<void> {
  // First get a list of all tables in the public schema
  const publicResult = await db.execute(sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
  `);

  // Type safety for database results
  type QueryResult = Array<{ tablename: string }>;
  type TypeQueryResult = Array<{ typname: string }>;

  const publicTables = (publicResult as unknown as QueryResult).map(row => row.tablename);
  console.log(`Found ${publicTables.length} tables to drop in public schema: ${publicTables.join(", ")}`);

  // Also get tables in the drizzle schema
  const drizzleResult = await db.execute(sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'drizzle'
  `);

  const drizzleTables = (drizzleResult as unknown as QueryResult).map(row => row.tablename);
  console.log(`Found ${drizzleTables.length} tables to drop in drizzle schema: ${drizzleTables.join(", ") || "none"}`);

  // Get all custom types (ENUMs, etc.) in the public schema
  const typesResult = await db.execute(sql`
    SELECT typname FROM pg_type
    JOIN pg_namespace ON pg_type.typnamespace = pg_namespace.oid
    WHERE pg_namespace.nspname = 'public' AND pg_type.typtype = 'e'
  `);

  const customTypes = (typesResult as unknown as TypeQueryResult).map(row => row.typname);
  console.log(`Found ${customTypes.length} custom types to drop: ${customTypes.join(", ") || "none"}`);

  if (!isDryRun) {
    // Drop tables in public schema
    for (const table of publicTables) {
      try {
        // Use raw SQL with identifier escaping to avoid parameter type issues
        await db.execute(sql.raw(`DROP TABLE IF EXISTS "${table}" CASCADE;`));
        console.log(`Dropped table: ${table}`);
      }
      catch (error) {
        console.error(`Error dropping table ${table}:`, error);
      }
    }

    // Drop tables in drizzle schema
    for (const table of drizzleTables) {
      try {
        await db.execute(sql.raw(`DROP TABLE IF EXISTS drizzle."${table}" CASCADE;`));
        console.log(`Dropped drizzle schema table: ${table}`);
      }
      catch (error) {
        console.error(`Error dropping drizzle schema table ${table}:`, error);
      }
    }

    // Drop custom types (ENUMs, etc.)
    for (const typeName of customTypes) {
      try {
        await db.execute(sql.raw(`DROP TYPE IF EXISTS "${typeName}" CASCADE;`));
        console.log(`Dropped custom type: ${typeName}`);
      }
      catch (error) {
        console.error(`Error dropping custom type ${typeName}:`, error);
      }
    }

    // Make sure we try to drop the drizzle schema itself
    try {
      await db.execute(sql.raw(`DROP SCHEMA IF EXISTS drizzle CASCADE;`));
      console.log("Dropped drizzle schema");
    }
    catch (error) {
      console.error("Error dropping drizzle schema:", error);
    }
  }
  else {
    // Just log what would be dropped in dry run mode
    for (const table of publicTables) {
      console.log(`[DRY RUN] Would drop table: ${table}`);
    }

    // Log drizzle schema tables that would be dropped
    for (const table of drizzleTables) {
      console.log(`[DRY RUN] Would drop drizzle schema table: ${table}`);
    }

    // Log custom types that would be dropped
    for (const typeName of customTypes) {
      console.log(`[DRY RUN] Would drop custom type: ${typeName}`);
    }

    console.log("[DRY RUN] Would drop drizzle schema");
  }
}

/**
 * Show help text for command-line usage
 */
function showHelp(): void {
  console.log(`
Database Reset Script
-------------------
Usage: npm run db:reset [options]

Options:
  --delete       Delete all data from tables without dropping them (default)
  --drop         Drop all tables, custom types, and schemas
  --dry, --dry-run  Perform a dry run (show what would happen without making changes)
  --help, -h     Show this help text

Examples:
  npm run db:reset --delete          # Delete all data
  npm run db:reset --drop            # Drop all tables and types
  npm run db:reset --delete --dry    # Dry run for delete mode
  npm run db:reset --drop --dry-run  # Dry run for drop mode
`);
}

/**
 * Parse command line arguments when running the script directly
 */
function parseCommandLineArgs(): { mode: ResetMode; options: ResetOptions } | null {
  // Default values
  let mode: ResetMode = "delete";
  const options: ResetOptions = { dry: false };
  
  // Process command line arguments
  const args = process.argv.slice(2);
  
  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return null;
  }
  
  // Check for mode argument
  if (args.includes("--drop")) {
    mode = "drop";
  } else if (args.includes("--delete")) {
    mode = "delete";
  }
  
  // Check for dry run flag
  if (args.includes("--dry") || args.includes("--dry-run")) {
    options.dry = true;
  }
  
  return { mode, options };
}

// When running this file directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = parseCommandLineArgs();
  
  // Only proceed if we have valid arguments (not showing help)
  if (result) {
    const { mode, options } = result;
    console.log(`Running database reset with mode: ${mode}, dry run: ${options.dry ? "yes" : "no"}`);
    (async () => {
      await resetDatabase(mode, options);
      process.exit(0);
    })().catch((error) => {
      console.error("Failed to reset database:", error);
      process.exit(1);
    });
  }
} 