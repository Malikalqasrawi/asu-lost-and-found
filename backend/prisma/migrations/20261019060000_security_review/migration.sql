-- Emails that carry a code are dropped once the code has expired.
ALTER TABLE "outbox_emails" ADD COLUMN "expires_at" TIMESTAMPTZ(3);

-- Security office accounts get an emailed code when they sign in with a password.
ALTER TYPE "EmailCodePurpose" ADD VALUE 'SECURITY_SIGN_IN';
