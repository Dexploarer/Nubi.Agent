-- Raid System Database Schema
-- Complete persistence layer for Telegram raids with analytics

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- Raids table: Core raid sessions
CREATE TABLE IF NOT EXISTS raids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    platform VARCHAR(50) DEFAULT 'telegram',
    target_url TEXT NOT NULL,
    target_platform VARCHAR(50), -- twitter, x, instagram, etc.
    status VARCHAR(50) DEFAULT 'active', -- active, completed, cancelled
    
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    scheduled_for TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 30,
    
    -- Metrics
    total_participants INTEGER DEFAULT 0,
    total_engagements INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    
    -- Configuration
    min_participants INTEGER DEFAULT 5,
    max_participants INTEGER DEFAULT 100,
    points_per_action JSONB DEFAULT '{"like": 10, "retweet": 20, "comment": 30}',
    
    -- AI Features
    ai_suggestions TEXT[],
    sentiment_score DECIMAL(3,2),
    engagement_quality_score DECIMAL(3,2),
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    room_id VARCHAR(255),
    team_id UUID,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Raid participants table
CREATE TABLE IF NOT EXISTS raid_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raid_id UUID REFERENCES raids(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    telegram_user_id VARCHAR(255),
    username VARCHAR(255),
    
    -- Participation details
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    role VARCHAR(50) DEFAULT 'participant', -- leader, coordinator, participant
    
    -- Performance metrics
    points INTEGER DEFAULT 0,
    actions_count INTEGER DEFAULT 0,
    engagement_quality DECIMAL(3,2),
    streak_count INTEGER DEFAULT 0,
    
    -- Rewards
    rewards_earned JSONB DEFAULT '[]',
    achievements JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(raid_id, user_id)
);

-- Raid actions table: Track individual actions
CREATE TABLE IF NOT EXISTS raid_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raid_id UUID REFERENCES raids(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES raid_participants(id) ON DELETE CASCADE,
    
    action_type VARCHAR(50) NOT NULL, -- like, retweet, comment, share, etc.
    action_url TEXT,
    points_earned INTEGER DEFAULT 0,
    
    -- Verification
    verified BOOLEAN DEFAULT false,
    verification_method VARCHAR(50), -- api, manual, ai
    
    -- Quality metrics
    quality_score DECIMAL(3,2),
    ai_feedback TEXT,
    
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Raid teams table
CREATE TABLE IF NOT EXISTS raid_teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Team stats
    total_raids INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    average_participants DECIMAL(5,2),
    success_rate DECIMAL(3,2),
    
    -- Configuration
    auto_raid_enabled BOOLEAN DEFAULT false,
    preferred_times JSONB DEFAULT '[]',
    target_platforms TEXT[] DEFAULT '{"twitter"}',
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Raid leaderboard (materialized view for performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS raid_leaderboard AS
SELECT 
    u.id as user_id,
    u.username,
    COUNT(DISTINCT rp.raid_id) as total_raids,
    SUM(rp.points) as total_points,
    AVG(rp.points) as avg_points_per_raid,
    MAX(rp.streak_count) as max_streak,
    COUNT(DISTINCT DATE(rp.joined_at)) as active_days,
    RANK() OVER (ORDER BY SUM(rp.points) DESC) as global_rank
FROM users u
JOIN raid_participants rp ON u.id = rp.user_id
JOIN raids r ON rp.raid_id = r.id
WHERE r.status = 'completed'
GROUP BY u.id, u.username;

-- Create indexes for performance
CREATE INDEX idx_raids_status ON raids(status);
CREATE INDEX idx_raids_started_at ON raids(started_at);
CREATE INDEX idx_raids_session_id ON raids(session_id);
CREATE INDEX idx_raid_participants_user ON raid_participants(user_id);
CREATE INDEX idx_raid_participants_raid ON raid_participants(raid_id);
CREATE INDEX idx_raid_actions_raid ON raid_actions(raid_id);
CREATE INDEX idx_raid_actions_performed ON raid_actions(performed_at);

-- Real-time subscriptions table for Socket.IO
CREATE TABLE IF NOT EXISTS raid_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raid_id UUID REFERENCES raids(id) ON DELETE CASCADE,
    socket_id VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id),
    subscription_type VARCHAR(50) DEFAULT 'participant', -- participant, observer, admin
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_ping TIMESTAMPTZ DEFAULT NOW()
);

-- Raid schedules for automated raids
CREATE TABLE IF NOT EXISTS raid_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES raid_teams(id),
    
    -- Schedule configuration
    schedule_type VARCHAR(50) NOT NULL, -- recurring, one-time
    cron_expression VARCHAR(255), -- For recurring raids
    scheduled_time TIMESTAMPTZ, -- For one-time raids
    
    -- Raid template
    target_url_pattern TEXT,
    duration_minutes INTEGER DEFAULT 30,
    min_participants INTEGER DEFAULT 5,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_executed_at TIMESTAMPTZ,
    next_execution_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Functions for real-time updates
CREATE OR REPLACE FUNCTION notify_raid_update() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('raid_updates', json_build_object(
        'operation', TG_OP,
        'raid_id', NEW.id,
        'session_id', NEW.session_id,
        'status', NEW.status,
        'participants', NEW.total_participants
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER raid_update_trigger
AFTER INSERT OR UPDATE ON raids
FOR EACH ROW EXECUTE FUNCTION notify_raid_update();

-- Function to calculate raid statistics
CREATE OR REPLACE FUNCTION calculate_raid_stats(raid_uuid UUID)
RETURNS TABLE (
    participant_count INTEGER,
    total_points INTEGER,
    avg_points DECIMAL,
    top_performer JSONB,
    engagement_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT rp.user_id)::INTEGER as participant_count,
        SUM(rp.points)::INTEGER as total_points,
        AVG(rp.points)::DECIMAL as avg_points,
        jsonb_build_object(
            'user_id', (SELECT user_id FROM raid_participants WHERE raid_id = raid_uuid ORDER BY points DESC LIMIT 1),
            'username', (SELECT username FROM raid_participants WHERE raid_id = raid_uuid ORDER BY points DESC LIMIT 1),
            'points', (SELECT points FROM raid_participants WHERE raid_id = raid_uuid ORDER BY points DESC LIMIT 1)
        ) as top_performer,
        CASE 
            WHEN COUNT(DISTINCT rp.user_id) > 0 THEN 
                (SUM(rp.actions_count)::DECIMAL / COUNT(DISTINCT rp.user_id))
            ELSE 0
        END as engagement_rate
    FROM raid_participants rp
    WHERE rp.raid_id = raid_uuid;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE raids ENABLE ROW LEVEL SECURITY;
ALTER TABLE raid_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE raid_actions ENABLE ROW LEVEL SECURITY;

-- Policies for raids
CREATE POLICY "Raids are viewable by everyone" ON raids
    FOR SELECT USING (true);

CREATE POLICY "Raids can be created by authenticated users" ON raids
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Raids can be updated by creators" ON raids
    FOR UPDATE USING (created_by = auth.uid() OR auth.uid() IN (
        SELECT user_id FROM raid_participants WHERE raid_id = id AND role = 'leader'
    ));

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Comments for documentation
COMMENT ON TABLE raids IS 'Core raid sessions with configuration and metrics';
COMMENT ON TABLE raid_participants IS 'Track individual participation in raids';
COMMENT ON TABLE raid_actions IS 'Detailed action tracking for engagement verification';
COMMENT ON TABLE raid_teams IS 'Team management for coordinated raids';
COMMENT ON TABLE raid_schedules IS 'Automated raid scheduling system';
