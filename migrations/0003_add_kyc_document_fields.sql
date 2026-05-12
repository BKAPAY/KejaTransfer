-- Add KYC document type, number and expiry date fields to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_document_type text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_document_number text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_document_expiry_date text;
