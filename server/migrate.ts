import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

async function runMigration() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  console.log("🔄 Starting database migration...");
  
  const client = postgres(DATABASE_URL);
  const db = drizzle(client);

  try {
    // Check if primary admin exists
    console.log("👤 Checking for primary admin...");
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

    console.log("✅ Database migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await client.end();
  }
}

runMigration()
  .then(() => {
    console.log("🎉 Migration process finished!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Migration process failed:", error);
    process.exit(1);
  });
