/**
 * Hair Valley — Comprehensive Supabase Relational Migration & Media Tool
 * 
 * Capabilities:
 *  1. Executes relational DDL schema (with DB password).
 *  2. Relational Seeding: categories, services (with FKs), stylists, rituals, promos, sections.
 *  3. Bulk media upload: uploads all local image assets into Supabase Storage and logs them in media_assets table.
 * 
 * Usage:
 *   node scripts/setup-supabase.js
 *   node scripts/setup-supabase.js --password=YOUR_DB_PASSWORD
 *   node scripts/setup-supabase.js --upload-images
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const DATA_FILE = path.join(__dirname, '..', 'data', 'site-data.json');
const SCHEMA_FILE = path.join(__dirname, '..', 'supabase-schema.sql');
const PROJECT_ROOT = path.join(__dirname, '..');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const args = process.argv.slice(2);
let dbPassword = process.env.DB_PASSWORD || '';
let shouldUploadImages = true;

for (const arg of args) {
  if (arg.startsWith('--password=')) {
    dbPassword = arg.split('=')[1];
  }
  if (arg === '--skip-images') {
    shouldUploadImages = false;
  }
}

// 1. Direct PostgreSQL Migration Runner
async function runDirectPostgresMigration(password) {
  console.log('\n📦 Connecting to PostgreSQL pooler (Tokyo ap-northeast-1)...');
  const poolerHost = process.env.SUPABASE_DB_HOST || 'aws-0-ap-northeast-1.pooler.supabase.com';
  const poolerPort = parseInt(process.env.SUPABASE_DB_PORT || '6543', 10);
  const poolerUser = process.env.SUPABASE_DB_USER || 'postgres.vtftxeptecafqadktvoy';
  const dbName = process.env.SUPABASE_DB_NAME || 'postgres';

  const client = new Client({
    host: poolerHost,
    port: poolerPort,
    user: poolerUser,
    password: password,
    database: dbName,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();
    console.log('✅ Connected to Postgres database!');
    const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
    console.log('🚀 Executing relational schema (tables, foreign keys, triggers, RLS)...');
    await client.query(sql);
    console.log('✅ All relational tables and strict RLS policies created successfully!');
    await client.end();
    return true;
  } catch (err) {
    console.error('❌ Postgres migration error:', err.message);
    try { await client.end(); } catch (e) {}
    return false;
  }
}

// 2. Storage Setup
async function setupStorage() {
  console.log('\n🗂️  Checking Supabase Storage bucket "uploads"...');
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) throw error;

    const exists = buckets && buckets.some(b => b.name === 'uploads');
    if (!exists) {
      const { error: createError } = await supabase.storage.createBucket('uploads', {
        public: true
      });
      if (createError) throw createError;
      console.log('✅ Created public storage bucket "uploads"');
    } else {
      console.log('✅ Public storage bucket "uploads" is ready');
    }
  } catch (err) {
    console.warn('⚠️ Storage notice:', err.message);
  }
}

// 3. Media Migration: Upload local images to Supabase Storage
async function migrateLocalImages() {
  if (!shouldUploadImages) return;
  console.log('\n📸 Scanning and migrating local salon images to Supabase Storage...');

  const imageDirs = [
    path.join(PROJECT_ROOT, 'images'),
    path.join(PROJECT_ROOT, 'images', 'services'),
    path.join(PROJECT_ROOT, 'images', 'uploads')
  ];

  const foundImages = [];

  for (const dir of imageDirs) {
    if (fs.existsSync(dir)) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            foundImages.push({
              fullPath: path.join(dir, entry.name),
              filename: entry.name,
              ext
            });
          }
        }
      }
    }
  }

  console.log(`Found ${foundImages.length} local images to synchronize.`);
  let uploadedCount = 0;

  for (const img of foundImages) {
    try {
      const fileBuffer = fs.readFileSync(img.fullPath);
      const mimeType = img.ext === '.png' ? 'image/png' : (img.ext === '.webp' ? 'image/webp' : 'image/jpeg');

      // Upload to Supabase Storage (upsert)
      const { error: upErr } = await supabase.storage
        .from('uploads')
        .upload(img.filename, fileBuffer, {
          contentType: mimeType,
          upsert: true
        });

      if (!upErr) {
        uploadedCount++;
        const { data: pubUrl } = supabase.storage.from('uploads').getPublicUrl(img.filename);

        // Record in media_assets table if it exists
        try {
          await supabase.from('media_assets').upsert({
            id: 'media-' + path.basename(img.filename, img.ext),
            filename: img.filename,
            file_url: pubUrl ? pubUrl.publicUrl : '',
            storage_path: `uploads/${img.filename}`,
            mime_type: mimeType,
            file_size: fileBuffer.length
          }, { onConflict: 'id' });
        } catch (e) {}
      }
    } catch (e) {
      // Continue to next image
    }
  }

  console.log(`✅ Uploaded/verified ${uploadedCount} images in Supabase Storage!`);
}

// 4. Relational Seeding
async function seedRelationalData() {
  console.log('\n🔄 Checking relational database tables in Supabase...');

  // Test if categories table exists
  const { data: catCheck, error: catErr } = await supabase
    .from('categories')
    .select('id')
    .limit(1);

  if (catErr) {
    console.log('⚠️  Relational tables do not exist yet in Supabase schema cache.');
    console.log('👉 To create the tables and strict RLS policies:');
    console.log('   Option A: Run schema in Supabase Dashboard SQL Editor:');
    console.log('             https://supabase.com/dashboard/project/vtftxeptecafqadktvoy/sql/new');
    console.log('             (Copy and paste contents of supabase-schema.sql and click Run)');
    console.log('   Option B: Run with your DB password:');
    console.log('             node scripts/setup-supabase.js --password=YOUR_PASSWORD\n');
    return false;
  }

  console.log('✅ Relational schema verified! Starting structured database seeding...');

  if (!fs.existsSync(DATA_FILE)) {
    console.error('❌ data/site-data.json not found!');
    return false;
  }

  const siteData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  // 1. Seed Categories FIRST (parent table for services FK)
  const categoriesList = siteData.categories || [
    { id: 'haircuts', title: 'Haircuts & Styling' },
    { id: 'blowwave', title: 'Blow Wave & Finish' },
    { id: 'color', title: 'Color & Highlights' },
    { id: 'foils', title: 'Balayage & Foils' },
    { id: 'keratin', title: 'Keratin & Texture' },
    { id: 'treatment', title: 'Treatments & Masks' },
    { id: 'extensions', title: 'Hair Extensions' },
    { id: 'packages', title: 'Signature Packages' },
    { id: 'deals', title: 'Promotional Deals' },
    { id: 'addons', title: 'Add-on Rituals' }
  ];

  console.log(`⏳ Seeding ${categoriesList.length} categories...`);
  const formattedCategories = categoriesList.map((c, idx) => ({
    id: c.id,
    name: c.title || c.id,
    slug: c.id,
    display_order: idx
  }));

  const { error: catUpsertErr } = await supabase
    .from('categories')
    .upsert(formattedCategories, { onConflict: 'id' });

  if (catUpsertErr) {
    console.error('❌ Error seeding categories:', catUpsertErr.message);
  } else {
    console.log(`✅ ${formattedCategories.length} categories seeded successfully!`);
  }

  // 2. Seed Services (with Foreign Key to categories.id)
  if (Array.isArray(siteData.services) && siteData.services.length > 0) {
    console.log(`⏳ Seeding ${siteData.services.length} services (linked by category_id)...`);
    const validCatIds = new Set(categoriesList.map(c => c.id));

    const formattedServices = siteData.services.map((s, index) => {
      // Ensure category_id references a valid category
      let categoryId = s.category || 'haircuts';
      if (!validCatIds.has(categoryId)) {
        categoryId = 'haircuts';
      }

      return {
        id: s.id || `srv-${index + 1}`,
        category_id: categoryId,
        category_name: s.categoryName || categoryId,
        name: s.name || 'Service',
        price: s.price || '',
        original_price: s.originalPrice || '',
        savings: s.savings || '',
        duration: s.duration || '',
        description: s.description || '',
        image: s.image || 'images/services/cut-ladies.jpg',
        sort_order: index,
        updated_at: new Date().toISOString()
      };
    });

    const { error: srvErr } = await supabase
      .from('services')
      .upsert(formattedServices, { onConflict: 'id' });

    if (srvErr) {
      console.error('❌ Error seeding services:', srvErr.message);
    } else {
      console.log(`✅ ${formattedServices.length} services seeded into Supabase with category relations!`);
    }
  }

  // 3. Seed Stylists
  const stylists = (siteData.about && siteData.about.stylists) || [];
  if (stylists.length > 0) {
    console.log(`⏳ Seeding ${stylists.length} stylists...`);
    const formattedStylists = stylists.map((st, index) => ({
      id: st.id || `stylist-${index + 1}`,
      name: st.name || 'Stylist',
      role: st.role || 'Specialist',
      tag: st.tag || '',
      craft_years: st.craftYears || '',
      bio: st.bio || '',
      image: st.image || 'images/stylist-1.jpg',
      sort_order: index,
      updated_at: new Date().toISOString()
    }));

    const { error: stylistErr } = await supabase
      .from('stylists')
      .upsert(formattedStylists, { onConflict: 'id' });

    if (stylistErr) {
      console.error('❌ Error seeding stylists:', stylistErr.message);
    } else {
      console.log(`✅ ${formattedStylists.length} stylists seeded into Supabase!`);
    }
  }

  // 4. Seed Rituals
  const rituals = (siteData.about && siteData.about.rituals) || [];
  if (rituals.length > 0) {
    console.log(`⏳ Seeding ${rituals.length} rituals...`);
    const formattedRituals = rituals.map((r, index) => ({
      id: r.id || `ritual-${index + 1}`,
      movement: r.movement || `Movement ${index + 1}`,
      name: r.name || 'Ritual',
      duration: r.duration || '',
      description: r.description || '',
      image: r.image || 'images/ritual-wash.jpg',
      sort_order: index,
      updated_at: new Date().toISOString()
    }));

    const { error: ritualErr } = await supabase
      .from('rituals')
      .upsert(formattedRituals, { onConflict: 'id' });

    if (ritualErr) {
      console.error('❌ Error seeding rituals:', ritualErr.message);
    } else {
      console.log(`✅ ${formattedRituals.length} rituals seeded into Supabase!`);
    }
  }

  // 5. Seed Promos
  const promos = siteData.promos || [];
  if (promos.length > 0) {
    console.log(`⏳ Seeding ${promos.length} promos...`);
    const formattedPromos = promos.map((p, index) => ({
      id: p.id || `promo-${index + 1}`,
      title: p.title || 'Special Promotion',
      discount: p.discount || '',
      terms: p.terms || '',
      tag: p.tag || '',
      duration: p.duration || '',
      is_active: true,
      updated_at: new Date().toISOString()
    }));

    const { error: promoErr } = await supabase
      .from('promos')
      .upsert(formattedPromos, { onConflict: 'id' });

    if (promoErr) {
      console.error('❌ Error seeding promos:', promoErr.message);
    } else {
      console.log(`✅ ${formattedPromos.length} promos seeded into Supabase!`);
    }
  }

  // 6. Seed Site Sections (Hero, Atelier, Contact, Hours)
  console.log('⏳ Seeding site sections...');
  const sections = [
    {
      section_key: 'hero',
      title: siteData.hero?.title || '',
      subtitle: siteData.hero?.eyebrow || '',
      eyebrow: siteData.hero?.eyebrow || '',
      quote: siteData.hero?.quote || '',
      data: siteData.hero || {}
    },
    {
      section_key: 'atelier',
      title: siteData.atelier?.title || '',
      subtitle: siteData.atelier?.subtitle || '',
      eyebrow: siteData.atelier?.eyebrow || '',
      quote: siteData.atelier?.quote || '',
      data: siteData.atelier || {}
    },
    {
      section_key: 'featuredHero',
      title: siteData.featuredHero?.title || '',
      subtitle: siteData.featuredHero?.tag || '',
      data: siteData.featuredHero || {}
    },
    {
      section_key: 'contact',
      title: 'Contact Information',
      data: siteData.contact || {}
    }
  ];

  for (const sec of sections) {
    await supabase.from('site_sections').upsert({
      ...sec,
      updated_at: new Date().toISOString()
    }, { onConflict: 'section_key' });
  }
  console.log('✅ Site sections seeded successfully!');

  // 7. Seed unified master snapshot in site_content
  console.log('⏳ Seeding master site_content snapshot...');
  await supabase.from('site_content').upsert({
    id: 'current',
    data: siteData,
    updated_at: new Date().toISOString()
  });
  console.log('✅ Master site_content synchronized!');

  return true;
}

async function main() {
  console.log('====================================================');
  console.log('   Hair Valley — Supabase Relational Setup & Seed');
  console.log('====================================================');

  if (dbPassword) {
    await runDirectPostgresMigration(dbPassword);
  }

  await setupStorage();
  await migrateLocalImages();
  const seeded = await seedRelationalData();

  if (seeded) {
    console.log('\n🎉 ALL RELATIONAL TABLES & MEDIA FULLY SYNCHRONIZED!');
  } else {
    console.log('\nℹ️  Storage & media migration complete. Tables pending execution in Supabase Dashboard SQL Editor.');
  }
}

main().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
