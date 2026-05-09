# Database Setup for Authentication

This document describes the database schema needed for the authentication system to work properly.

## Required Tables

### 1. Departments Table

First, create a `departments` table to store the available departments/faculties:

```sql
CREATE TABLE public.departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert the dummy departments
INSERT INTO public.departments (id, name) VALUES
  (1, 'Philosophy'),
  (2, 'Engineering'),
  (3, 'Law'),
  (4, 'Medicine'),
  (5, 'Business Administration'),
  (6, 'Computer Science'),
  (7, 'Arts and Humanities'),
  (8, 'Natural Sciences'),
  (9, 'Social Sciences'),
  (10, 'Education');
```

### 2. Users Table

Create a `users` table to store additional user profile information:

```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  department_id INTEGER REFERENCES public.departments(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Allow users to read their own data
CREATE POLICY "Users can view own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Allow users to update their own data
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

-- Allow authenticated users to insert their profile (for registration)
CREATE POLICY "Users can insert own profile"
  ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);
```

### 3. Enable Email Confirmations (Optional)

In your Supabase dashboard:
1. Go to Authentication → Settings
2. Configure email templates as needed
3. You can disable email confirmation for development by turning off "Enable email confirmations"

## Environment Variables

Make sure your `.env.local` file contains:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Testing the Authentication

1. Start the development server: `npm run dev`
2. Navigate to `/auth`
3. Try registering a new account with:
   - Name
   - Email
   - Password (minimum 6 characters)
   - Department selection
4. Check your email for confirmation (if enabled)
5. Try logging in with your credentials

## Notes

- The `users` table uses the same UUID as the `auth.users` table for the primary key
- When a user registers, their auth record is created first, then their profile is inserted into the `users` table
- Row Level Security (RLS) ensures users can only access their own data
- The department_id is stored as an integer reference to the departments table