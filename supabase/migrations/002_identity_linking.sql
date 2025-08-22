-- Cross-Platform User Identity Linking System
-- Tracks and links user identities across Telegram, Discord, and X platforms

-- Master identity table - represents a unique user across all platforms
CREATE TABLE IF NOT EXISTS user_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id UUID UNIQUE DEFAULT gen_random_uuid(), -- Global unique identifier for the user
  primary_platform TEXT, -- The first/main platform this user was seen on
  display_name TEXT, -- Preferred display name across platforms
  avatar_url TEXT, -- Preferred avatar
  verified BOOLEAN DEFAULT FALSE, -- Whether this identity has been manually verified
  confidence_score FLOAT DEFAULT 50.0, -- Overall confidence in identity links (0-100)
  first_seen TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}', -- Additional metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Platform-specific profiles linked to master identity
CREATE TABLE IF NOT EXISTS platform_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID REFERENCES user_identities(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'telegram', 'discord', 'x'
  platform_user_id TEXT NOT NULL, -- Platform-specific user ID
  username TEXT, -- Platform username/handle
  display_name TEXT, -- Platform display name
  avatar_url TEXT, -- Platform avatar
  bio TEXT, -- User bio/description
  verified BOOLEAN DEFAULT FALSE, -- Platform verification status
  raw_data JSONB DEFAULT '{}', -- Raw platform data
  first_seen TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(platform, platform_user_id)
);

-- Links between platform profiles (with confidence scores)
CREATE TABLE IF NOT EXISTS identity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_profile_id UUID REFERENCES platform_profiles(id) ON DELETE CASCADE,
  target_profile_id UUID REFERENCES platform_profiles(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL, -- 'manual', 'auto_username', 'auto_pattern', 'auto_social', 'auto_temporal'
  confidence FLOAT DEFAULT 50.0, -- Confidence score (0-100)
  evidence JSONB DEFAULT '{}', -- Evidence supporting the link
  verified_by TEXT, -- User who verified (for manual links)
  verified_at TIMESTAMP,
  status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'rejected'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(source_profile_id, target_profile_id)
);

-- Confidence factors for automatic detection
CREATE TABLE IF NOT EXISTS identity_confidence_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID REFERENCES user_identities(id) ON DELETE CASCADE,
  factor_type TEXT NOT NULL, -- 'username_similarity', 'writing_style', 'temporal_correlation', 'topic_consistency', 'social_graph'
  factor_value FLOAT NOT NULL, -- Confidence value (0-100)
  evidence JSONB DEFAULT '{}', -- Supporting evidence
  calculated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(identity_id, factor_type)
);

-- Room associations across platforms
CREATE TABLE IF NOT EXISTS cross_platform_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id TEXT NOT NULL, -- ElizaOS world ID
  room_cluster_id UUID DEFAULT gen_random_uuid(), -- Groups equivalent rooms
  platform TEXT NOT NULL,
  platform_room_id TEXT NOT NULL,
  room_name TEXT,
  room_type TEXT, -- 'channel', 'group', 'dm', 'thread'
  participant_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(platform, platform_room_id)
);

-- User participation in rooms
CREATE TABLE IF NOT EXISTS room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES cross_platform_rooms(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES platform_profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'owner', 'admin', 'moderator', 'member', 'guest'
  joined_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  UNIQUE(room_id, profile_id)
);

-- Identity linking requests (for manual linking)
CREATE TABLE IF NOT EXISTS identity_link_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_profile_id UUID REFERENCES platform_profiles(id) ON DELETE CASCADE,
  target_platform TEXT NOT NULL,
  target_identifier TEXT NOT NULL, -- Username or ID on target platform
  verification_code TEXT, -- Code for verification
  status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'expired', 'rejected'
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '15 minutes'),
  created_at TIMESTAMP DEFAULT NOW(),
  verified_at TIMESTAMP
);

-- Audit log for identity operations
CREATE TABLE IF NOT EXISTS identity_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID REFERENCES user_identities(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'link_created', 'link_removed', 'merge', 'split', 'verification'
  actor_profile_id UUID REFERENCES platform_profiles(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_platform_profiles_identity ON platform_profiles(identity_id);
CREATE INDEX IF NOT EXISTS idx_platform_profiles_platform_user ON platform_profiles(platform, platform_user_id);
CREATE INDEX IF NOT EXISTS idx_identity_links_source ON identity_links(source_profile_id);
CREATE INDEX IF NOT EXISTS idx_identity_links_target ON identity_links(target_profile_id);
CREATE INDEX IF NOT EXISTS idx_identity_links_status ON identity_links(status);
CREATE INDEX IF NOT EXISTS idx_room_participants_profile ON room_participants(profile_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_room ON room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_cross_platform_rooms_cluster ON cross_platform_rooms(room_cluster_id);
CREATE INDEX IF NOT EXISTS idx_identity_audit_log_identity ON identity_audit_log(identity_id);
CREATE INDEX IF NOT EXISTS idx_identity_audit_log_created ON identity_audit_log(created_at);

-- Helper functions for identity management

-- Function to merge two identities
CREATE OR REPLACE FUNCTION merge_identities(
  keep_identity_id UUID,
  merge_identity_id UUID
) RETURNS UUID AS $$
DECLARE
  merged_id UUID;
BEGIN
  -- Update all platform profiles to point to the keep identity
  UPDATE platform_profiles 
  SET identity_id = keep_identity_id 
  WHERE identity_id = merge_identity_id;
  
  -- Update confidence factors
  UPDATE identity_confidence_factors 
  SET identity_id = keep_identity_id 
  WHERE identity_id = merge_identity_id
  ON CONFLICT (identity_id, factor_type) DO NOTHING;
  
  -- Log the merge
  INSERT INTO identity_audit_log (identity_id, action, details)
  VALUES (keep_identity_id, 'merge', jsonb_build_object(
    'merged_from', merge_identity_id,
    'timestamp', NOW()
  ));
  
  -- Delete the merged identity
  DELETE FROM user_identities WHERE id = merge_identity_id;
  
  RETURN keep_identity_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate identity confidence score
CREATE OR REPLACE FUNCTION calculate_identity_confidence(
  p_identity_id UUID
) RETURNS FLOAT AS $$
DECLARE
  confidence FLOAT;
BEGIN
  SELECT AVG(factor_value) INTO confidence
  FROM identity_confidence_factors
  WHERE identity_id = p_identity_id;
  
  -- Update the identity with new confidence score
  UPDATE user_identities 
  SET confidence_score = COALESCE(confidence, 50.0),
      updated_at = NOW()
  WHERE id = p_identity_id;
  
  RETURN COALESCE(confidence, 50.0);
END;
$$ LANGUAGE plpgsql;

-- Function to find similar usernames
CREATE OR REPLACE FUNCTION find_similar_usernames(
  p_username TEXT,
  p_platform TEXT,
  p_threshold FLOAT DEFAULT 0.7
) RETURNS TABLE(
  profile_id UUID,
  platform TEXT,
  username TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pp.id,
    pp.platform,
    pp.username,
    similarity(LOWER(pp.username), LOWER(p_username)) as sim
  FROM platform_profiles pp
  WHERE pp.platform != p_platform
    AND pp.username IS NOT NULL
    AND similarity(LOWER(pp.username), LOWER(p_username)) >= p_threshold
  ORDER BY sim DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Enable similarity extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_identities_updated_at BEFORE UPDATE ON user_identities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_profiles_updated_at BEFORE UPDATE ON platform_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_identity_links_updated_at BEFORE UPDATE ON identity_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cross_platform_rooms_updated_at BEFORE UPDATE ON cross_platform_rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();