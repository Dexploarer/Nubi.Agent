# UX Flows and State Machines

## Complete User Experience Flows

### 1. First-Time User Onboarding Flow

```ascii
┌──────────────────────────────────────────────────────────────────────┐
│                     FIRST-TIME USER ONBOARDING                        │
└──────────────────────────────────────────────────────────────────────┘

START
  │
  ▼
[User Joins Channel]
  │
  ├──► Platform Detection ──┐
  │                          │
  │    ┌────────────────────┼────────────────────┐
  │    │                    │                    │
  │    ▼                    ▼                    ▼
  │ Telegram             Discord             Twitter
  │    │                    │                    │
  │    └────────────────────┼────────────────────┘
  │                         │
  ▼                         ▼
[NUBI Detects New User] ◄───┘
  │
  ├──► Generate Welcome Message
  │    • Personalized greeting
  │    • Platform-specific tips
  │    • Available commands
  │
  ▼
[Send Welcome DM]
  │
  ├──► Wait for Response
  │
  ├──────[No Response]──────► Set Passive Mode
  │                           • Monitor activity
  │                           • Wait for engagement
  │
  ├──────[User Responds]────► Interactive Mode
  │
  ▼
[Personality Assessment]
  │
  ├──► Ask Preference Questions
  │    1. "Technical or casual?"
  │    2. "Market focus?"
  │    3. "Raid interest?"
  │
  ▼
[Store User Preferences]
  │
  ├──► Create User Profile
  │    • ID linking
  │    • Preference storage
  │    • Session creation
  │
  ▼
[Tutorial Offer]
  │
  ├──[Accept]──► Interactive Tutorial
  │              • Show commands
  │              • Demo features
  │              • Mini raid
  │
  ├──[Decline]─► Mark as Onboarded
  │
  ▼
[Regular User State]
END
```

### 2. Message Interaction State Machine

```ascii
┌──────────────────────────────────────────────────────────────────────┐
│                    MESSAGE INTERACTION STATE MACHINE                  │
└──────────────────────────────────────────────────────────────────────┘

                            ┌─────────────┐
                            │    IDLE     │
                            └──────┬──────┘
                                   │
                          [Message Received]
                                   │
                            ┌──────▼──────┐
                            │  ANALYZING  │
                            └──────┬──────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
            [Direct Mention]  [Contextual]  [Background]
                    │              │              │
            ┌───────▼──────┐ ┌────▼────┐ ┌──────▼──────┐
            │   PRIORITY   │ │  QUEUE  │ │   MONITOR   │
            └───────┬──────┘ └────┬────┘ └──────┬──────┘
                    │              │              │
                    └──────────────┼──────────────┘
                                   │
                            ┌──────▼──────┐
                            │  PROCESSING │
                            └──────┬──────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
              [Generate]      [Tool Call]    [Escalate]
                    │              │              │
            ┌───────▼──────┐ ┌────▼────┐ ┌──────▼──────┐
            │   COMPOSE    │ │ EXECUTE │ │   FORWARD   │
            └───────┬──────┘ └────┬────┘ └──────┬──────┘
                    │              │              │
                    └──────────────┼──────────────┘
                                   │
                            ┌──────▼──────┐
                            │   RESPOND   │
                            └──────┬──────┘
                                   │
                            ┌──────▼──────┐
                            │   FOLLOW-UP │
                            │  MONITORING │
                            └──────┬──────┘
                                   │
                           [Timeout/Complete]
                                   │
                            ┌──────▼──────┐
                            │    IDLE     │
                            └─────────────┘
```

### 3. Raid Participation Journey

```ascii
┌──────────────────────────────────────────────────────────────────────┐
│                      RAID PARTICIPATION JOURNEY                       │
└──────────────────────────────────────────────────────────────────────┘

[Raid Announcement]
       │
       ▼
┌─────────────┐
│ NOTIFICATION│───► Push Notification
│   PHASE     │     • @mentions
└──────┬──────┘     • DM alerts
       │
       ▼
┌─────────────┐
│ DECISION    │
│   PHASE     │
└──────┬──────┘
       │
   ┌───┴───┐
   │       │
  YES     NO ──────► [Monitor Only]
   │                      │
   ▼                      │
┌─────────────┐           │
│    JOIN     │           │
│   PHASE     │           │
└──────┬──────┘           │
       │                  │
       ▼                  │
┌─────────────┐           │
│   ACTIVE    │◄──────────┘
│   PHASE     │
├─────────────┤
│ • Messages  │
│ • Reactions │
│ • Shares    │
│ • Invites   │
└──────┬──────┘
       │
   [Progress Bar]
   ■■■■■□□□□□ 50%
       │
       ▼
┌─────────────┐
│ VERIFICATION│
│   PHASE     │
└──────┬──────┘
       │
   ┌───┴───┐
   │       │
 PASS    FAIL ──────► [Review Required]
   │                      │
   ▼                      ▼
┌─────────────┐    ┌─────────────┐
│   REWARD    │    │   PENALTY   │
│   PHASE     │    │   PHASE     │
└──────┬──────┘    └──────┬──────┘
       │                  │
       └──────┬───────────┘
              │
              ▼
       ┌─────────────┐
       │ LEADERBOARD │
       │   UPDATE    │
       └─────────────┘
```

### 4. Multi-Platform Identity Flow

```ascii
┌──────────────────────────────────────────────────────────────────────┐
│                    MULTI-PLATFORM IDENTITY FLOW                       │
└──────────────────────────────────────────────────────────────────────┘

     Telegram User              Discord User              Twitter User
          │                          │                          │
          ▼                          ▼                          ▼
    ┌──────────┐              ┌──────────┐              ┌──────────┐
    │ Platform │              │ Platform │              │ Platform │
    │    ID    │              │    ID    │              │    ID    │
    └────┬─────┘              └────┬─────┘              └────┬─────┘
         │                          │                          │
         └──────────────┬───────────┴──────────────────────────┘
                        │
                        ▼
                ┌───────────────┐
                │   Identity    │
                │   Resolver    │
                └───────┬───────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   [Email Hash]   [Behavior]      [Manual]
    Matching       Patterns         Link
        │               │               │
        └───────────────┼───────────────┘
                        │
                        ▼
                ┌───────────────┐
                │  Confidence   │
                │   Scoring     │
                └───────┬───────┘
                        │
                 ┌──────┴──────┐
                 │             │
              >80%           <80%
                 │             │
                 ▼             ▼
          ┌──────────┐  ┌──────────┐
          │   Auto   │  │  Manual  │
          │   Link   │  │  Review  │
          └────┬─────┘  └────┬─────┘
               │              │
               └──────┬───────┘
                      │
                      ▼
             ┌────────────────┐
             │ Unified Profile│
             ├────────────────┤
             │ • Cross-platform
             │ • Shared history│
             │ • Combined XP  │
             │ • Single wallet│
             └────────────────┘
```

### 5. Error Recovery Flow

```ascii
┌──────────────────────────────────────────────────────────────────────┐
│                        ERROR RECOVERY FLOW                            │
└──────────────────────────────────────────────────────────────────────┘

                        [Error Detected]
                              │
                    ┌─────────▼─────────┐
                    │  Error Analysis   │
                    └─────────┬─────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
      [API Error]       [Timeout]         [Invalid]
            │                 │                 │
            ▼                 ▼                 ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ Retry Logic  │  │   Fallback   │  │   Validate   │
    └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
           │                  │                  │
           ▼                  ▼                  ▼
    [Retry Count]      [Alt Service]      [Fix & Retry]
           │                  │                  │
       ┌───┴───┐              │              ┌───┴───┐
       │       │              │              │       │
     <3x     ≥3x             │            Success  Fail
       │       │              │              │       │
       ▼       ▼              ▼              ▼       ▼
    [Retry] [Escalate]   [Use Alt]      [Continue] [Log]
       │       │              │              │       │
       └───────┼──────────────┼──────────────┼───────┘
               │                             │
               ▼                             ▼
        ┌──────────────┐            ┌──────────────┐
        │ User Notice  │            │   Success    │
        └──────┬───────┘            └──────────────┘
               │
               ▼
        ┌──────────────┐
        │  Graceful    │
        │  Degradation │
        └──────────────┘
```

### 6. Conversation Context Management

```ascii
┌──────────────────────────────────────────────────────────────────────┐
│                   CONVERSATION CONTEXT MANAGEMENT                     │
└──────────────────────────────────────────────────────────────────────┘

                          [New Message]
                               │
                        ┌──────▼──────┐
                        │Load Context │
                        └──────┬──────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
                    ▼          ▼          ▼
             [Short-term] [Long-term] [Global]
              (5 min)     (session)   (user)
                    │          │          │
                    └──────────┼──────────┘
                               │
                        ┌──────▼──────┐
                        │   Merge     │
                        │  Contexts   │
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐
                        │   Apply     │
                        │ Personality │
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐
                        │  Generate   │
                        │  Response   │
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐
                        │   Update    │
                        │  Context    │
                        └──────┬──────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
                    ▼          ▼          ▼
              [Cache]    [Session]   [Database]
                    │          │          │
                    └──────────┼──────────┘
                               │
                        ┌──────▼──────┐
                        │  Complete   │
                        └─────────────┘
```

### 7. Command Processing Pipeline

```ascii
┌──────────────────────────────────────────────────────────────────────┐
│                     COMMAND PROCESSING PIPELINE                       │
└──────────────────────────────────────────────────────────────────────┘

    User Input: "/raid start @channel 1h"
              │
              ▼
    ┌──────────────────┐
    │ Command Parser   │
    ├──────────────────┤
    │ • Extract cmd    │──────► cmd: "raid"
    │ • Parse args     │──────► subcmd: "start"
    │ • Validate       │──────► args: ["@channel", "1h"]
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ Permission Check │
    ├──────────────────┤
    │ • User role      │
    │ • Command access │
    │ • Rate limits    │
    └────────┬─────────┘
             │
         ┌───┴───┐
         │       │
       PASS    FAIL ──────► [Permission Denied]
         │
         ▼
    ┌──────────────────┐
    │ Command Router   │
    ├──────────────────┤
    │ /raid ──► RaidSvc│
    │ /help ──► HelpSvc│
    │ /stats ──► Stats │
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ Service Execute  │
    ├──────────────────┤
    │ • Validate args  │
    │ • Process logic  │
    │ • Side effects   │
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ Response Format  │
    ├──────────────────┤
    │ • Success msg    │
    │ • Error handling │
    │ • Rich media     │
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ Send Response    │
    └──────────────────┘
```

### 8. Emotional State Transitions

```ascii
┌──────────────────────────────────────────────────────────────────────┐
│                     EMOTIONAL STATE TRANSITIONS                       │
└──────────────────────────────────────────────────────────────────────┘

                         ┌─────────┐
                         │ NEUTRAL │
                         └────┬────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
    [Positive Event]    [Negative Event]    [High Activity]
          │                   │                   │
          ▼                   ▼                   ▼
    ┌──────────┐        ┌──────────┐        ┌──────────┐
    │  HAPPY   │        │   SAD    │        │ EXCITED  │
    └────┬─────┘        └────┬─────┘        └────┬─────┘
         │                   │                   │
         │              [Support Given]          │
         │                   │                   │
         │                   ▼                   │
         │             ┌──────────┐             │
         │             │ EMPATHIC │             │
         │             └────┬─────┘             │
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                    [Threat Detected]
                             │
                             ▼
                       ┌──────────┐
                       │PROTECTIVE│
                       └────┬─────┘
                            │
                    [Threat Resolved]
                            │
                            ▼
                      ┌─────────┐
                      │ NEUTRAL │
                      └─────────┘

State Duration: 5-30 minutes
Transition Triggers: User interaction, Event type, Context
```

## User Experience Principles

### Response Time Goals
- Instant (<100ms): Acknowledgments
- Fast (<1s): Simple queries
- Normal (<3s): Complex responses
- Acceptable (<5s): Heavy processing

### Interaction Patterns
1. **Progressive Disclosure**: Start simple, add detail on request
2. **Context Awareness**: Remember recent interactions
3. **Personality Consistency**: Maintain character across sessions
4. **Platform Optimization**: Adapt to platform constraints
5. **Graceful Degradation**: Fallback options for failures

### Engagement Strategies
- Welcome new users warmly
- Remember returning users
- Reward active participation
- Create community connections
- Maintain conversation flow
- Provide value in every interaction

---

*These UX flows ensure consistent, engaging user experiences across all interaction points.*
