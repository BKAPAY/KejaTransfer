import { createHash } from "crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { mkdirSync } from "fs";
import { join } from "path";

async function bootstrapDatabase() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database bootstrap");
  }

  console.log("🔄 Starting database bootstrap...");

  // Ensure upload directories exist - use /tmp on Vercel, ./uploads locally
  console.log("📁 Creating upload directories...");
  try {
    let uploadBase: string;
    
    // On Vercel, always use /tmp
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      uploadBase = "/tmp/bkapay-uploads";
    } else {
      // Locally, use project root + uploads
      uploadBase = join(process.cwd(), "uploads");
    }
    
    console.log(`📁 Using upload base: ${uploadBase}`);
    mkdirSync(uploadBase, { recursive: true });
    mkdirSync(join(uploadBase, "videos"), { recursive: true });
    mkdirSync(join(uploadBase, "images"), { recursive: true });
    console.log(`✅ Upload directories ready at ${uploadBase}`);
  } catch (e) {
    console.error("⚠️ Upload directories error:", e);
    // Continue anyway - uploads might fail but bootstrap shouldn't stop
  }

  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  try {
    // Step 1: Ensure drizzle schema and migrations table exist
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

    // Step 2: Ensure new columns exist BEFORE any Drizzle ORM query (schema reconciliation)
    try {
      await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_sector TEXT`;
      await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_sub_sector TEXT`;
      await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS sector_status TEXT NOT NULL DEFAULT 'approved'`;
      console.log("✅ users.kyc_sector/kyc_sub_sector/sector_status columns ensured (early)");
    } catch (e) {
      console.error("⚠️ Early kyc_sector/kyc_sub_sector column migration error:", e);
    }

    // Step 3: Restriction pays par secteur (multi_country_enabled)
    try {
      const mcCol = await client`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'multi_country_enabled'
      `;
      if (mcCol.length === 0) {
        await client`ALTER TABLE users ADD COLUMN multi_country_enabled BOOLEAN NOT NULL DEFAULT false`;
        await client`UPDATE users SET multi_country_enabled = true`;
        console.log("✅ users.multi_country_enabled column created (existing users set to true)");
      } else {
        console.log("✅ users.multi_country_enabled column already exists");
      }
    } catch (e) {
      console.error("⚠️ Early multi_country_enabled column migration error:", e);
    }

    // Skip Drizzle migrator entirely - we don't have the migrations folder on Vercel
    console.log("📋 Skipping file-based migrations (not available on Vercel)");
    console.log("✅ Schema will be created via direct SQL below");

    await client.end();

    // Step 4: Ensure platform_settings table exists
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

    // Step 5: Ensure login_logs table exists
    console.log("⚙️ Ensuring login_logs table exists...");
    const loginLogsClient = postgres(DATABASE_URL);
    try {
      await loginLogsClient`
        CREATE TABLE IF NOT EXISTS login_logs (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR NOT NULL REFERENCES users(id),
          ip_address TEXT,
          city TEXT,
          region TEXT,
          country TEXT,
          isp TEXT,
          device_type TEXT,
          device_model TEXT,
          browser TEXT,
          os TEXT,
          user_agent TEXT,
          photo_base64 TEXT,
          photo_back_base64 TEXT,
          gps_latitude TEXT,
          gps_longitude TEXT,
          gps_accuracy TEXT,
          gps_address TEXT,
          connection_type TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `;
      console.log("✅ Login logs table ready");
    } catch (e) {
      console.error("⚠️ Login logs setup error:", e);
    }
    await loginLogsClient.end();

    // Step 6: Ensure moneyfusion_ip_logs table exists
    console.log("⚙️ Ensuring moneyfusion_ip_logs table exists...");
    const ipLogsClient = postgres(DATABASE_URL);
    try {
      await ipLogsClient`
        CREATE TABLE IF NOT EXISTS moneyfusion_ip_logs (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          ip_address TEXT NOT NULL,
          error_message TEXT,
          country_code TEXT,
          operator_code TEXT,
          resolved BOOLEAN DEFAULT FALSE,
          provider TEXT DEFAULT 'moneyfusion',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      console.log("✅ MoneyFusion IP logs table ready");
    } catch (e) {
      console.error("⚠️ MoneyFusion IP logs setup error:", e);
    }
    await ipLogsClient.end();

    // Step 7: Ensure additional user columns
    const userColsClient = postgres(DATABASE_URL);
    try {
      await userColsClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_api_enabled BOOLEAN NOT NULL DEFAULT FALSE`;
      await userColsClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS wave_payin_enabled BOOLEAN NOT NULL DEFAULT FALSE`;
      await userColsClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS deposit_override_enabled BOOLEAN NOT NULL DEFAULT FALSE`;
      await userColsClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_phone TEXT`;
      await userColsClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_whatsapp TEXT`;
      await userColsClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_activity_url TEXT`;
      await userColsClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_url_website TEXT`;
      await userColsClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_url_instagram TEXT`;
      await userColsClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_url_facebook TEXT`;
      await userColsClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_url_tiktok TEXT`;
      await userColsClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_url_whatsapp_group TEXT`;
      await userColsClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_url_whatsapp_channel TEXT`;
      await userColsClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_document_type TEXT`;
      await userColsClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_document_number TEXT`;
      await userColsClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_document_expiry_date TEXT`;
      await userColsClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS momo_country TEXT`;
      await userColsClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS momo_operator TEXT`;
      await userColsClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS momo_phone TEXT`;
      await userColsClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_salary BOOLEAN NOT NULL DEFAULT false`;
      console.log("✅ User columns ready");
    } catch (e) {
      console.error("⚠️ User columns setup error:", e);
    }
    await userColsClient.end();

    // Step 8: Ensure api_keys columns
    const apiKeysClient = postgres(DATABASE_URL);
    try {
      await apiKeysClient`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS payout_callback_url TEXT`;
      await apiKeysClient`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS payout_callback_secret TEXT`;
      await apiKeysClient`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS payin_private_key TEXT UNIQUE`;
      console.log("✅ api_keys columns ready");
    } catch (e) {
      console.error("⚠️ api_keys setup error:", e);
    }
    await apiKeysClient.end();

    // Step 9: Ensure business_tokens table exists
    const btClient = postgres(DATABASE_URL);
    try {
      await btClient`
        CREATE TABLE IF NOT EXISTS business_tokens (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR NOT NULL REFERENCES users(id),
          token TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL DEFAULT 'Token API',
          callback_url TEXT,
          payout_callback_url TEXT,
          callback_secret TEXT,
          payout_callback_secret TEXT,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          allowed_countries TEXT[] DEFAULT '{}',
          customer_pays_fee BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `;
      console.log("✅ Business tokens table ready");
    } catch (e) {
      console.error("⚠️ Business tokens setup error:", e);
    }
    await btClient.end();

    // Step 10: Ensure settlements table
    const settlClient = postgres(DATABASE_URL);
    try {
      await settlClient`
        CREATE TABLE IF NOT EXISTS settlements (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          batch_id VARCHAR NOT NULL DEFAULT gen_random_uuid(),
          user_id VARCHAR NOT NULL REFERENCES users(id),
          wallet_country TEXT NOT NULL,
          wallet_currency TEXT NOT NULL,
          amount INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          bank_account_holder TEXT,
          bank_account_number TEXT,
          bank_name TEXT,
          bank_swift_bic TEXT,
          bank_branch_address TEXT,
          bank_branch_name TEXT,
          bank_branch_sort_code TEXT,
          bank_country TEXT,
          bank_currency TEXT,
          settlement_method TEXT DEFAULT 'bank',
          momo_country TEXT,
          momo_operator TEXT,
          momo_phone TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `;
      console.log("✅ Settlements table ready");
    } catch (e) {
      console.error("⚠️ Settlements setup error:", e);
    }
    await settlClient.end();

    // Step 11: Ensure salary tables
    const salaryClient = postgres(DATABASE_URL);
    try {
      await salaryClient`
        CREATE TABLE IF NOT EXISTS salary_accounts (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          balance REAL NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'XOF',
          is_active BOOLEAN NOT NULL DEFAULT true,
          label TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      await salaryClient`
        CREATE TABLE IF NOT EXISTS salary_schedules (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          amount REAL NOT NULL,
          schedule_type TEXT NOT NULL,
          schedule_value INTEGER NOT NULL,
          label TEXT,
          is_active BOOLEAN NOT NULL DEFAULT true,
          last_paid_at TIMESTAMP,
          next_pay_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `;
      await salaryClient`
        CREATE TABLE IF NOT EXISTS salary_transactions (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          amount REAL NOT NULL,
          currency TEXT NOT NULL DEFAULT 'XOF',
          status TEXT NOT NULL DEFAULT 'completed',
          description TEXT,
          country TEXT,
          operator TEXT,
          phone TEXT,
          internal_transaction_id TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      console.log("✅ Salary tables ready");
    } catch (e) {
      console.error("⚠️ Salary tables setup error:", e);
    }
    await salaryClient.end();

    // Step 12: Ensure shop tables
    const shopClient = postgres(DATABASE_URL);
    try {
      await shopClient`
        CREATE TABLE IF NOT EXISTS shops (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          description TEXT,
          logo_url TEXT,
          slideshow_urls TEXT[] DEFAULT '{}',
          currency TEXT NOT NULL DEFAULT 'XOF',
          custom_domain TEXT,
          font_family TEXT DEFAULT 'Poppins',
          primary_color TEXT DEFAULT '#6366f1',
          api_key_id VARCHAR REFERENCES api_keys(id),
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `;
      await shopClient`
        CREATE TABLE IF NOT EXISTS shop_categories (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          shop_id VARCHAR NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          image_url TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `;
      await shopClient`
        CREATE TABLE IF NOT EXISTS shop_products (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          shop_id VARCHAR NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
          category_id VARCHAR REFERENCES shop_categories(id) ON DELETE SET NULL,
          name TEXT NOT NULL,
          description TEXT,
          price REAL NOT NULL,
          image_urls TEXT[] DEFAULT '{}',
          downloadable_files TEXT[] DEFAULT '{}',
          downloadable_file_names TEXT[] DEFAULT '{}',
          checkout_fields JSONB DEFAULT '[]',
          delivery_method TEXT DEFAULT 'email',
          stock INTEGER,
          is_active BOOLEAN NOT NULL DEFAULT true,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `;
      await shopClient`
        CREATE TABLE IF NOT EXISTS shop_orders (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          shop_id VARCHAR NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
          product_id VARCHAR NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
          customer_name TEXT,
          customer_email TEXT,
          customer_phone TEXT,
          checkout_data JSONB DEFAULT '{}',
          amount REAL NOT NULL,
          currency TEXT NOT NULL DEFAULT 'XOF',
          payment_reference TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          delivery_method TEXT DEFAULT 'email',
          delivery_sent_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `;
      console.log("✅ Shop tables ready");
    } catch (e) {
      console.error("⚠️ Shop tables setup error:", e);
    }
    await shopClient.end();

    // Step 13: Ensure primary admin exists
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
      }

      console.log("⚙️ Ensuring database indexes exist...");
      await seedClient`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id)`;
      await seedClient`CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON transactions (user_id, status)`;
      await seedClient`CREATE INDEX IF NOT EXISTS idx_transactions_user_status_type ON transactions (user_id, status, type)`;
      await seedClient`CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions (status)`;
      await seedClient`CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at DESC)`;
      await seedClient`CREATE INDEX IF NOT EXISTS idx_users_account_type ON users (account_type)`;
      await seedClient`CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users (kyc_status)`;
      console.log("✅ Database indexes ready");

      await seedClient.end();
      console.log("✅ Database bootstrap completed successfully!");
    } catch (seedError) {
      console.error("❌ Admin seeding failed:", seedError);
      await seedClient.end();
      throw seedError;
    }
  } catch (error) {
    console.error("❌ Database bootstrap failed:", error);
    throw error;
  }
}

export { bootstrapDatabase };
