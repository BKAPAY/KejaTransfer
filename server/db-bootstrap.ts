import { readFileSync } from "fs";
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

async function bootstrapDatabase() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database bootstrap");
  }

  console.log("🔄 Starting database bootstrap...");

  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  try {
    // Step 1: Ensure drizzle schema exists
    console.log("🔧 Ensuring drizzle schema exists...");
    await client`CREATE SCHEMA IF NOT EXISTS drizzle`;
    console.log("✅ Drizzle schema ready");

    // Step 2: Run the Drizzle migrator
    // Migrator will automatically manage hashes in drizzle.__drizzle_migrations
    console.log("📋 Running Drizzle migrator...");
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("✅ Migrations completed successfully!");

    await client.end();

    // Step 6: Ensure primary admin exists
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
