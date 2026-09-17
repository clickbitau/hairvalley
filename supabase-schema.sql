-- ============================================================================
-- Hair Valley — Production Relational Database Schema & Strict RLS
-- Run this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vtftxeptecafqadktvoy/sql/new
-- ============================================================================

-- 1. Enable UUID Extension if not already available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENTITY DEFINITIONS & RELATIONAL TABLES
-- ============================================================================

-- Table 1: Categories (Parent entity for salon catalog)
CREATE TABLE IF NOT EXISTS public.categories (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(64) UNIQUE NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table 2: Services (Child entity with Foreign Key to Categories)
CREATE TABLE IF NOT EXISTS public.services (
  id VARCHAR(64) PRIMARY KEY,
  category_id VARCHAR(64) NOT NULL REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE CASCADE,
  category_name VARCHAR(120),
  name VARCHAR(180) NOT NULL,
  price VARCHAR(60) NOT NULL,
  original_price VARCHAR(60) DEFAULT '',
  savings VARCHAR(60) DEFAULT '',
  duration VARCHAR(60) DEFAULT '',
  description TEXT DEFAULT '',
  image TEXT DEFAULT 'images/services/cut-ladies.jpg',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index on foreign key for high performance querying
CREATE INDEX IF NOT EXISTS idx_services_category_id ON public.services(category_id);

-- Table 3: Stylists (Atelier Team Members)
CREATE TABLE IF NOT EXISTS public.stylists (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  role VARCHAR(120) NOT NULL,
  tag VARCHAR(60) DEFAULT '',
  craft_years VARCHAR(60) DEFAULT '',
  bio TEXT DEFAULT '',
  image TEXT DEFAULT 'images/stylist-1.jpg',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table 4: Atelier Rituals
CREATE TABLE IF NOT EXISTS public.rituals (
  id VARCHAR(64) PRIMARY KEY,
  movement VARCHAR(60) NOT NULL,
  name VARCHAR(120) NOT NULL,
  duration VARCHAR(120) DEFAULT '',
  description TEXT DEFAULT '',
  image TEXT DEFAULT 'images/ritual-wash.jpg',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table 5: Promotional Offers
CREATE TABLE IF NOT EXISTS public.promos (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  discount VARCHAR(60) DEFAULT '',
  terms TEXT DEFAULT '',
  tag VARCHAR(60) DEFAULT '',
  duration VARCHAR(60) DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table 6: Site Sections (Hero, Atelier, Credo, Contact, Hours)
CREATE TABLE IF NOT EXISTS public.site_sections (
  section_key VARCHAR(64) PRIMARY KEY,
  title TEXT,
  subtitle TEXT,
  eyebrow TEXT,
  quote TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table 7: Unified Master Snapshot (Fast Single-Fetch API Cache)
CREATE TABLE IF NOT EXISTS public.site_content (
  id VARCHAR(32) PRIMARY KEY DEFAULT 'current',
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table 8: Media Assets (Images uploaded to Supabase Storage)
CREATE TABLE IF NOT EXISTS public.media_assets (
  id VARCHAR(128) PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type VARCHAR(64),
  file_size INTEGER DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table 9: Newsletter Subscribers
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(32) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table 10: Admin Profiles (Linked 1-to-1 with auth.users)
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'admin',
  full_name VARCHAR(120),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- AUTOMATED USER PROFILE TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_admin_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.admin_profiles (id, email, role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    'admin',
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_admin_user();

-- ============================================================================
-- STRICT ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stylists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rituals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

-- 1. Categories Policies
DROP POLICY IF EXISTS "Public can view categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;

CREATE POLICY "Public can view categories" ON public.categories
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage categories" ON public.categories
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 2. Services Policies
DROP POLICY IF EXISTS "Public can view services" ON public.services;
DROP POLICY IF EXISTS "Admins can manage services" ON public.services;

CREATE POLICY "Public can view services" ON public.services
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage services" ON public.services
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 3. Stylists Policies
DROP POLICY IF EXISTS "Public can view stylists" ON public.stylists;
DROP POLICY IF EXISTS "Admins can manage stylists" ON public.stylists;

CREATE POLICY "Public can view stylists" ON public.stylists
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage stylists" ON public.stylists
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 4. Rituals Policies
DROP POLICY IF EXISTS "Public can view rituals" ON public.rituals;
DROP POLICY IF EXISTS "Admins can manage rituals" ON public.rituals;

CREATE POLICY "Public can view rituals" ON public.rituals
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage rituals" ON public.rituals
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 5. Promos Policies
DROP POLICY IF EXISTS "Public can view promos" ON public.promos;
DROP POLICY IF EXISTS "Admins can manage promos" ON public.promos;

CREATE POLICY "Public can view promos" ON public.promos
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage promos" ON public.promos
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 6. Site Sections Policies
DROP POLICY IF EXISTS "Public can view site sections" ON public.site_sections;
DROP POLICY IF EXISTS "Admins can manage site sections" ON public.site_sections;

CREATE POLICY "Public can view site sections" ON public.site_sections
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage site sections" ON public.site_sections
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 7. Site Content Master Snapshot Policies
DROP POLICY IF EXISTS "Public can view site content" ON public.site_content;
DROP POLICY IF EXISTS "Admins can manage site content" ON public.site_content;

CREATE POLICY "Public can view site content" ON public.site_content
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage site content" ON public.site_content
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 8. Media Assets Policies
DROP POLICY IF EXISTS "Public can view media assets" ON public.media_assets;
DROP POLICY IF EXISTS "Admins can manage media assets" ON public.media_assets;

CREATE POLICY "Public can view media assets" ON public.media_assets
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage media assets" ON public.media_assets
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 9. Newsletter Subscribers Policies
DROP POLICY IF EXISTS "Anyone can subscribe to newsletter" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Admins can view subscribers" ON public.newsletter_subscribers;

CREATE POLICY "Anyone can subscribe to newsletter" ON public.newsletter_subscribers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view subscribers" ON public.newsletter_subscribers
  FOR SELECT USING (auth.role() = 'authenticated');

-- 10. Admin Profiles Policies
DROP POLICY IF EXISTS "Admins can view profiles" ON public.admin_profiles;
DROP POLICY IF EXISTS "Admins can update own profile" ON public.admin_profiles;

CREATE POLICY "Admins can view profiles" ON public.admin_profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can update own profile" ON public.admin_profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- STORAGE BUCKET & POLICIES FOR 'uploads'
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read uploads bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;

CREATE POLICY "Public read uploads bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'uploads');

CREATE POLICY "Authenticated users can upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'uploads' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'uploads' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'uploads' AND auth.role() = 'authenticated');
