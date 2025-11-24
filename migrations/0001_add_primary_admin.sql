ALTER TABLE users ADD COLUMN is_primary_admin boolean NOT NULL DEFAULT false;

-- Set the primary admin
UPDATE users SET is_primary_admin = true WHERE email = 'kpetekoussojuste1@gmail.com';
