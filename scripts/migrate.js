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

    // Truncate the business_tokens table to resolve unique constraint conflict
    try {
      await client.query('TRUNCATE TABLE business_tokens CASCADE');
      console.log('✓ Truncated business_tokens table');
    } catch (err) {
      console.log('Table business_tokens does not exist yet or already truncated');
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
