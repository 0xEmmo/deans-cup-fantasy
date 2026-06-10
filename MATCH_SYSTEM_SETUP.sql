-- ============================================================================
-- DEAN'S CUP FANTASY - MATCH SYSTEM SETUP
-- ============================================================================
-- This script creates all tables needed for match management and events
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- ─── 1. MATCHES TABLE ───────────────────────────────────────────────────────
-- Stores all match information including live status and scores

CREATE TABLE IF NOT EXISTS matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  home_dept TEXT NOT NULL,
  away_dept TEXT NOT NULL,
  home_score INTEGER DEFAULT 0 NOT NULL,
  away_score INTEGER DEFAULT 0 NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'first_half', 'half_time', 'second_half', 'finished')),
  played_at TIMESTAMPTZ NOT NULL,
  half_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_played_at ON matches(played_at DESC);

-- ─── 2. MATCH EVENTS TABLE ──────────────────────────────────────────────────
-- Stores all events that happen during matches (goals, cards, etc.)

CREATE TABLE IF NOT EXISTS match_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  minute INTEGER NOT NULL CHECK (minute > 0 AND minute <= 120),
  event_type TEXT NOT NULL 
    CHECK (event_type IN ('goal', 'assist', 'yellow_card', 'red_card', 
                          'penalty_saved', 'penalty_missed', 'own_goal', 'clean_sheet')),
  player_name TEXT NOT NULL,
  dept TEXT NOT NULL,
  fantasy_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_match_events_match_id ON match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_match_events_minute ON match_events(minute);
CREATE INDEX IF NOT EXISTS idx_match_events_player ON match_events(player_name);

-- ─── 3. TRANSFER WINDOW TABLE ───────────────────────────────────────────────
-- Controls when users can edit teams and which gameweek is active

CREATE TABLE IF NOT EXISTS transfer_window (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_open BOOLEAN DEFAULT FALSE,
  gameweek INTEGER DEFAULT 1 NOT NULL CHECK (gameweek >= 1 AND gameweek <= 38),
  gameweek_locked BOOLEAN DEFAULT FALSE,
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default transfer window state (only if not exists)
INSERT INTO transfer_window (id, is_open, gameweek, gameweek_locked)
VALUES (1, FALSE, 1, FALSE)
ON CONFLICT (id) DO NOTHING;

-- ─── 4. PLAYER PRICES TABLE ─────────────────────────────────────────────────
-- Stores all player information and their prices

CREATE TABLE IF NOT EXISTS player_prices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('GK', 'DEF', 'MID', 'FWD')),
  department TEXT NOT NULL,
  price NUMERIC(10, 1) NOT NULL CHECK (price >= 1.0 AND price <= 20.0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster searches
CREATE INDEX IF NOT EXISTS idx_player_prices_dept ON player_prices(department);
CREATE INDEX IF NOT EXISTS idx_player_prices_pos ON player_prices(position);

-- ─── 5. PLAYER GAMEWEEK POINTS TABLE ────────────────────────────────────────
-- Stores detailed stats and points for each player per gameweek

CREATE TABLE IF NOT EXISTS player_gameweek_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('GK', 'DEF', 'MID', 'FWD')),
  gameweek INTEGER NOT NULL CHECK (gameweek >= 1 AND gameweek <= 38),
  
  -- Match stats
  minutes_played INTEGER DEFAULT 0 CHECK (minutes_played >= 0 AND minutes_played <= 120),
  goals INTEGER DEFAULT 0 CHECK (goals >= 0),
  assists INTEGER DEFAULT 0 CHECK (assists >= 0),
  clean_sheet BOOLEAN DEFAULT FALSE,
  
  -- Discipline
  yellow_cards INTEGER DEFAULT 0 CHECK (yellow_cards >= 0),
  red_cards INTEGER DEFAULT 0 CHECK (red_cards >= 0),
  
  -- Goalkeeper stats
  penalty_saves INTEGER DEFAULT 0 CHECK (penalty_saves >= 0),
  penalty_misses INTEGER DEFAULT 0 CHECK (penalty_misses >= 0),
  shots_saved INTEGER DEFAULT 0 CHECK (shots_saved >= 0),
  goals_conceded INTEGER DEFAULT 0 CHECK (goals_conceded >= 0),
  
  -- Defensive stats
  own_goals INTEGER DEFAULT 0 CHECK (own_goals >= 0),
  cbit INTEGER DEFAULT 0 CHECK (cbit >= 0),
  
  -- Bonus points
  bonus INTEGER DEFAULT 0 CHECK (bonus >= 0 AND bonus <= 3),
  
  -- Total calculated points
  total_points INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one entry per player per gameweek
  UNIQUE(player_id, gameweek)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_player_gw_points_player ON player_gameweek_points(player_id);
CREATE INDEX IF NOT EXISTS idx_player_gw_points_gw ON player_gameweek_points(gameweek);
CREATE INDEX IF NOT EXISTS idx_player_gw_points_total ON player_gameweek_points(total_points DESC);

-- ─── 6. ADMIN USERS TABLE ───────────────────────────────────────────────────
-- Tracks who has admin privileges

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 7. AUTO-UPDATE TRIGGERS ────────────────────────────────────────────────
-- Automatically update updated_at timestamps

-- Matches trigger
CREATE OR REPLACE FUNCTION update_matches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_matches_updated_at_trigger ON matches;
CREATE TRIGGER update_matches_updated_at_trigger
  BEFORE UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION update_matches_updated_at();

-- Transfer window trigger
CREATE OR REPLACE FUNCTION update_transfer_window_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_transfer_window_updated_at_trigger ON transfer_window;
CREATE TRIGGER update_transfer_window_updated_at_trigger
  BEFORE UPDATE ON transfer_window
  FOR EACH ROW
  EXECUTE FUNCTION update_transfer_window_updated_at();

-- Player prices trigger
CREATE OR REPLACE FUNCTION update_player_prices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_player_prices_updated_at_trigger ON player_prices;
CREATE TRIGGER update_player_prices_updated_at_trigger
  BEFORE UPDATE ON player_prices
  FOR EACH ROW
  EXECUTE FUNCTION update_player_prices_updated_at();

-- Player gameweek points trigger
CREATE OR REPLACE FUNCTION update_player_gw_points_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_player_gw_points_updated_at_trigger ON player_gameweek_points;
CREATE TRIGGER update_player_gw_points_updated_at_trigger
  BEFORE UPDATE ON player_gameweek_points
  FOR EACH ROW
  EXECUTE FUNCTION update_player_gw_points_updated_at();

-- ─── 8. ROW LEVEL SECURITY (RLS) ────────────────────────────────────────────
-- Enable RLS on all tables

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_window ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_gameweek_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- ─── 9. RLS POLICIES ────────────────────────────────────────────────────────

-- MATCHES: Everyone can read, only admins can write
DROP POLICY IF EXISTS "Anyone can view matches" ON matches;
CREATE POLICY "Anyone can view matches"
  ON matches FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can insert matches" ON matches;
CREATE POLICY "Admins can insert matches"
  ON matches FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update matches" ON matches;
CREATE POLICY "Admins can update matches"
  ON matches FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete matches" ON matches;
CREATE POLICY "Admins can delete matches"
  ON matches FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- MATCH EVENTS: Everyone can read, only admins can write
DROP POLICY IF EXISTS "Anyone can view match events" ON match_events;
CREATE POLICY "Anyone can view match events"
  ON match_events FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can insert match events" ON match_events;
CREATE POLICY "Admins can insert match events"
  ON match_events FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete match events" ON match_events;
CREATE POLICY "Admins can delete match events"
  ON match_events FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- TRANSFER WINDOW: Everyone can read, only admins can write
DROP POLICY IF EXISTS "Anyone can view transfer window" ON transfer_window;
CREATE POLICY "Anyone can view transfer window"
  ON transfer_window FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can update transfer window" ON transfer_window;
CREATE POLICY "Admins can update transfer window"
  ON transfer_window FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- PLAYER PRICES: Everyone can read, only admins can write
DROP POLICY IF EXISTS "Anyone can view player prices" ON player_prices;
CREATE POLICY "Anyone can view player prices"
  ON player_prices FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can insert player prices" ON player_prices;
CREATE POLICY "Admins can insert player prices"
  ON player_prices FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update player prices" ON player_prices;
CREATE POLICY "Admins can update player prices"
  ON player_prices FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- PLAYER GAMEWEEK POINTS: Everyone can read, only admins can write
DROP POLICY IF EXISTS "Anyone can view player points" ON player_gameweek_points;
CREATE POLICY "Anyone can view player points"
  ON player_gameweek_points FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can insert player points" ON player_gameweek_points;
CREATE POLICY "Admins can insert player points"
  ON player_gameweek_points FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update player points" ON player_gameweek_points;
CREATE POLICY "Admins can update player points"
  ON player_gameweek_points FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- ADMIN USERS: Only admins can see other admins
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

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify everything was created correctly

-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('matches', 'match_events', 'transfer_window', 
                     'player_prices', 'player_gameweek_points', 'admin_users')
ORDER BY table_name;

-- Check transfer window default row exists
SELECT * FROM transfer_window;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('matches', 'match_events', 'transfer_window', 
                    'player_prices', 'player_gameweek_points', 'admin_users');

-- ============================================================================
-- DONE!
-- ============================================================================
-- All tables have been created with proper indexes, RLS, and policies.
-- Next steps:
-- 1. Grant yourself admin access: INSERT INTO admin_users (id) VALUES ('your-user-id');
-- 2. The admin page will now work to create matches, add events, and manage points
-- ============================================================================
