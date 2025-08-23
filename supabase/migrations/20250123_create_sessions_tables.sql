-- NUBI ElizaOS Sessions API Migration
-- Creates tables for comprehensive session management with NUBI-specific extensions
-- Compatible with existing Supabase schema and ElizaOS patterns

BEGIN;

-- Create sessions table with ElizaOS compatibility
CREATE TABLE IF NOT EXISTS nubi_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    user_id UUID,
    room_id UUID,
    session_type VARCHAR(50) DEFAULT 'conversation',
    status VARCHAR(20) DEFAULT 'active',
    config JSONB NOT NULL DEFAULT '{}',
    state JSONB NOT NULL DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_session_status CHECK (status IN ('active', 'idle', 'expiring', 'expired')),
    CONSTRAINT valid_session_type CHECK (session_type IN ('conversation', 'raid', 'community')),
    CONSTRAINT valid_expiration CHECK (expires_at > created_at)
);

-- Raid sessions extension table
CREATE TABLE IF NOT EXISTS raid_sessions (
    session_id UUID PRIMARY KEY REFERENCES nubi_sessions(id) ON DELETE CASCADE,
    raid_id VARCHAR(255) NOT NULL UNIQUE,
    target_url TEXT NOT NULL,
    objectives JSONB NOT NULL,
    max_participants INTEGER DEFAULT 500 CHECK (max_participants > 0),
    duration INTEGER NOT NULL CHECK (duration > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_objectives CHECK (jsonb_typeof(objectives) = 'array'),
    CONSTRAINT valid_target_url CHECK (target_url ~ '^https?://.*')
);

-- Raid participants table
CREATE TABLE IF NOT EXISTS raid_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES nubi_sessions(id) ON DELETE CASCADE,
    raid_id VARCHAR(255) NOT NULL,
    telegram_id VARCHAR(255) NOT NULL,
    telegram_username VARCHAR(255) NOT NULL,
    twitter_username VARCHAR(255),
    actions_completed INTEGER DEFAULT 0 CHECK (actions_completed >= 0),
    points_earned INTEGER DEFAULT 0 CHECK (points_earned >= 0),
    verified BOOLEAN DEFAULT false,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_action_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints and indexes
    UNIQUE(raid_id, telegram_id),
    CONSTRAINT valid_telegram_id CHECK (telegram_id != ''),
    CONSTRAINT valid_telegram_username CHECK (telegram_username != '')
);

-- Raid actions tracking table
CREATE TABLE IF NOT EXISTS raid_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raid_id VARCHAR(255) NOT NULL,
    session_id UUID NOT NULL REFERENCES nubi_sessions(id) ON DELETE CASCADE,
    participant_id VARCHAR(255) NOT NULL,
    telegram_username VARCHAR(255) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(255) NOT NULL,
    points_earned INTEGER DEFAULT 0 CHECK (points_earned >= 0),
    verified BOOLEAN DEFAULT false,
    verification_data JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_action_type CHECK (action_type IN ('like', 'retweet', 'reply', 'quote', 'follow')),
    CONSTRAINT valid_target_id CHECK (target_id != ''),
    CONSTRAINT valid_participant_id CHECK (participant_id != '')
);

-- Raid metrics snapshots table
CREATE TABLE IF NOT EXISTS raid_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raid_id VARCHAR(255) NOT NULL,
    session_id UUID NOT NULL,
    snapshot_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_actions INTEGER DEFAULT 0 CHECK (total_actions >= 0),
    unique_participants INTEGER DEFAULT 0 CHECK (unique_participants >= 0),
    completion_rate DECIMAL(5,4) DEFAULT 0 CHECK (completion_rate >= 0 AND completion_rate <= 1),
    average_response_time INTEGER DEFAULT 0 CHECK (average_response_time >= 0),
    success_rate DECIMAL(5,4) DEFAULT 0 CHECK (success_rate >= 0 AND success_rate <= 1),
    engagement_score DECIMAL(8,2) DEFAULT 0 CHECK (engagement_score >= 0),
    time_remaining INTEGER DEFAULT 0 CHECK (time_remaining >= 0),
    additional_metrics JSONB DEFAULT '{}'
);

-- Raid completion reports table
CREATE TABLE IF NOT EXISTS raid_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raid_id VARCHAR(255) NOT NULL UNIQUE,
    session_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL,
    final_metrics JSONB NOT NULL,
    leaderboard JSONB NOT NULL,
    objectives_report JSONB NOT NULL,
    duration INTEGER NOT NULL CHECK (duration > 0),
    participant_count INTEGER NOT NULL CHECK (participant_count >= 0),
    total_points_awarded INTEGER DEFAULT 0 CHECK (total_points_awarded >= 0),
    completion_percentage DECIMAL(5,2) DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_raid_status CHECK (status IN ('completed', 'failed', 'timeout', 'cancelled')),
    CONSTRAINT valid_report_data CHECK (
        jsonb_typeof(final_metrics) = 'object' AND
        jsonb_typeof(leaderboard) = 'array' AND
        jsonb_typeof(objectives_report) = 'array'
    )
);

-- Session activity log table
CREATE TABLE IF NOT EXISTS session_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES nubi_sessions(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    activity_data JSONB DEFAULT '{}',
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_activity_type CHECK (activity_type IN (
        'session_created', 'message_sent', 'message_received', 
        'raid_joined', 'raid_action', 'session_expired', 'session_renewed'
    ))
);

-- Performance indexes for sessions
CREATE INDEX IF NOT EXISTS idx_nubi_sessions_agent_id ON nubi_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_nubi_sessions_user_id ON nubi_sessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nubi_sessions_room_id ON nubi_sessions(room_id) WHERE room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nubi_sessions_status ON nubi_sessions(status);
CREATE INDEX IF NOT EXISTS idx_nubi_sessions_type ON nubi_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_nubi_sessions_expires_at ON nubi_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_nubi_sessions_last_activity ON nubi_sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_nubi_sessions_created_at ON nubi_sessions(created_at);

-- Performance indexes for raids
CREATE INDEX IF NOT EXISTS idx_raid_sessions_raid_id ON raid_sessions(raid_id);
CREATE INDEX IF NOT EXISTS idx_raid_sessions_created_at ON raid_sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_raid_participants_raid_id ON raid_participants(raid_id);
CREATE INDEX IF NOT EXISTS idx_raid_participants_telegram_id ON raid_participants(telegram_id);
CREATE INDEX IF NOT EXISTS idx_raid_participants_session_id ON raid_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_raid_participants_joined_at ON raid_participants(joined_at);
CREATE INDEX IF NOT EXISTS idx_raid_participants_points ON raid_participants(points_earned DESC);

CREATE INDEX IF NOT EXISTS idx_raid_actions_raid_id ON raid_actions(raid_id);
CREATE INDEX IF NOT EXISTS idx_raid_actions_participant ON raid_actions(participant_id);
CREATE INDEX IF NOT EXISTS idx_raid_actions_timestamp ON raid_actions(timestamp);
CREATE INDEX IF NOT EXISTS idx_raid_actions_type ON raid_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_raid_actions_verified ON raid_actions(verified);

CREATE INDEX IF NOT EXISTS idx_raid_metrics_raid_id ON raid_metrics(raid_id);
CREATE INDEX IF NOT EXISTS idx_raid_metrics_timestamp ON raid_metrics(snapshot_time);
CREATE INDEX IF NOT EXISTS idx_raid_metrics_session_id ON raid_metrics(session_id);

CREATE INDEX IF NOT EXISTS idx_raid_reports_raid_id ON raid_reports(raid_id);
CREATE INDEX IF NOT EXISTS idx_raid_reports_status ON raid_reports(status);
CREATE INDEX IF NOT EXISTS idx_raid_reports_completed_at ON raid_reports(completed_at);

CREATE INDEX IF NOT EXISTS idx_session_activity_session_id ON session_activity_log(session_id);
CREATE INDEX IF NOT EXISTS idx_session_activity_type ON session_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_session_activity_timestamp ON session_activity_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_session_activity_user_id ON session_activity_log(user_id) WHERE user_id IS NOT NULL;

-- Row Level Security (RLS) policies for Supabase
ALTER TABLE nubi_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE raid_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE raid_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE raid_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE raid_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE raid_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_activity_log ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (adjust based on your authentication system)
CREATE POLICY "Enable read access for all users" ON nubi_sessions FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON nubi_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for session owners" ON nubi_sessions FOR UPDATE USING (true);

CREATE POLICY "Enable read access for raids" ON raid_sessions FOR SELECT USING (true);
CREATE POLICY "Enable insert for raids" ON raid_sessions FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for participants" ON raid_participants FOR SELECT USING (true);
CREATE POLICY "Enable insert for participants" ON raid_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for participants" ON raid_participants FOR UPDATE USING (true);

CREATE POLICY "Enable read access for actions" ON raid_actions FOR SELECT USING (true);
CREATE POLICY "Enable insert for actions" ON raid_actions FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for metrics" ON raid_metrics FOR SELECT USING (true);
CREATE POLICY "Enable insert for metrics" ON raid_metrics FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for reports" ON raid_reports FOR SELECT USING (true);
CREATE POLICY "Enable insert for reports" ON raid_reports FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for activity log" ON session_activity_log FOR SELECT USING (true);
CREATE POLICY "Enable insert for activity log" ON session_activity_log FOR INSERT WITH CHECK (true);

-- Useful functions for session management
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- Update expired sessions
    UPDATE nubi_sessions 
    SET status = 'expired' 
    WHERE status IN ('active', 'idle') 
    AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Log cleanup activity
    INSERT INTO session_activity_log (session_id, activity_type, activity_data)
    SELECT id, 'session_expired', jsonb_build_object('cleanup_time', NOW())
    FROM nubi_sessions 
    WHERE status = 'expired' 
    AND last_activity < NOW() - INTERVAL '1 hour';
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get raid leaderboard
CREATE OR REPLACE FUNCTION get_raid_leaderboard(
    p_raid_id VARCHAR(255),
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    rank INTEGER,
    telegram_username VARCHAR(255),
    twitter_username VARCHAR(255),
    actions_completed BIGINT,
    points_earned BIGINT,
    success_rate DECIMAL,
    joined_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY SUM(ra.points_earned) DESC, COUNT(ra.id) DESC)::INTEGER as rank,
        rp.telegram_username,
        rp.twitter_username,
        COUNT(ra.id) as actions_completed,
        SUM(ra.points_earned) as points_earned,
        ROUND(AVG(CASE WHEN ra.verified THEN 1 ELSE 0 END), 4) as success_rate,
        rp.joined_at
    FROM raid_participants rp
    LEFT JOIN raid_actions ra ON rp.telegram_id = ra.participant_id AND rp.raid_id = ra.raid_id
    WHERE rp.raid_id = p_raid_id
    GROUP BY rp.telegram_username, rp.twitter_username, rp.joined_at
    ORDER BY points_earned DESC, actions_completed DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get session statistics
CREATE OR REPLACE FUNCTION get_session_stats()
RETURNS TABLE (
    total_sessions BIGINT,
    active_sessions BIGINT,
    raid_sessions BIGINT,
    community_sessions BIGINT,
    avg_session_duration INTERVAL,
    total_participants BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_sessions,
        COUNT(*) FILTER (WHERE status = 'active') as active_sessions,
        COUNT(*) FILTER (WHERE session_type = 'raid') as raid_sessions,
        COUNT(*) FILTER (WHERE session_type = 'community') as community_sessions,
        AVG(CASE WHEN status = 'expired' THEN last_activity - created_at ELSE NULL END) as avg_session_duration,
        (SELECT COUNT(DISTINCT telegram_id) FROM raid_participants) as total_participants
    FROM nubi_sessions;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled task to clean up expired sessions (if using pg_cron)
-- SELECT cron.schedule('cleanup-expired-sessions', '0 */6 * * *', 'SELECT cleanup_expired_sessions();');

COMMIT;

-- Migration completion log
INSERT INTO session_activity_log (
    session_id, 
    activity_type, 
    activity_data
) VALUES (
    gen_random_uuid(), 
    'session_created', 
    jsonb_build_object(
        'migration', '20250123_create_sessions_tables',
        'timestamp', NOW(),
        'description', 'NUBI ElizaOS Sessions API tables created'
    )
);