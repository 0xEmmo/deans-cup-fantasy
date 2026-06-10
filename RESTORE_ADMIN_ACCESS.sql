-- ============================================================================
-- RESTORE ADMIN ACCESS
-- ============================================================================
-- This script will help you restore your admin access
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- Step 1: Check if admin_users table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'admin_users'
);

-- Step 2: If the table exists, see all current admins
SELECT * FROM admin_users;

-- Step 3: See all users in the system to find your ID
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;

-- Step 4: Add yourself as admin (replace 'YOUR-USER-ID' with your actual user ID from step 3)
-- Uncomment the line below and replace YOUR-USER-ID
-- INSERT INTO admin_users (id) VALUES ('YOUR-USER-ID') ON CONFLICT (id) DO NOTHING;

-- Step 5: Verify you're now an admin
SELECT * FROM admin_users;

-- ============================================================================
-- If admin_users table doesn't exist, create it:
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create policy: Only admins can see other admins
DROP POLICY IF EXISTS "Admins can view admin users" ON admin_users;
CREATE POLICY "Admins can view admin users"
  ON admin_users FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can grant admin" ON admin_users;
CREATE POLICY "Admins can grant admin"
  ON admin_users FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- Now add yourself (you'll need to temporarily disable RLS or do this as a superuser)
-- Replace 'YOUR-USER-ID' with your actual user ID
-- INSERT INTO admin_users (id) VALUES ('YOUR-USER-ID') ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- EMERGENCY: If you're completely locked out
-- ============================================================================
-- Temporarily disable RLS to add yourself as admin:

ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- Add yourself (replace YOUR-USER-ID):
-- INSERT INTO admin_users (id) VALUES ('YOUR-USER-ID') ON CONFLICT (id) DO NOTHING;

-- Re-enable RLS:
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Verify:
SELECT * FROM admin_users;
