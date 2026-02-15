import { readFileSync } from "fs";
import { createHash } from "crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

interface MigrationEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface MigrationJournal {
  version: string;
  dialect: string;
  entries: MigrationEntry[];
}

function computeMigrationHash(sqlContent: string): string {
  return createHash("sha256").update(sqlContent).digest("hex");
}

async function bootstrapDatabase() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database bootstrap");
  }

  console.log("🔄 Starting database bootstrap...");

  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  try {
    // Step 1: Read migration journal
    console.log("📖 Reading migration journal...");
    const journalPath = "./migrations/meta/_journal.json";
    const journal: MigrationJournal = JSON.parse(readFileSync(journalPath, "utf-8"));
    console.log(`✅ Found ${journal.entries.length} migration(s) in journal`);

    // Step 2: Ensure drizzle schema and migrations table exist
    console.log("🔧 Ensuring drizzle schema exists...");
    await client`CREATE SCHEMA IF NOT EXISTS drizzle`;
    
    await client`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `;
    console.log("✅ Drizzle metadata tables ready");

    // Step 3: Get currently tracked migrations
    console.log("🔍 Checking migration tracking...");
    const appliedMigrations = await client`
      SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at
    `;
    const appliedHashes = new Set(appliedMigrations.map((m: any) => m.hash));
    console.log(`📊 Found ${appliedHashes.size} tracked migration(s) out of ${journal.entries.length} in journal`);

    // Step 4: Reconciliation - backfill all missing migrations if main table exists
    console.log("🔧 Checking for migrations to reconcile...");
    const now = Date.now();
    let reconciledCount = 0;
    
    // Check if reconciliation is needed (some migrations missing from tracking)
    if (appliedHashes.size < journal.entries.length) {
      // Check if main table exists (indicates migrations were applied but not tracked)
      let mainTableExists = false;
      try {
        await client`SELECT 1 FROM users LIMIT 1`;
        mainTableExists = true;
        console.log("⚠️  Main table exists but some migrations not tracked - reconciling...");
      } catch {
        console.log("✅ Fresh database - no reconciliation needed");
      }
      
      if (mainTableExists) {
        // Backfill all missing migration hashes in a transaction
        await client.begin(async (tx) => {
          for (let i = 0; i < journal.entries.length; i++) {
            const entry = journal.entries[i];
            const sqlPath = `./migrations/${entry.tag}.sql`;
            
            try {
              const sqlContent = readFileSync(sqlPath, "utf-8");
              const hash = computeMigrationHash(sqlContent);
              
              // Check if this migration hash is already tracked
              if (appliedHashes.has(hash)) {
                continue; // Already tracked, skip
              }
              
              // Backfill the migration record
              await tx`
                INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
                VALUES (${hash}, ${now + i})
              `;
              console.log(`  ✅ Reconciled migration: ${entry.tag}`);
              reconciledCount++;
            } catch (err) {
              console.error(`  ❌ Could not reconcile ${entry.tag}:`, err);
              throw err; // Rollback transaction on error
            }
          }
        });
        
        console.log(`✅ Reconciled ${reconciledCount} migration(s)!`);
      }
    } else {
      console.log("✅ All migrations properly tracked");
    }

    // Step 5: Run the Drizzle migrator
    console.log("📋 Running Drizzle migrator...");
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("✅ Migrations completed successfully!");

    await client.end();

    // Step 6: Ensure platform_settings table exists
    console.log("⚙️ Ensuring platform_settings table exists...");
    const settingsClient = postgres(DATABASE_URL);
    try {
      await settingsClient`
        CREATE TABLE IF NOT EXISTS platform_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;
      await settingsClient`
        INSERT INTO platform_settings (key, value)
        VALUES ('emali_enabled', 'true')
        ON CONFLICT (key) DO NOTHING
      `;
      console.log("✅ Platform settings table ready");
    } catch (e) {
      console.error("⚠️ Platform settings setup error:", e);
    }
    await settingsClient.end();

    // Step 7: Ensure primary admin exists
    console.log("👤 Ensuring primary admin exists...");
    const seedClient = postgres(DATABASE_URL);
    const seedDb = drizzle(seedClient);

    try {
      const primaryAdmin = await seedDb.select()
        .from(users)
        .where(eq(users.email, "kpetekoussojuste1@gmail.com"))
        .limit(1);

      if (primaryAdmin.length === 0) {
        console.log("➕ Creating primary admin account...");
        
        const hashedPassword = await bcrypt.hash("19992025", 10);
        
        await seedDb.insert(users).values({
          firstName: "Admin",
          lastName: "Principal",
          email: "kpetekoussojuste1@gmail.com",
          password: hashedPassword,
          balance: 0,
          kycStatus: "verified",
          isAdmin: true,
          isPrimaryAdmin: true,
          suspended: false,
        });
        
        console.log("✅ Primary admin created successfully!");
      } else {
        console.log("✅ Primary admin already exists");
        
        const admin = primaryAdmin[0];
        if (!admin.isPrimaryAdmin || !admin.isAdmin) {
          console.log("🔧 Updating primary admin flags...");
          await seedDb.update(users)
            .set({
              isAdmin: true,
              isPrimaryAdmin: true,
              suspended: false,
            })
            .where(eq(users.email, "kpetekoussojuste1@gmail.com"));
          console.log("✅ Primary admin flags updated!");
        }
      }

      await seedClient.end();
      console.log("✅ Database bootstrap completed successfully!");
    } catch (seedError) {
      console.error("❌ Admin seeding failed:", seedError);
      await seedClient.end();
      throw seedError;
    }
  } catch (error) {
    console.error("❌ Database bootstrap failed:", error);
    await client.end();
    throw error;
  }
}

export { bootstrapDatabase };
