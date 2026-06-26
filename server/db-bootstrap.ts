import { readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

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
    const migrationsDir = join(process.cwd(), "migrations");
    const journalPath = join(migrationsDir, "meta", "_journal.json");
    console.log(`📁 Using migrations path: ${journalPath}`);
    
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

    // Step 2b: Ensure new columns exist BEFORE any Drizzle ORM query (schema reconciliation)
    try {
      await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_sector TEXT`;
      await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_sub_sector TEXT`;
      // Statut de validation du secteur. Defaut "approved" pour ne PAS bloquer les utilisateurs
      // existants (qui ont deja un secteur via KYC). Les anciens users SANS secteur restent bloques
      // par la garde de retrait (secteur absent), puis passent en "pending" quand ils le configurent.
      await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS sector_status TEXT NOT NULL DEFAULT 'approved'`;
      console.log("✅ users.kyc_sector/kyc_sub_sector/sector_status columns ensured (early)");
    } catch (e) {
      console.error("⚠️ Early kyc_sector/kyc_sub_sector column migration error:", e);
    }

    // Step 2c: Restriction pays par secteur (multi_country_enabled)
    // Nouvelle colonne par defaut false (restreint au pays de l'utilisateur).
    // Les utilisateurs EXISTANTS sont mis a true pour preserver leur comportement actuel (ne rien casser).
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
            const sqlPath = join(migrationsDir, `${entry.tag}.sql`);
            
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
    await migrate(db, { migrationsFolder: migrationsDir });
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

    // Step 6b: Ensure login_logs table exists
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
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `;
      await loginLogsClient`
        ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS device_model TEXT
      `;
      await loginLogsClient`
        ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS photo_base64 TEXT
      `;
      await loginLogsClient`
        ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS photo_back_base64 TEXT
      `;
      await loginLogsClient`
        ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS gps_latitude TEXT
      `;
      await loginLogsClient`
        ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS gps_longitude TEXT
      `;
      await loginLogsClient`
        ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS gps_accuracy TEXT
      `;
      await loginLogsClient`
        ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS gps_address TEXT
      `;
      await loginLogsClient`
        ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS connection_type TEXT
      `;
      console.log("✅ Login logs table ready");
    } catch (e) {
      console.error("⚠️ Login logs setup error:", e);
    }
    await loginLogsClient.end();

    // Step 6c: Ensure moneyfusion_ip_logs table exists
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
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      await ipLogsClient`
        ALTER TABLE moneyfusion_ip_logs ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'moneyfusion'
      `;
      console.log("✅ MoneyFusion IP logs table ready");
    } catch (e) {
      console.error("⚠️ MoneyFusion IP logs setup error:", e);
    }
    await ipLogsClient.end();

    // Step 6d: Ensure payout_api_enabled column exists in users table
    const payoutColClient = postgres(DATABASE_URL);
    try {
      await payoutColClient`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_api_enabled BOOLEAN NOT NULL DEFAULT FALSE
      `;
      console.log("✅ users.payout_api_enabled column ready");
    } catch (e) {
      console.error("⚠️ payout_api_enabled column setup error:", e);
    }
    await payoutColClient.end();

    // Step 6d2: Ensure wave_payin_enabled column exists in users table
    const waveColClient = postgres(DATABASE_URL);
    try {
      await waveColClient`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS wave_payin_enabled BOOLEAN NOT NULL DEFAULT FALSE
      `;
      console.log("✅ users.wave_payin_enabled column ready");
    } catch (e) {
      console.error("⚠️ wave_payin_enabled column setup error:", e);
    }
    await waveColClient.end();

    // Step 6d3: Ensure deposit_override_enabled column exists in users table
    const depositColClient = postgres(DATABASE_URL);
    try {
      await depositColClient`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS deposit_override_enabled BOOLEAN NOT NULL DEFAULT FALSE
      `;
      console.log("✅ users.deposit_override_enabled column ready");
    } catch (e) {
      console.error("⚠️ deposit_override_enabled column setup error:", e);
    }
    await depositColClient.end();

    // Step 6d4: Ensure kyc_phone and kyc_whatsapp columns exist in users table
    const kycPhoneClient = postgres(DATABASE_URL);
    try {
      await kycPhoneClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_phone TEXT`;
      await kycPhoneClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_whatsapp TEXT`;
      await kycPhoneClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_activity_url TEXT`;
      await kycPhoneClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_url_website TEXT`;
      await kycPhoneClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_url_instagram TEXT`;
      await kycPhoneClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_url_facebook TEXT`;
      await kycPhoneClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_url_tiktok TEXT`;
      await kycPhoneClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_url_whatsapp_group TEXT`;
      await kycPhoneClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_url_whatsapp_channel TEXT`;
      await kycPhoneClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_document_type TEXT`;
      await kycPhoneClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_document_number TEXT`;
      await kycPhoneClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_document_expiry_date TEXT`;
      console.log("✅ users.kyc_phone and kyc_whatsapp columns ready");
    } catch (e) {
      console.error("⚠️ kyc_phone/kyc_whatsapp column setup error:", e);
    }
    await kycPhoneClient.end();

    // Step 6e: Ensure payout_callback_url and payout_callback_secret columns exist in api_keys
    const payoutCbClient = postgres(DATABASE_URL);
    try {
      await payoutCbClient`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS payout_callback_url TEXT`;
      await payoutCbClient`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS payout_callback_secret TEXT`;
      console.log("✅ api_keys payout callback columns ready");
    } catch (e) {
      console.error("⚠️ payout callback columns setup error:", e);
    }
    await payoutCbClient.end();

    // Step 6f: Ensure payin_private_key column exists in api_keys and generate for existing keys
    const payinKeyClient = postgres(DATABASE_URL);
    try {
      await payinKeyClient`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS payin_private_key TEXT UNIQUE`;
      console.log("✅ api_keys payin_private_key column ready");
      // Auto-generate payin_private_key for existing keys that don't have one
      const keysNeedingPayin = await payinKeyClient`SELECT id FROM api_keys WHERE payin_private_key IS NULL`;
      for (const row of keysNeedingPayin) {
        const { randomUUID } = await import("crypto");
        await payinKeyClient`UPDATE api_keys SET payin_private_key = ${`sk_payin_live_${randomUUID()}`} WHERE id = ${row.id}`;
      }
      if (keysNeedingPayin.length > 0) {
        console.log(`✅ Generated payin_private_key for ${keysNeedingPayin.length} existing API key(s)`);
      }
    } catch (e) {
      console.error("⚠️ payin_private_key column setup error:", e);
    }
    await payinKeyClient.end();

    // Step 6f2: Auto-generate callbackSecret and payoutCallbackSecret for existing API keys that lack them
    const secretsClient = postgres(DATABASE_URL);
    try {
      const { randomUUID } = await import("crypto");
      const keysNeedingPayinSecret = await secretsClient`SELECT id FROM api_keys WHERE callback_secret IS NULL`;
      for (const row of keysNeedingPayinSecret) {
        await secretsClient`UPDATE api_keys SET callback_secret = ${`cs_${randomUUID().replace(/-/g, '')}`} WHERE id = ${row.id}`;
      }
      if (keysNeedingPayinSecret.length > 0) {
        console.log(`✅ Generated callback_secret for ${keysNeedingPayinSecret.length} existing API key(s)`);
      }
      const keysNeedingPayoutSecret = await secretsClient`SELECT id FROM api_keys WHERE payout_callback_secret IS NULL`;
      for (const row of keysNeedingPayoutSecret) {
        await secretsClient`UPDATE api_keys SET payout_callback_secret = ${`cs_${randomUUID().replace(/-/g, '')}`} WHERE id = ${row.id}`;
      }
      if (keysNeedingPayoutSecret.length > 0) {
        console.log(`✅ Generated payout_callback_secret for ${keysNeedingPayoutSecret.length} existing API key(s)`);
      }
    } catch (e) {
      console.error("⚠️ Secrets auto-generation error:", e);
    }
    await secretsClient.end();

    // Step 6g: Ensure business_tokens table exists
    const btClient = postgres(DATABASE_URL);
    try {
      console.log("⚙️ Ensuring business_tokens table exists...");
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
      console.error("⚠️ Business tokens table setup error:", e);
    }
    await btClient.end();

    // Step 6x: Ensure support_whatsapp_phone column exists in support_settings
    const supportWaClient = postgres(DATABASE_URL);
    try {
      await supportWaClient`ALTER TABLE support_settings ADD COLUMN IF NOT EXISTS support_whatsapp_phone TEXT NOT NULL DEFAULT ''`;
      console.log("✅ support_settings.support_whatsapp_phone column ready");
    } catch (e) {
      console.error("⚠️ support_whatsapp_phone column setup error:", e);
    }
    await supportWaClient.end();

    // Step 6h: Ensure bank account columns on users
    const bankClient = postgres(DATABASE_URL);
    try {
      const bankCols = [
        "bank_account_holder TEXT",
        "bank_account_number TEXT",
        "bank_name TEXT",
        "bank_swift_bic TEXT",
        "bank_branch_address TEXT",
        "bank_branch_name TEXT",
        "bank_branch_sort_code TEXT",
        "bank_country TEXT",
        "bank_currency TEXT",
      ];
      for (const col of bankCols) {
        const name = col.split(" ")[0];
        await bankClient`SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name=${name}`.then(async (rows: any[]) => {
          if (rows.length === 0) {
            await bankClient.unsafe(`ALTER TABLE users ADD COLUMN ${col}`);
          }
        });
      }
      console.log("✅ Bank account columns ready on users");
    } catch (e) {
      console.error("⚠️ Bank account columns setup error:", e);
    }
    await bankClient.end();

    // Step 6i: Ensure settlements table exists
    const settlClient = postgres(DATABASE_URL);
    try {
      await settlClient`
        CREATE TABLE IF NOT EXISTS settlements (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
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
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `;
      console.log("✅ Settlements table ready");
      await settlClient`ALTER TABLE settlements ADD COLUMN IF NOT EXISTS admin_notes TEXT`;
      await settlClient`ALTER TABLE settlements ADD COLUMN IF NOT EXISTS rejection_reason TEXT`;
      await settlClient`ALTER TABLE settlements ADD COLUMN IF NOT EXISTS settlement_method TEXT DEFAULT 'bank'`;
      await settlClient`ALTER TABLE settlements ADD COLUMN IF NOT EXISTS momo_country TEXT`;
      await settlClient`ALTER TABLE settlements ADD COLUMN IF NOT EXISTS momo_operator TEXT`;
      await settlClient`ALTER TABLE settlements ADD COLUMN IF NOT EXISTS momo_phone TEXT`;
    } catch (e) {
      console.error("⚠️ Settlements table setup error:", e);
    }
    await settlClient.end();

    // Add MOMO columns to users table (must run before Step 7 admin seeding which uses Drizzle ORM)
    const momoUsersClient = postgres(DATABASE_URL);
    try {
      await momoUsersClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS momo_country TEXT`;
      await momoUsersClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS momo_operator TEXT`;
      await momoUsersClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS momo_phone TEXT`;
      console.log("✅ users.momo_country/operator/phone columns ready");
    } catch (e) {
      console.error("⚠️ users MOMO columns setup error:", e);
    }
    await momoUsersClient.end();

    // Step 6b: Add custom_fields, document_urls, document_names columns to payment_links
    const plClient = postgres(DATABASE_URL);
    try {
      await plClient`ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS custom_fields TEXT`;
      await plClient`ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS document_urls TEXT[] DEFAULT '{}'`;
      await plClient`ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS document_names TEXT[] DEFAULT '{}'`;
      console.log("✅ Payment links custom fields and documents columns ready");
    } catch (e) {
      console.error("⚠️ Payment links columns setup error:", e);
    }
    await plClient.end();

    // Salary system migrations
    const salaryClient = postgres(DATABASE_URL);
    try {
      await salaryClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_salary BOOLEAN NOT NULL DEFAULT false`;
      await salaryClient`
        CREATE TABLE IF NOT EXISTS salary_accounts (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          balance REAL NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'XOF',
          is_active BOOLEAN NOT NULL DEFAULT true,
          label TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;
      await salaryClient`DROP TABLE IF EXISTS salary_schedules CASCADE`;
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
      console.log("✅ Salary tables and is_salary column ready");
    } catch (e) {
      console.error("⚠️ Salary migration error:", e);
    }
    await salaryClient.end();

    // Shop system migrations
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
      await shopClient`CREATE INDEX IF NOT EXISTS idx_shops_user_id ON shops (user_id)`;
      await shopClient`CREATE INDEX IF NOT EXISTS idx_shops_slug ON shops (slug)`;
      await shopClient`CREATE INDEX IF NOT EXISTS idx_shop_products_shop_id ON shop_products (shop_id)`;
      await shopClient`CREATE INDEX IF NOT EXISTS idx_shop_orders_shop_id ON shop_orders (shop_id)`;
      // Add new columns if they don't exist
      await shopClient`ALTER TABLE shops ADD COLUMN IF NOT EXISTS font_family TEXT DEFAULT 'Poppins'`;
      await shopClient`ALTER TABLE shops ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#6366f1'`;
      console.log("✅ Shop tables ready");
    } catch (e) {
      console.error("⚠️ Shop migration error:", e);
    }
    await shopClient.end();

    // Step: Merchant links fee columns
    const mlClient = postgres(DATABASE_URL);
    try {
      await mlClient`ALTER TABLE merchant_links ADD COLUMN IF NOT EXISTS customer_pays_fee BOOLEAN NOT NULL DEFAULT false`;
      await mlClient`ALTER TABLE merchant_links ADD COLUMN IF NOT EXISTS customer_pays_crypto_fee BOOLEAN NOT NULL DEFAULT false`;
      console.log("✅ Merchant links fee columns ready");
    } catch (e) {
      console.error("⚠️ Merchant links fee migration error:", e);
    }
    await mlClient.end();

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

      // Add MOMO columns to users table
      try {
        await seedClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS momo_country TEXT`;
        await seedClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS momo_operator TEXT`;
        await seedClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS momo_phone TEXT`;
        console.log("✅ users.momo_country/operator/phone columns ready");
      } catch (e) {
        console.error("⚠️ users MOMO columns setup error:", e);
      }

      // Add MOMO columns to settlements table
      try {
        await seedClient`ALTER TABLE settlements ADD COLUMN IF NOT EXISTS settlement_method TEXT DEFAULT 'bank'`;
        await seedClient`ALTER TABLE settlements ADD COLUMN IF NOT EXISTS momo_country TEXT`;
        await seedClient`ALTER TABLE settlements ADD COLUMN IF NOT EXISTS momo_operator TEXT`;
        await seedClient`ALTER TABLE settlements ADD COLUMN IF NOT EXISTS momo_phone TEXT`;
        console.log("✅ settlements MOMO columns ready");
      } catch (e) {
        console.error("⚠️ settlements MOMO columns setup error:", e);
      }

      // Add batch_id column to settlements table
      try {
        await seedClient`ALTER TABLE settlements ADD COLUMN IF NOT EXISTS batch_id VARCHAR DEFAULT gen_random_uuid()`;
        console.log("✅ settlements.batch_id column ready");
      } catch (e) {
        console.error("⚠️ settlements batch_id column setup error:", e);
      }

      try {
        await seedClient`ALTER TABLE merchant_links ADD COLUMN IF NOT EXISTS min_amount INTEGER`;
        await seedClient`ALTER TABLE merchant_links ADD COLUMN IF NOT EXISTS min_amount_currency TEXT DEFAULT 'XOF'`;
        console.log("✅ merchant_links min_amount columns ready");
      } catch (e) {
        console.error("⚠️ merchant_links min_amount columns setup error:", e);
      }

      try {
        // Djamo Sénégal + Côte d'Ivoire (nouvel opérateur PayDunya)
        const djamoEntries = [
          { country: 'SN', operator: 'djamo', provider: 'paydunya', scope: 'personal' },
          { country: 'SN', operator: 'djamo', provider: 'paydunya', scope: 'business' },
          { country: 'CI', operator: 'djamo', provider: 'paydunya', scope: 'personal' },
          { country: 'CI', operator: 'djamo', provider: 'paydunya', scope: 'business' },
        ];
        for (const e of djamoEntries) {
          await seedClient`
            INSERT INTO country_operator_config (country, operator, incoming_enabled, outgoing_enabled, provider, scope)
            VALUES (${e.country}, ${e.operator}, false, false, ${e.provider}, ${e.scope})
            ON CONFLICT DO NOTHING
          `;
        }
        console.log("✅ Opérateurs Djamo (SN/CI) initialisés");
      } catch (e) {
        console.error("⚠️ Djamo operator init error:", e);
      }

      try {
        await seedClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_sector TEXT`;
        await seedClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_sub_sector TEXT`;
        console.log("✅ users.kyc_sector/kyc_sub_sector columns ready");
      } catch (e) {
        console.error("⚠️ users kyc_sector/kyc_sub_sector columns error:", e);
      }

      console.log("⚙️ Ensuring database indexes exist...");
      await seedClient`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id)`;
      await seedClient`CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON transactions (user_id, status)`;
      await seedClient`CREATE INDEX IF NOT EXISTS idx_transactions_user_status_type ON transactions (user_id, status, type)`;
      await seedClient`CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions (status)`;
      await seedClient`CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at DESC)`;
      await seedClient`CREATE INDEX IF NOT EXISTS idx_transactions_paydunya_token ON transactions (paydunya_token) WHERE paydunya_token IS NOT NULL`;
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
    await client.end();
    throw error;
  }
}

export { bootstrapDatabase };
