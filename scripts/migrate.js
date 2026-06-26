#!/usr/bin/env node

const { execSync } = require('child_process');

async function runMigrations() {
  try {
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
