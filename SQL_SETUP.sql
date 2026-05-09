-- SQL Script to create the user_teams table in Supabase
-- Run this in your Supabase SQL Editor

-- Create the user_teams table
CREATE TABLE IF NOT EXISTS user_teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  formation TEXT NOT NULL,
  players JSONB NOT NULL,
  captain_id TEXT NOT NULL,
  total_spent NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create an index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_teams_user_id ON user_teams(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE user_teams ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only view their own teams
CREATE POLICY "Users can view their own teams"
  ON user_teams
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Users can insert their own teams
CREATE POLICY "Users can insert their own teams"
  ON user_teams
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can update their own teams
CREATE POLICY "Users can update their own teams"
  ON user_teams
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can delete their own teams
CREATE POLICY "Users can delete their own teams"
  ON user_teams
  FOR DELETE
  USING (auth.uid() = user_id);

-- Optional: Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update updated_at on row updates
CREATE TRIGGER update_user_teams_updated_at
  BEFORE UPDATE ON user_teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Verify the table was created successfully
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_teams'
ORDER BY ordinal_position;
