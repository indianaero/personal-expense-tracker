-- =============================================================
-- Personal Expense Tracker — Supabase / PostgreSQL schema
-- Run this in the Supabase SQL editor to create all tables.
-- =============================================================

-- ─── users ───────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT,
  provider      TEXT NOT NULL DEFAULT 'credentials'
                  CHECK (provider IN ('credentials', 'google')),
  currency      TEXT NOT NULL DEFAULT 'USD',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── categories ──────────────────────────────────────────────
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX idx_categories_is_default ON categories (is_default);

-- ─── expenses ────────────────────────────────────────────────
CREATE TABLE expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  amount       NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  description  TEXT NOT NULL,
  notes        TEXT,
  date         DATE NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_user_date          ON expenses (user_id, date DESC);
CREATE INDEX idx_expenses_user_category      ON expenses (user_id, category_id);
CREATE INDEX idx_expenses_user_date_category ON expenses (user_id, date DESC, category_id);

-- ─── monthly_summaries ───────────────────────────────────────
-- Cached per-user monthly rollups; rebuilt by the summary service.
CREATE TABLE monthly_summaries (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year               SMALLINT NOT NULL,
  month              SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  total_spent        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  expense_count      INTEGER NOT NULL DEFAULT 0,
  category_breakdown JSONB NOT NULL DEFAULT '[]',
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, year, month)
);

-- ─── auto-update updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_monthly_summaries_updated_at
  BEFORE UPDATE ON monthly_summaries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
