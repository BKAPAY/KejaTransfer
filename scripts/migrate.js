#!/usr/bin/env node

const { Client } = require('pg');
const { execSync } = require('child_process');

async function runMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Tables that need to be truncated to resolve unique constraint conflicts
    // These are ALL tables with UNIQUE constraints in the schema
    const tablesToTruncate = [
      // Core tables with unique constraints
      'users',                    // email UNIQUE
      'payment_links',            // token UNIQUE
      'merchant_links',           // token UNIQUE
      'api_keys',                 // publicKey, privateKey, payinPrivateKey UNIQUE
      'crypto_currencies',        // code UNIQUE
      'business_tokens',          // token UNIQUE
      'salary_accounts',          // userId UNIQUE
      'shops',                    // slug UNIQUE
      
      // Tables that depend on above tables (foreign keys)
      'business_wallets',
      'transactions',
      'verification_codes',
      'payment_sessions',
      'currency_exchange_fees',
      'fee_configs',
      'shop_categories',
      'shop_products',
      'shop_orders',
      'salary_schedules',
      'salary_transactions',
      'login_logs',
      'settlements',
      'country_operator_config',
      'country_status',
      'provider_configs',
      'video_files',
      'session',  // Express session table
    ];

    console.log('🗑️  Truncating tables with unique constraints...\n');
    
    let truncatedCount = 0;
    for (const table of tablesToTruncate) {
      try {
        await client.query(`TRUNCATE TABLE ${table} CASCADE`);
        console.log(`   ✓ ${table}`);
        truncatedCount++;
      } catch (err) {
        // Table doesn't exist or already truncated - not an error
        if (err.message.includes('does not exist')) {
          console.log(`   - ${table} (not found)`);
        } else {
          console.log(`   ⚠ ${table}: ${err.message}`);
        }
      }
    }

    await client.end();
    console.log(`\n✅ Truncated ${truncatedCount} tables successfully`);
    console.log('✅ Disconnected from database\n');

    // Run drizzle-kit push with force flag
    console.log('🚀 Running drizzle-kit push...\n');
    execSync('npx drizzle-kit push --force', { 
      stdio: 'inherit',
      env: { ...process.env }
    });
    console.log('\n✅ Migrations completed successfully!');

  } catch (error) {
    console.error('\n❌ Error during migration:', error.message);
    process.exit(1);
  }
}

runMigrations();
