#!/usr/bin/env node

const { execSync } = require('child_process');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is required to run database migrations');
  process.exit(1);
}

try {
  console.log('🚀 Applying database schema with drizzle-kit push...\n');
  execSync('npx drizzle-kit push --force', {
    stdio: 'inherit',
    env: { ...process.env },
  });
  console.log('\n✅ Migrations completed successfully!');
} catch (error) {
  console.error('\n❌ Error during migration:', error.message);
  process.exit(1);
}
