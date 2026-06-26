#!/usr/bin/env node

const { Client } = require('pg');
const { execSync } = require('child_process');

async function runMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Tables that need to be truncated to resolve unique constraint conflicts
    const tablesToTruncate = [
      'business_tokens',
      'api_keys',
      'merchant_links',
      'payment_links',
      'settlements'
    ];

    for (const table of tablesToTruncate) {
      try {
        await client.query(`TRUNCATE TABLE ${table} CASCADE`);
        console.log(`✓ Truncated ${table} table`);
      } catch (err) {
        console.log(`Table ${table} does not exist yet or already truncated`);
      }
    }

    await client.end();
    console.log('Disconnected from database');

    // Run drizzle-kit push with force flag
    console.log('\nRunning drizzle-kit push...');
    execSync('npx drizzle-kit push --force', { 
      stdio: 'inherit',
      env: { ...process.env }
    });
    console.log('✓ Migrations completed successfully');

  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

runMigrations();
