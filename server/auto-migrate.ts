import { exec } from "child_process";
import { promisify } from "util";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

const execAsync = promisify(exec);

async function runAutoMigration() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set");
    return false;
  }

  console.log("🔄 Starting automatic database migration...");

  try {
    // Step 1: Push schema to database
    console.log("📤 Pushing schema to database...");
    try {
      await execAsync("npm run db:push");
      console.log("✅ Schema pushed successfully!");
    } catch (error: any) {
      // If there's a warning, try with --force
      if (error.message.includes("data loss")) {
        console.log("⚠️  Data loss warning detected, forcing push...");
        await execAsync("npm run db:push -- --force");
        console.log("✅ Schema forced successfully!");
      } else {
        throw error;
      }
    }

    // Step 2: Seed primary admin
    console.log("🌱 Seeding primary admin...");
    const client = postgres(DATABASE_URL);
    const db = drizzle(client);

    try {
      // Check if primary admin exists
      const primaryAdmin = await db.select()
        .from(users)
        .where(eq(users.email, "kpetekoussojuste1@gmail.com"))
        .limit(1);

      if (primaryAdmin.length === 0) {
        console.log("➕ Creating primary admin account...");
        
        // Hash the access code as password
        const hashedPassword = await bcrypt.hash("19992025", 10);
        
        await db.insert(users).values({
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
        
        // Ensure the primary admin has correct flags
        const admin = primaryAdmin[0];
        if (!admin.isPrimaryAdmin || !admin.isAdmin) {
          console.log("🔧 Updating primary admin flags...");
          await db.update(users)
            .set({
              isAdmin: true,
              isPrimaryAdmin: true,
              suspended: false,
            })
            .where(eq(users.email, "kpetekoussojuste1@gmail.com"));
          console.log("✅ Primary admin flags updated!");
        }
      }
    } finally {
      await client.end();
    }

    console.log("✅ Database migration completed successfully!");
    return true;
  } catch (error) {
    console.error("❌ Migration failed:", error);
    return false;
  }
}

export { runAutoMigration };
