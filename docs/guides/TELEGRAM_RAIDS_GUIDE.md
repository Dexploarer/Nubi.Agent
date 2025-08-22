# Telegram Raids System - Complete Guide

## Overview

The Telegram Raids system is a sophisticated community engagement feature that coordinates group activities, tracks participation, and rewards active members.

## Architecture

### Core Components

```
telegram-raids/
├── raid-coordinator.ts       # Main orchestration
├── raid-tracker.ts          # Progress monitoring
├── raid-flow.ts             # Workflow management
├── user-initiated-raid-flow.ts  # User-triggered raids
├── engagement-verifier.ts    # Participation validation
├── leaderboard-service.ts   # Ranking system
├── chat-lock-manager.ts     # Access control
├── link-detection-service.ts # Link validation
├── raid-moderation-service.ts # Automated moderation
└── advanced-raid-features.ts  # Extended functionality
```

## Raid Types

### 1. Scheduled Raids
- Triggered at predetermined times
- Announced in advance
- Fixed duration
- Specific objectives

### 2. User-Initiated Raids
- Triggered by authorized users
- Dynamic objectives
- Variable duration
- Custom rewards

### 3. Flash Raids
- Spontaneous events
- Short duration (5-15 minutes)
- High engagement requirement
- Bonus rewards

## Raid Flow

### 1. Initialization Phase
```typescript
// Raid starts
const raid = await raidCoordinator.initializeRaid({
  type: 'scheduled',
  targetChannel: '@target_channel',
  duration: 3600, // 1 hour
  minParticipants: 10,
  objectives: ['join', 'message', 'react']
});
```

### 2. Announcement Phase
- Bot announces raid in source channel
- Provides target channel link
- Lists objectives and rewards
- Sets participation rules

### 3. Active Phase
- Participants join target channel
- Complete specified objectives
- Bot tracks all activities
- Real-time progress updates

### 4. Verification Phase
- Engagement verifier validates activities
- Checks for bot/spam behavior
- Calculates participation scores
- Determines eligible participants

### 5. Completion Phase
- Final results announced
- Leaderboard updated
- Rewards distributed
- Stats recorded

## Commands

### Admin Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/raid start` | Initiate a raid | `/raid start @channel 1h` |
| `/raid stop` | End active raid | `/raid stop` |
| `/raid pause` | Pause current raid | `/raid pause` |
| `/raid config` | Configure raid settings | `/raid config min_users 20` |
| `/raid blacklist` | Manage blacklist | `/raid blacklist add @user` |

### User Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/raid status` | Check raid status | `/raid status` |
| `/raid join` | Join active raid | `/raid join` |
| `/raid score` | View your score | `/raid score` |
| `/raid leaderboard` | View rankings | `/raid leaderboard` |
| `/raid help` | Get help | `/raid help` |

## Engagement Verification

### Valid Activities
1. **Channel Join**: User joins target channel
2. **Message Sending**: Posts relevant messages
3. **Reactions**: Adds reactions to posts
4. **Media Sharing**: Shares approved media
5. **Mentions**: Tags other participants

### Scoring System

```typescript
interface ScoreCalculation {
  basePoints: {
    join: 10,
    message: 5,
    reaction: 2,
    media: 8,
    mention: 3
  },
  multipliers: {
    earlyJoiner: 1.5,    // First 10 participants
    consistency: 1.2,     // Active throughout
    quality: 1.3,         // High-quality content
    completion: 2.0       // Completed all objectives
  }
}
```

### Anti-Abuse Measures

1. **Bot Detection**
   - Pattern analysis
   - Timing checks
   - Content similarity
   - API call patterns

2. **Spam Prevention**
   - Message rate limiting
   - Duplicate content detection
   - Minimum message quality
   - Cooldown periods

3. **Fair Play**
   - One account per user
   - IP tracking
   - Device fingerprinting
   - Behavioral analysis

## Leaderboard System

### Ranking Criteria
- Total points earned
- Raids participated
- Success rate
- Consistency score
- Special achievements

### Leaderboard Types
1. **Daily**: Resets every 24 hours
2. **Weekly**: Cumulative weekly scores
3. **Monthly**: Long-term rankings
4. **All-Time**: Historical leaders

### Rewards Structure

```typescript
interface Rewards {
  tiers: {
    gold: { top: 3, reward: 'premium_features' },
    silver: { top: 10, reward: 'badges' },
    bronze: { top: 25, reward: 'points' },
    participant: { all: true, reward: 'experience' }
  }
}
```

## Chat Lock Manager

### Lock Modes

1. **Full Lock**: No messages allowed
2. **Whitelist Only**: Only approved users
3. **Slow Mode**: Rate limited messages
4. **Raid Mode**: Only raid participants

### Implementation

```typescript
// Lock chat during raid
await chatLockManager.lockChat({
  channelId: '@channel',
  mode: 'raid_mode',
  duration: 3600,
  whitelist: ['admin1', 'admin2']
});

// Auto-unlock on completion
await chatLockManager.unlockChat(channelId);
```

## Advanced Features

### 1. Multi-Channel Raids
- Simultaneous raids across channels
- Coordinated objectives
- Cross-channel leaderboards

### 2. Team Raids
- Form teams of participants
- Team-based objectives
- Collaborative scoring
- Team rewards

### 3. Progressive Raids
- Multi-stage objectives
- Increasing difficulty
- Checkpoint system
- Cumulative rewards

### 4. Themed Raids
- Special event raids
- Custom objectives
- Unique rewards
- Limited-time badges

## Configuration

### Environment Variables

```env
# Raid Configuration
RAID_MIN_PARTICIPANTS=10
RAID_MAX_DURATION=7200
RAID_DEFAULT_DURATION=3600
RAID_COOLDOWN_PERIOD=1800

# Scoring Configuration
RAID_BASE_POINTS=10
RAID_MULTIPLIER_EARLY=1.5
RAID_MULTIPLIER_COMPLETE=2.0

# Moderation
RAID_SPAM_THRESHOLD=5
RAID_BOT_DETECTION=true
RAID_IP_TRACKING=false
```

### Database Schema

```sql
-- Raids table
CREATE TABLE raids (
  id UUID PRIMARY KEY,
  type VARCHAR(50),
  status VARCHAR(20),
  target_channel VARCHAR(100),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  participants_count INTEGER,
  metadata JSONB
);

-- Participants table
CREATE TABLE raid_participants (
  raid_id UUID REFERENCES raids(id),
  user_id VARCHAR(100),
  score INTEGER,
  activities JSONB,
  verified BOOLEAN,
  joined_at TIMESTAMP
);

-- Leaderboard table
CREATE TABLE raid_leaderboard (
  user_id VARCHAR(100),
  period VARCHAR(20),
  total_score INTEGER,
  raids_count INTEGER,
  achievements JSONB,
  updated_at TIMESTAMP
);
```

## Monitoring and Analytics

### Metrics Tracked
- Participation rate
- Completion rate
- Average score
- Engagement quality
- Drop-off points
- Peak activity times

### Dashboard Views
- Active raid status
- Real-time participant count
- Live leaderboard
- Objective progress
- Moderation alerts

## Best Practices

1. **Timing**: Schedule raids during peak activity
2. **Duration**: Keep raids between 30-90 minutes
3. **Objectives**: Clear, achievable goals
4. **Rewards**: Meaningful but not excessive
5. **Communication**: Clear announcements and updates
6. **Moderation**: Active monitoring during raids
7. **Feedback**: Collect participant feedback

## Troubleshooting

### Common Issues

1. **Low Participation**
   - Check timing
   - Verify announcements sent
   - Review reward structure

2. **Bot Spam**
   - Enable strict verification
   - Increase detection sensitivity
   - Manual review suspicious accounts

3. **Technical Failures**
   - Check API rate limits
   - Verify database connections
   - Review error logs

### Emergency Procedures

```typescript
// Emergency stop
await raidCoordinator.emergencyStop();

// Rollback scores
await raidTracker.rollbackRaid(raidId);

// Unlock all chats
await chatLockManager.unlockAll();
```

---

*The Telegram Raids system is designed to boost community engagement while maintaining fairness and preventing abuse.*
