-- ============================================
-- SCORING PANAHAN - Database Schema
-- ============================================
-- Tabel: scoring_sessions
-- Tabel: scoring_participants
-- Tabel: scoring_scores
-- ============================================

-- Drop existing objects first (idempotent migration)
DROP TRIGGER IF EXISTS update_scoring_sessions_updated_at ON scoring_sessions;
DROP TRIGGER IF EXISTS update_scoring_scores_updated_at ON scoring_scores;
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS generate_scoring_code();

DROP POLICY IF EXISTS scoring_sessions_admin_read_all ON scoring_sessions;
DROP POLICY IF EXISTS scoring_sessions_admin_create ON scoring_sessions;
DROP POLICY IF EXISTS scoring_sessions_admin_update ON scoring_sessions;
DROP POLICY IF EXISTS scoring_sessions_admin_delete ON scoring_sessions;
DROP POLICY IF EXISTS scoring_sessions_member_read_active ON scoring_sessions;

DROP POLICY IF EXISTS scoring_participants_admin_read_all ON scoring_participants;
DROP POLICY IF EXISTS scoring_participants_admin_all ON scoring_participants;
DROP POLICY IF EXISTS scoring_participants_user_join ON scoring_participants;
DROP POLICY IF EXISTS scoring_participants_user_read_own ON scoring_participants;

DROP POLICY IF EXISTS scoring_scores_admin_read_all ON scoring_scores;
DROP POLICY IF EXISTS scoring_scores_admin_all ON scoring_scores;
DROP POLICY IF EXISTS scoring_scores_user_read_own ON scoring_scores;

DROP VIEW IF EXISTS scoring_session_detail;
DROP VIEW IF EXISTS participant_scores_summary;

-- Drop tables if they exist (for clean re-run)
DROP TABLE IF EXISTS scoring_scores;
DROP TABLE IF EXISTS scoring_participants;
DROP TABLE IF EXISTS scoring_sessions;

-- 1. SCORING SESSIONS
-- Sesi scoring utama yang dibuat admin
CREATE TABLE scoring_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- Nama/Judul Scoring (contoh: "Latihan Panahan Minggu Pagi")
  code TEXT NOT NULL UNIQUE,             -- Kode unik 6 karakter (contoh: "A7K92P")
  arrows_per_round INTEGER NOT NULL DEFAULT 6,   -- Jumlah Arrow per Rambahan
  rounds_per_set INTEGER NOT NULL DEFAULT 5,     -- Jumlah Rambahan per Set
  sets INTEGER NOT NULL DEFAULT 3,               -- Jumlah Set
  status TEXT NOT NULL DEFAULT 'draft',          -- Status: draft, active, completed
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk performa
CREATE INDEX idx_scoring_sessions_code ON scoring_sessions(code);
CREATE INDEX idx_scoring_sessions_created_by ON scoring_sessions(created_by);
CREATE INDEX idx_scoring_sessions_status ON scoring_sessions(status);

-- 2. SCORING PARTICIPANTS
-- Peserta yang bergabung ke session via kode
CREATE TABLE scoring_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES scoring_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- Nama peserta (diambil dari profiles saat join)
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, user_id)            -- Satu user hanya bisa join sekali per session
);

-- Index
CREATE INDEX idx_scoring_participants_session_id ON scoring_participants(session_id);
CREATE INDEX idx_scoring_participants_user_id ON scoring_participants(user_id);

-- 3. SCORING SCORES
-- Nilai detail per arrow per peserta
CREATE TABLE scoring_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES scoring_participants(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,           -- Set ke- (1, 2, 3...)
  round_number INTEGER NOT NULL,         -- Rambahan ke- (1, 2, 3...)
  arrow_number INTEGER NOT NULL,         -- Arrow ke- (1, 2, 3...)
  score INTEGER NOT NULL DEFAULT 0,      -- Nilai arrow (0-10, atau 0 untuk miss)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_id, set_number, round_number, arrow_number)
);

-- Index
CREATE INDEX idx_scoring_scores_participant_id ON scoring_scores(participant_id);
CREATE INDEX idx_scoring_scores_participant_set_round ON scoring_scores(participant_id, set_number, round_number);

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Trigger: auto update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scoring_sessions_updated_at
  BEFORE UPDATE ON scoring_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scoring_scores_updated_at
  BEFORE UPDATE ON scoring_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function: Generate unique 6-char code
CREATE OR REPLACE FUNCTION generate_scoring_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Exclude O, 0, 1, I for clarity
  code_len INT := 6;
  attempt INT := 0;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..code_len LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    -- Check if code already exists
    IF NOT EXISTS (SELECT 1 FROM scoring_sessions WHERE code = generate_scoring_code.code) THEN
      RETURN code;
    END IF;
    
    attempt := attempt + 1;
    IF attempt > 10 THEN
      -- Fallback: add timestamp suffix
      RETURN substr(code, 1, 4) || substr(md5(random()::text || clock_timestamp()::text), 1, 2);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE scoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_scores ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICIES: scoring_sessions
-- ============================================

-- Admin can read all sessions (using SECURITY DEFINER function to avoid recursion)
CREATE POLICY scoring_sessions_admin_read_all ON scoring_sessions
  FOR SELECT USING (is_admin_user());

-- Admin can create sessions
CREATE POLICY scoring_sessions_admin_create ON scoring_sessions
  FOR INSERT WITH CHECK (is_admin_user());

-- Admin can update own sessions (or all if admin)
CREATE POLICY scoring_sessions_admin_update ON scoring_sessions
  FOR UPDATE USING (is_admin_user() OR created_by = auth.uid());

-- Admin can delete own sessions (or all if admin)
CREATE POLICY scoring_sessions_admin_delete ON scoring_sessions
  FOR DELETE USING (is_admin_user() OR created_by = auth.uid());

-- Member can read active sessions (for joining)
CREATE POLICY scoring_sessions_member_read_active ON scoring_sessions
  FOR SELECT USING (status = 'active');

-- ============================================
-- POLICIES: scoring_participants
-- ============================================

-- Admin can read all participants
CREATE POLICY scoring_participants_admin_read_all ON scoring_participants
  FOR SELECT USING (is_admin_user());

-- Admin can manage participants (for manual add/remove if needed)
CREATE POLICY scoring_participants_admin_all ON scoring_participants
  FOR ALL USING (is_admin_user());

-- User can insert themselves as participant (join session)
CREATE POLICY scoring_participants_user_join ON scoring_participants
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM scoring_sessions 
      WHERE id = session_id 
      AND status = 'active'
    )
  );

-- User can read their own participation
CREATE POLICY scoring_participants_user_read_own ON scoring_participants
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- POLICIES: scoring_scores
-- ============================================

-- Admin can read all scores
CREATE POLICY scoring_scores_admin_read_all ON scoring_scores
  FOR SELECT USING (is_admin_user());

-- Admin can manage all scores (input/edit/delete)
CREATE POLICY scoring_scores_admin_all ON scoring_scores
  FOR ALL USING (is_admin_user());

-- User can read their own scores
CREATE POLICY scoring_scores_user_read_own ON scoring_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM scoring_participants 
      WHERE id = scoring_scores.participant_id 
      AND user_id = auth.uid()
    )
  );

-- ============================================
-- VIEW: Scoring Session Detail (for admin)
-- ============================================

CREATE OR REPLACE VIEW scoring_session_detail AS
SELECT 
  ss.id,
  ss.name,
  ss.code,
  ss.arrows_per_round,
  ss.rounds_per_set,
  ss.sets,
  ss.status,
  ss.created_by,
  ss.created_at,
  ss.updated_at,
  p.name AS creator_name,
  p.email AS creator_email,
  COUNT(DISTINCT sp.id) AS participant_count,
  COUNT(DISTINCT sc.id) AS total_scores_entered
FROM scoring_sessions ss
JOIN profiles p ON ss.created_by = p.id
LEFT JOIN scoring_participants sp ON ss.id = sp.session_id
LEFT JOIN scoring_scores sc ON sp.id = sc.participant_id
GROUP BY ss.id, ss.name, ss.code, ss.arrows_per_round, ss.rounds_per_set, ss.sets, ss.status, ss.created_by, ss.created_at, ss.updated_at, p.name, p.email;

-- ============================================
-- VIEW: Participant Scores Summary
-- ============================================

CREATE OR REPLACE VIEW participant_scores_summary AS
SELECT 
  sp.id AS participant_id,
  sp.session_id,
  sp.user_id,
  sp.name,
  sp.joined_at,
  ss.name AS session_name,
  ss.code AS session_code,
  ss.arrows_per_round,
  ss.rounds_per_set,
  ss.sets,
  -- Total score per set
  COALESCE(SUM(CASE WHEN sc.set_number = 1 THEN sc.score ELSE 0 END), 0) AS set_1_total,
  COALESCE(SUM(CASE WHEN sc.set_number = 2 THEN sc.score ELSE 0 END), 0) AS set_2_total,
  COALESCE(SUM(CASE WHEN sc.set_number = 3 THEN sc.score ELSE 0 END), 0) AS set_3_total,
  COALESCE(SUM(CASE WHEN sc.set_number = 4 THEN sc.score ELSE 0 END), 0) AS set_4_total,
  COALESCE(SUM(CASE WHEN sc.set_number = 5 THEN sc.score ELSE 0 END), 0) AS set_5_total,
  COALESCE(SUM(CASE WHEN sc.set_number = 6 THEN sc.score ELSE 0 END), 0) AS set_6_total,
  COALESCE(SUM(CASE WHEN sc.set_number = 7 THEN sc.score ELSE 0 END), 0) AS set_7_total,
  COALESCE(SUM(CASE WHEN sc.set_number = 8 THEN sc.score ELSE 0 END), 0) AS set_8_total,
  COALESCE(SUM(CASE WHEN sc.set_number = 9 THEN sc.score ELSE 0 END), 0) AS set_9_total,
  COALESCE(SUM(CASE WHEN sc.set_number = 10 THEN sc.score ELSE 0 END), 0) AS set_10_total,
  -- Grand total
  COALESCE(SUM(sc.score), 0) AS grand_total,
  -- Progress: count of arrows entered vs total expected
  COUNT(sc.id) AS arrows_entered,
  (ss.arrows_per_round * ss.rounds_per_set * ss.sets) AS total_arrows_expected
FROM scoring_participants sp
JOIN scoring_sessions ss ON sp.session_id = ss.id
LEFT JOIN scoring_scores sc ON sp.id = sc.participant_id
GROUP BY sp.id, sp.session_id, sp.user_id, sp.name, sp.joined_at, ss.name, ss.code, ss.arrows_per_round, ss.rounds_per_set, ss.sets;