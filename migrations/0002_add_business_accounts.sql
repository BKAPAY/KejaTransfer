-- Add account type fields to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'personal';
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_name text;

-- Create business wallets table
CREATE TABLE IF NOT EXISTS business_wallets (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  country text NOT NULL,
  currency text NOT NULL,
  balance integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS business_wallets_user_country_currency_idx ON business_wallets(user_id, country, currency);

-- Add scope to provider_configs
ALTER TABLE provider_configs ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'personal';

-- Drop old unique constraint and add composite unique
ALTER TABLE provider_configs DROP CONSTRAINT IF EXISTS provider_configs_provider_unique;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'provider_configs_provider_scope_unique'
  ) THEN
    ALTER TABLE provider_configs ADD CONSTRAINT provider_configs_provider_scope_unique UNIQUE (provider, scope);
  END IF;
END $$;

-- Add scope to fee_configs
ALTER TABLE fee_configs ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'personal';

-- Add scope to country_operator_config
ALTER TABLE country_operator_config ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'personal';

-- Add scope to country_status
ALTER TABLE country_status ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'personal';
