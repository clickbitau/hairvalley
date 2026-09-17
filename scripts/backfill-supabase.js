// One-time backfill: push data/site-data.json categories, services & stylists
// into the Supabase relational tables so they match the JSON blob that
// /api/content serves to the frontend.
// Run: node scripts/backfill-supabase.js

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL / key in .env — aborting.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'site-data.json'), 'utf8'));

async function count(table) {
  const { count: n, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return error ? `error: ${error.message}` : n;
}

(async () => {
  console.log('Before — categories:', await count('categories'), '| services:', await count('services'), '| stylists:', await count('stylists'));

  // 1. Categories FIRST (parent table for services.category_id FK)
  const categories = (data.categories || []).map((c, i) => ({
    id: c.id,
    name: c.title || c.id,
    slug: c.id,
    display_order: i
  }));

  if (categories.length) {
    const { error } = await supabase.from('categories').upsert(categories, { onConflict: 'id' });
    if (error) {
      console.error(`categories upsert FAILED: ${error.message} — aborting before services (FK would fail)`);
      process.exit(1);
    }
    console.log(`categories upserted: ${categories.length}`);
  }

  const validCatIds = new Set(categories.map(c => c.id));

  // 2. Services
  const services = (data.services || []).map((s, i) => ({
    id: s.id,
    category_id: validCatIds.has(s.category) ? s.category : 'haircuts',
    category_name: s.categoryName || '',
    name: s.name || '',
    price: s.price || '',
    original_price: s.originalPrice || '',
    savings: s.savings || '',
    duration: s.duration || '',
    description: s.description || '',
    image: s.image || '',
    sort_order: s.sortOrder != null ? s.sortOrder : i,
    updated_at: new Date().toISOString()
  }));

  if (services.length) {
    const { error } = await supabase.from('services').upsert(services, { onConflict: 'id' });
    console.log(error ? `services upsert FAILED: ${error.message}` : `services upserted: ${services.length}`);
  }

  // 3. Stylists
  const stylists = ((data.about && data.about.stylists) || []).map((s, i) => ({
    id: s.id,
    name: s.name || '',
    role: s.role || '',
    tag: s.tag || '',
    craft_years: s.craftYears || '',
    bio: s.bio || '',
    image: s.image || '',
    sort_order: s.sortOrder != null ? s.sortOrder : i,
    updated_at: new Date().toISOString()
  }));

  if (stylists.length) {
    const { error } = await supabase.from('stylists').upsert(stylists, { onConflict: 'id' });
    console.log(error ? `stylists upsert FAILED: ${error.message}` : `stylists upserted: ${stylists.length}`);
  }

  console.log('After — categories:', await count('categories'), '| services:', await count('services'), '| stylists:', await count('stylists'));
})().catch(e => { console.error('Backfill error:', e.message); process.exit(1); });
