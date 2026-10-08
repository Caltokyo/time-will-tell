-- TIME WILL TELL — Field Notes subscribers (Neon PostgreSQL).
-- Creates only TWT-prefixed objects; nothing else in the database is touched.
-- Safe to run repeatedly. api/_lib.js also applies this on first use.

CREATE TABLE IF NOT EXISTS twt_subscribers (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'subscribed',
  source        TEXT        NOT NULL DEFAULT 'lp',
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT twt_subscribers_email_key UNIQUE (email),
  CONSTRAINT twt_subscribers_email_lower CHECK (email = lower(email)),
  CONSTRAINT twt_subscribers_status_check CHECK (status IN ('subscribed', 'unsubscribed'))
);

-- Per-IP attempt counter for the signup form (IP stored only as a SHA-256 hash).
CREATE TABLE IF NOT EXISTS twt_subscribe_attempts (
  ip_hash      TEXT        PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts     INTEGER     NOT NULL DEFAULT 0
);

-- Confirmation email + unsubscribe link (added for Resend). Idempotent.
ALTER TABLE twt_subscribers ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT;
ALTER TABLE twt_subscribers ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS twt_subscribers_unsubscribe_token_key ON twt_subscribers (unsubscribe_token);
