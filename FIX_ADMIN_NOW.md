# Quick Fix: Restore Admin Access

## What Happened
The admin page checks if you exist in the `admin_users` table. Something went wrong with that table.

## Quick Fix (5 minutes)

### Option 1: Run These Commands in Supabase SQL Editor

**Step 1:** Find your user ID
```sql
SELECT id, email FROM auth.users;
```
Copy your user ID (the long string next to your email)

**Step 2:** Temporarily disable RLS and add yourself
```sql
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

INSERT INTO admin_users (id) 
VALUES ('PASTE-YOUR-USER-ID-HERE') 
ON CONFLICT (id) DO NOTHING;

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
```

**Step 3:** Verify it worked
```sql
SELECT * FROM admin_users;
```
You should see your user ID in the results.

**Step 4:** Refresh your `/admin` page - you should have access now!

---

### Option 2: If admin_users Table Doesn't Exist

If you get an error that `admin_users` doesn't exist, create it first:

```sql
-- Create the table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Don't enable RLS yet, add yourself first
INSERT INTO admin_users (id) VALUES ('YOUR-USER-ID-HERE');

-- Now enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Admins can view admin users"
  ON admin_users FOR SELECT
  USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

CREATE POLICY "Admins can grant admin"
  ON admin_users FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));
```

---

### Option 3: Nuclear Option - Temporary Bypass (Testing Only)

If you just want to test without the database hassle, temporarily comment out the admin check:

In `app/admin/page.tsx` around line 540, change:
```typescript
// BEFORE (current code):
const { data: adminRow } = await supabase.from('admin_users').select('id').eq('id', authUser.id).single();
if (!adminRow) { setLoading(false); return; }
setIsAdmin(true);

// AFTER (temporary bypass):
// const { data: adminRow } = await supabase.from('admin_users').select('id').eq('id', authUser.id).single();
// if (!adminRow) { setLoading(false); return; }
setIsAdmin(true); // Everyone is admin now (TESTING ONLY!)
```

**⚠️ WARNING:** This makes everyone an admin. Only use for testing, then revert it!

---

## Recommended Approach

Use **Option 1** - it's the cleanest and proper way to restore your access.

1. Go to Supabase Dashboard
2. Click "SQL Editor"  
3. Run the commands from Option 1
4. Refresh `/admin`
5. You're back in!
