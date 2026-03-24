import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Run with: node --env-file=.env.local scripts/seed.mjs')
  process.exit(1)
}

const db = createClient(supabaseUrl, serviceRoleKey)

// ─── seed data ───────────────────────────────────────────────

const users = [
  {
    id: 'a1b2c3d4-0001-0001-0001-000000000001',
    email: 'alice@example.com',
    name: 'Alice Nguyen',
    password_hash: '$2b$12$KIXp.3FakeHashForAlice.abcdefghijklmn',
    provider: 'credentials',
    currency: 'USD',
    created_at: '2026-01-10T09:00:00+00:00',
    updated_at: '2026-01-10T09:00:00+00:00',
  },
  {
    id: 'a1b2c3d4-0002-0002-0002-000000000002',
    email: 'bob@example.com',
    name: 'Bob Martinez',
    password_hash: null,
    provider: 'google',
    currency: 'EUR',
    created_at: '2026-02-01T14:30:00+00:00',
    updated_at: '2026-02-01T14:30:00+00:00',
  },
]

const categories = [
  { id: 'c0000001-0000-0000-0000-000000000001', user_id: null, name: 'Food & Dining',  is_default: true,  is_archived: false, created_at: '2026-01-01T00:00:00+00:00', updated_at: '2026-01-01T00:00:00+00:00' },
  { id: 'c0000002-0000-0000-0000-000000000002', user_id: null, name: 'Transport',      is_default: true,  is_archived: false, created_at: '2026-01-01T00:00:00+00:00', updated_at: '2026-01-01T00:00:00+00:00' },
  { id: 'c0000003-0000-0000-0000-000000000003', user_id: null, name: 'Housing',        is_default: true,  is_archived: false, created_at: '2026-01-01T00:00:00+00:00', updated_at: '2026-01-01T00:00:00+00:00' },
  { id: 'c0000004-0000-0000-0000-000000000004', user_id: null, name: 'Health',         is_default: true,  is_archived: false, created_at: '2026-01-01T00:00:00+00:00', updated_at: '2026-01-01T00:00:00+00:00' },
  { id: 'c0000005-0000-0000-0000-000000000005', user_id: null, name: 'Entertainment',  is_default: true,  is_archived: false, created_at: '2026-01-01T00:00:00+00:00', updated_at: '2026-01-01T00:00:00+00:00' },
  { id: 'c0000006-0000-0000-0000-000000000006', user_id: null, name: 'Shopping',       is_default: true,  is_archived: false, created_at: '2026-01-01T00:00:00+00:00', updated_at: '2026-01-01T00:00:00+00:00' },
  { id: 'c0000007-0000-0000-0000-000000000007', user_id: 'a1b2c3d4-0001-0001-0001-000000000001', name: 'Side Projects', is_default: false, is_archived: false, created_at: '2026-01-15T10:00:00+00:00', updated_at: '2026-01-15T10:00:00+00:00' },
  { id: 'c0000008-0000-0000-0000-000000000008', user_id: 'a1b2c3d4-0001-0001-0001-000000000001', name: 'Pet Care',      is_default: false, is_archived: false, created_at: '2026-01-15T10:00:00+00:00', updated_at: '2026-01-15T10:00:00+00:00' },
  { id: 'c0000009-0000-0000-0000-000000000009', user_id: 'a1b2c3d4-0002-0002-0002-000000000002', name: 'Travel',        is_default: false, is_archived: false, created_at: '2026-02-05T08:00:00+00:00', updated_at: '2026-02-05T08:00:00+00:00' },
  { id: 'c000000a-0000-0000-0000-00000000000a', user_id: 'a1b2c3d4-0002-0002-0002-000000000002', name: 'Old Gym',       is_default: false, is_archived: true,  created_at: '2026-02-05T08:00:00+00:00', updated_at: '2026-03-01T08:00:00+00:00' },
]

const expenses = [
  // Alice — February 2026
  { id: 'e0000001-0000-0000-0000-000000000001', user_id: 'a1b2c3d4-0001-0001-0001-000000000001', category_id: 'c0000003-0000-0000-0000-000000000003', amount: 1850.00, description: 'February rent',        notes: null,                   date: '2026-02-01', is_recurring: true,  created_at: '2026-02-01T08:00:00+00:00', updated_at: '2026-02-01T08:00:00+00:00' },
  { id: 'e0000002-0000-0000-0000-000000000002', user_id: 'a1b2c3d4-0001-0001-0001-000000000001', category_id: 'c0000001-0000-0000-0000-000000000001', amount:   62.40, description: 'Weekly groceries',     notes: "Trader Joe's",         date: '2026-02-03', is_recurring: false, created_at: '2026-02-03T11:00:00+00:00', updated_at: '2026-02-03T11:00:00+00:00' },
  { id: 'e0000003-0000-0000-0000-000000000003', user_id: 'a1b2c3d4-0001-0001-0001-000000000001', category_id: 'c0000002-0000-0000-0000-000000000002', amount:   98.00, description: 'Monthly transit pass', notes: null,                   date: '2026-02-04', is_recurring: true,  created_at: '2026-02-04T07:30:00+00:00', updated_at: '2026-02-04T07:30:00+00:00' },
  { id: 'e0000004-0000-0000-0000-000000000004', user_id: 'a1b2c3d4-0001-0001-0001-000000000001', category_id: 'c0000001-0000-0000-0000-000000000001', amount:   34.50, description: 'Team lunch',           notes: 'Went to Thai place',   date: '2026-02-07', is_recurring: false, created_at: '2026-02-07T13:00:00+00:00', updated_at: '2026-02-07T13:00:00+00:00' },
  { id: 'e0000005-0000-0000-0000-000000000005', user_id: 'a1b2c3d4-0001-0001-0001-000000000001', category_id: 'c0000008-0000-0000-0000-000000000008', amount:   85.00, description: 'Vet checkup',          notes: 'Annual shots',         date: '2026-02-10', is_recurring: false, created_at: '2026-02-10T15:00:00+00:00', updated_at: '2026-02-10T15:00:00+00:00' },
  { id: 'e0000006-0000-0000-0000-000000000006', user_id: 'a1b2c3d4-0001-0001-0001-000000000001', category_id: 'c0000006-0000-0000-0000-000000000006', amount:  120.00, description: 'Winter jacket',        notes: 'On sale 40% off',      date: '2026-02-14', is_recurring: false, created_at: '2026-02-14T16:00:00+00:00', updated_at: '2026-02-14T16:00:00+00:00' },
  { id: 'e0000007-0000-0000-0000-000000000007', user_id: 'a1b2c3d4-0001-0001-0001-000000000001', category_id: 'c0000005-0000-0000-0000-000000000005', amount:   15.99, description: 'Netflix subscription', notes: null,                   date: '2026-02-15', is_recurring: true,  created_at: '2026-02-15T00:00:00+00:00', updated_at: '2026-02-15T00:00:00+00:00' },
  { id: 'e0000008-0000-0000-0000-000000000008', user_id: 'a1b2c3d4-0001-0001-0001-000000000001', category_id: 'c0000007-0000-0000-0000-000000000007', amount:   49.00, description: 'Domain renewal',      notes: 'alicedev.io 2yr',      date: '2026-02-20', is_recurring: false, created_at: '2026-02-20T09:00:00+00:00', updated_at: '2026-02-20T09:00:00+00:00' },
  // Alice — March 2026
  { id: 'e0000009-0000-0000-0000-000000000009', user_id: 'a1b2c3d4-0001-0001-0001-000000000001', category_id: 'c0000003-0000-0000-0000-000000000003', amount: 1850.00, description: 'March rent',           notes: null,                   date: '2026-03-01', is_recurring: true,  created_at: '2026-03-01T08:00:00+00:00', updated_at: '2026-03-01T08:00:00+00:00' },
  { id: 'e000000a-0000-0000-0000-00000000000a', user_id: 'a1b2c3d4-0001-0001-0001-000000000001', category_id: 'c0000001-0000-0000-0000-000000000001', amount:   58.75, description: 'Groceries',            notes: null,                   date: '2026-03-05', is_recurring: false, created_at: '2026-03-05T11:00:00+00:00', updated_at: '2026-03-05T11:00:00+00:00' },
  { id: 'e000000b-0000-0000-0000-00000000000b', user_id: 'a1b2c3d4-0001-0001-0001-000000000001', category_id: 'c0000004-0000-0000-0000-000000000004', amount:   25.00, description: 'Pharmacy',             notes: 'Cold medicine',        date: '2026-03-08', is_recurring: false, created_at: '2026-03-08T18:00:00+00:00', updated_at: '2026-03-08T18:00:00+00:00' },
  { id: 'e000000c-0000-0000-0000-00000000000c', user_id: 'a1b2c3d4-0001-0001-0001-000000000001', category_id: 'c0000002-0000-0000-0000-000000000002', amount:   98.00, description: 'Monthly transit pass', notes: null,                   date: '2026-03-04', is_recurring: true,  created_at: '2026-03-04T07:30:00+00:00', updated_at: '2026-03-04T07:30:00+00:00' },
  { id: 'e000000d-0000-0000-0000-00000000000d', user_id: 'a1b2c3d4-0001-0001-0001-000000000001', category_id: 'c0000005-0000-0000-0000-000000000005', amount:   15.99, description: 'Netflix subscription', notes: null,                   date: '2026-03-15', is_recurring: true,  created_at: '2026-03-15T00:00:00+00:00', updated_at: '2026-03-15T00:00:00+00:00' },
  { id: 'e000000e-0000-0000-0000-00000000000e', user_id: 'a1b2c3d4-0001-0001-0001-000000000001', category_id: 'c0000001-0000-0000-0000-000000000001', amount:   22.50, description: 'Coffee & pastries',   notes: 'Client meeting',       date: '2026-03-18', is_recurring: false, created_at: '2026-03-18T09:30:00+00:00', updated_at: '2026-03-18T09:30:00+00:00' },
  // Bob — March 2026
  { id: 'e000000f-0000-0000-0000-00000000000f', user_id: 'a1b2c3d4-0002-0002-0002-000000000002', category_id: 'c0000003-0000-0000-0000-000000000003', amount:  950.00, description: 'March rent',           notes: null,                   date: '2026-03-01', is_recurring: true,  created_at: '2026-03-01T09:00:00+00:00', updated_at: '2026-03-01T09:00:00+00:00' },
  { id: 'e0000010-0000-0000-0000-000000000010', user_id: 'a1b2c3d4-0002-0002-0002-000000000002', category_id: 'c0000009-0000-0000-0000-000000000009', amount:  430.00, description: 'Weekend in Barcelona', notes: 'Flights + hotel',      date: '2026-03-07', is_recurring: false, created_at: '2026-03-07T20:00:00+00:00', updated_at: '2026-03-07T20:00:00+00:00' },
  { id: 'e0000011-0000-0000-0000-000000000011', user_id: 'a1b2c3d4-0002-0002-0002-000000000002', category_id: 'c0000001-0000-0000-0000-000000000001', amount:   74.20, description: 'Supermarket',          notes: null,                   date: '2026-03-10', is_recurring: false, created_at: '2026-03-10T12:00:00+00:00', updated_at: '2026-03-10T12:00:00+00:00' },
  { id: 'e0000012-0000-0000-0000-000000000012', user_id: 'a1b2c3d4-0002-0002-0002-000000000002', category_id: 'c0000002-0000-0000-0000-000000000002', amount:   55.00, description: 'Taxi rides (week)',    notes: null,                   date: '2026-03-14', is_recurring: false, created_at: '2026-03-14T19:00:00+00:00', updated_at: '2026-03-14T19:00:00+00:00' },
  { id: 'e0000013-0000-0000-0000-000000000013', user_id: 'a1b2c3d4-0002-0002-0002-000000000002', category_id: 'c0000006-0000-0000-0000-000000000006', amount:  210.00, description: 'Running shoes',        notes: 'Nike Pegasus',         date: '2026-03-19', is_recurring: false, created_at: '2026-03-19T14:00:00+00:00', updated_at: '2026-03-19T14:00:00+00:00' },
  { id: 'e0000014-0000-0000-0000-000000000014', user_id: 'a1b2c3d4-0002-0002-0002-000000000002', category_id: 'c0000004-0000-0000-0000-000000000004', amount:   38.50, description: 'Dentist copay',        notes: null,                   date: '2026-03-21', is_recurring: false, created_at: '2026-03-21T10:00:00+00:00', updated_at: '2026-03-21T10:00:00+00:00' },
]

const monthlySummaries = [
  {
    id: 'a0000001-0000-0000-0000-000000000001',
    user_id: 'a1b2c3d4-0001-0001-0001-000000000001',
    year: 2026, month: 2,
    total_spent: 2314.89,
    expense_count: 8,
    category_breakdown: [
      { category_id: 'c0000003-0000-0000-0000-000000000003', total: 1850.00, count: 1 },
      { category_id: 'c0000001-0000-0000-0000-000000000001', total:   96.90, count: 2 },
      { category_id: 'c0000002-0000-0000-0000-000000000002', total:   98.00, count: 1 },
      { category_id: 'c0000008-0000-0000-0000-000000000008', total:   85.00, count: 1 },
      { category_id: 'c0000006-0000-0000-0000-000000000006', total:  120.00, count: 1 },
      { category_id: 'c0000005-0000-0000-0000-000000000005', total:   15.99, count: 1 },
      { category_id: 'c0000007-0000-0000-0000-000000000007', total:   49.00, count: 1 },
    ],
    updated_at: '2026-03-01T00:00:00+00:00',
  },
  {
    id: 'a0000002-0000-0000-0000-000000000002',
    user_id: 'a1b2c3d4-0001-0001-0001-000000000001',
    year: 2026, month: 3,
    total_spent: 2070.24,
    expense_count: 6,
    category_breakdown: [
      { category_id: 'c0000003-0000-0000-0000-000000000003', total: 1850.00, count: 1 },
      { category_id: 'c0000001-0000-0000-0000-000000000001', total:   81.25, count: 2 },
      { category_id: 'c0000004-0000-0000-0000-000000000004', total:   25.00, count: 1 },
      { category_id: 'c0000002-0000-0000-0000-000000000002', total:   98.00, count: 1 },
      { category_id: 'c0000005-0000-0000-0000-000000000005', total:   15.99, count: 1 },
    ],
    updated_at: '2026-03-22T00:00:00+00:00',
  },
  {
    id: 'a0000003-0000-0000-0000-000000000003',
    user_id: 'a1b2c3d4-0002-0002-0002-000000000002',
    year: 2026, month: 3,
    total_spent: 1757.70,
    expense_count: 6,
    category_breakdown: [
      { category_id: 'c0000003-0000-0000-0000-000000000003', total:  950.00, count: 1 },
      { category_id: 'c0000009-0000-0000-0000-000000000009', total:  430.00, count: 1 },
      { category_id: 'c0000001-0000-0000-0000-000000000001', total:   74.20, count: 1 },
      { category_id: 'c0000002-0000-0000-0000-000000000002', total:   55.00, count: 1 },
      { category_id: 'c0000006-0000-0000-0000-000000000006', total:  210.00, count: 1 },
      { category_id: 'c0000004-0000-0000-0000-000000000004', total:   38.50, count: 1 },
    ],
    updated_at: '2026-03-22T00:00:00+00:00',
  },
]

// ─── insert helpers ───────────────────────────────────────────

async function seed(table, rows) {
  const { error } = await db.from(table).upsert(rows, { onConflict: 'id' })
  if (error) {
    console.error(`✗ ${table}:`, error.message)
    process.exit(1)
  }
  console.log(`✓ ${table} — ${rows.length} row(s)`)
}

// ─── run ─────────────────────────────────────────────────────

await seed('users', users)
await seed('categories', categories)
await seed('expenses', expenses)
await seed('monthly_summaries', monthlySummaries)

console.log('\nSeed complete.')
