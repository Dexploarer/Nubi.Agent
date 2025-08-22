# NUBI Agent Testing Strategy

## Testing Philosophy

Our testing approach follows the testing pyramid principle with comprehensive coverage across unit, integration, and end-to-end tests.

### Test Coverage Goals
- **Unit Tests**: 85% code coverage
- **Integration Tests**: All critical paths
- **E2E Tests**: Primary user journeys
- **Performance Tests**: Load and stress scenarios

## Test Structure

```
tests/
├── unit/               # Unit tests
│   ├── agent/         # Agent logic tests
│   ├── services/      # Service tests
│   ├── utils/         # Utility tests
│   └── mocks/         # Mock objects
├── integration/        # Integration tests
│   ├── api/           # API integration
│   ├── database/      # Database integration
│   └── platforms/     # Platform integration
├── e2e/               # End-to-end tests
│   ├── scenarios/     # User scenarios
│   └── fixtures/      # Test data
├── performance/       # Performance tests
│   ├── load/          # Load tests
│   └── stress/        # Stress tests
└── contracts/         # Contract tests
    └── api/           # API contracts
```

## Unit Testing

### Agent Character Tests
```typescript
// tests/unit/agent/character.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NubiCharacter } from '../../../src/agent/character';
import { PersonalityState } from '../../../src/types';

describe('NubiCharacter', () => {
  let character: NubiCharacter;

  beforeEach(() => {
    character = new NubiCharacter();
  });

  describe('personality states', () => {
    it('should initialize with neutral state', () => {
      expect(character.getState()).toBe(PersonalityState.NEUTRAL);
    });

    it('should transition to excited on positive events', () => {
      character.processEvent({ type: 'raid_success', value: 100 });
      expect(character.getState()).toBe(PersonalityState.EXCITED);
    });

    it('should maintain state consistency', () => {
      const initialState = character.getState();
      character.processEvent({ type: 'message', value: 'hello' });
      expect(character.getState()).toBe(initialState);
    });
  });

  describe('response generation', () => {
    it('should generate contextual responses', () => {
      const response = character.generateResponse({
        message: 'What is your purpose?',
        context: { platform: 'telegram' }
      });
      expect(response).toContain('ancient');
      expect(response.length).toBeGreaterThan(10);
    });

    it('should adapt tone based on personality', () => {
      character.setState(PersonalityState.EXCITED);
      const response = character.generateResponse({
        message: 'Tell me about raids'
      });
      expect(response).toMatch(/!|⚡|🚀/);
    });
  });
});
```

### Service Layer Tests
```typescript
// tests/unit/services/raids.test.ts
import { RaidService } from '../../../src/services/raids';
import { mockDatabase, mockAnalytics } from '../../mocks';

describe('RaidService', () => {
  let raidService: RaidService;

  beforeEach(() => {
    raidService = new RaidService(mockDatabase, mockAnalytics);
  });

  describe('raid creation', () => {
    it('should create raid with valid parameters', async () => {
      const raid = await raidService.createRaid({
        target: '@channel',
        duration: 60,
        minParticipants: 10
      });

      expect(raid.id).toBeDefined();
      expect(raid.status).toBe('pending');
      expect(raid.duration).toBe(60);
    });

    it('should reject invalid duration', async () => {
      await expect(
        raidService.createRaid({
          target: '@channel',
          duration: -1,
          minParticipants: 10
        })
      ).rejects.toThrow('Invalid duration');
    });

    it('should enforce minimum participants', async () => {
      await expect(
        raidService.createRaid({
          target: '@channel',
          duration: 60,
          minParticipants: 2
        })
      ).rejects.toThrow('Minimum 5 participants required');
    });
  });

  describe('participation tracking', () => {
    it('should track unique participants', async () => {
      const raidId = 'raid_123';
      await raidService.joinRaid(raidId, 'user_1');
      await raidService.joinRaid(raidId, 'user_2');
      await raidService.joinRaid(raidId, 'user_1'); // Duplicate

      const participants = await raidService.getParticipants(raidId);
      expect(participants.length).toBe(2);
    });

    it('should calculate participation score', async () => {
      const score = await raidService.calculateScore('raid_123', 'user_1');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1000);
    });
  });
});
```

## Integration Testing

### API Integration Tests
```typescript
// tests/integration/api/agent.test.ts
import request from 'supertest';
import { app } from '../../../src/app';
import { setupTestDatabase, cleanupTestDatabase } from '../../helpers';

describe('Agent API Integration', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('POST /agent/message', () => {
    it('should process message and return response', async () => {
      const response = await request(app)
        .post('/api/v1/agent/message')
        .set('Authorization', 'Bearer test_token')
        .send({
          message: 'Hello NUBI',
          platform: 'telegram',
          user_id: 'test_user'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('response');
      expect(response.body.response).toBeTruthy();
      expect(response.body).toHaveProperty('message_id');
    });

    it('should handle rate limiting', async () => {
      // Send multiple requests
      const requests = Array(25).fill(null).map(() =>
        request(app)
          .post('/api/v1/agent/message')
          .set('Authorization', 'Bearer test_token')
          .send({ message: 'test' })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});
```

### Database Integration Tests
```typescript
// tests/integration/database/clickhouse.test.ts
import { ClickHouseClient } from '../../../src/database/clickhouse';
import { testConfig } from '../../config';

describe('ClickHouse Integration', () => {
  let client: ClickHouseClient;

  beforeAll(async () => {
    client = new ClickHouseClient(testConfig.clickhouse);
    await client.connect();
  });

  afterAll(async () => {
    await client.disconnect();
  });

  describe('event tracking', () => {
    it('should insert and query events', async () => {
      const event = {
        event_id: 'test_123',
        event_type: 'message',
        user_id: 'user_test',
        timestamp: new Date(),
        properties: { platform: 'test' }
      };

      await client.insertEvent(event);
      
      const events = await client.queryEvents({
        user_id: 'user_test',
        limit: 10
      });

      expect(events).toContainEqual(
        expect.objectContaining({ event_id: 'test_123' })
      );
    });

    it('should handle batch inserts', async () => {
      const events = Array(100).fill(null).map((_, i) => ({
        event_id: `batch_${i}`,
        event_type: 'test',
        user_id: 'batch_user',
        timestamp: new Date(),
        properties: {}
      }));

      await client.batchInsert(events);
      
      const count = await client.countEvents({ user_id: 'batch_user' });
      expect(count).toBe(100);
    });
  });
});
```

## End-to-End Testing

### User Journey Tests
```typescript
// tests/e2e/scenarios/onboarding.test.ts
import { Browser, Page } from 'puppeteer';
import { launchBrowser, closeBrowser } from '../../helpers/browser';
import { createTestUser, deleteTestUser } from '../../helpers/users';

describe('User Onboarding Journey', () => {
  let browser: Browser;
  let page: Page;
  let testUserId: string;

  beforeAll(async () => {
    browser = await launchBrowser();
    testUserId = await createTestUser();
  });

  afterAll(async () => {
    await deleteTestUser(testUserId);
    await closeBrowser(browser);
  });

  beforeEach(async () => {
    page = await browser.newPage();
  });

  it('should complete full onboarding flow', async () => {
    // Navigate to Telegram bot
    await page.goto('https://t.me/nubi_bot');
    
    // Start conversation
    await page.click('[data-testid="start-button"]');
    
    // Wait for welcome message
    await page.waitForSelector('[data-testid="bot-message"]');
    const welcomeMessage = await page.$eval(
      '[data-testid="bot-message"]',
      el => el.textContent
    );
    expect(welcomeMessage).toContain('Welcome');
    
    // Send first message
    await page.type('[data-testid="message-input"]', 'Hello NUBI');
    await page.click('[data-testid="send-button"]');
    
    // Verify response
    await page.waitForSelector('[data-testid="bot-response"]');
    const response = await page.$eval(
      '[data-testid="bot-response"]',
      el => el.textContent
    );
    expect(response).toContain('ancient');
    
    // Complete preferences
    await page.click('[data-testid="preference-technical"]');
    await page.click('[data-testid="preference-raids-yes"]');
    
    // Verify profile creation
    await page.waitForSelector('[data-testid="profile-created"]');
  });
});
```

### Raid Participation Test
```typescript
// tests/e2e/scenarios/raid.test.ts
describe('Raid Participation Flow', () => {
  it('should allow users to join and complete raid', async () => {
    // Create raid
    const raidResponse = await request(app)
      .post('/api/v1/raids/create')
      .set('Authorization', 'Bearer admin_token')
      .send({
        target: '@test_channel',
        duration_minutes: 30,
        min_participants: 5
      });
    
    const raidId = raidResponse.body.raid_id;
    
    // Simulate multiple users joining
    const userJoins = Array(10).fill(null).map((_, i) =>
      request(app)
        .post(`/api/v1/raids/${raidId}/join`)
        .set('Authorization', `Bearer user_${i}_token`)
    );
    
    await Promise.all(userJoins);
    
    // Simulate activity
    const activities = Array(50).fill(null).map((_, i) =>
      request(app)
        .post(`/api/v1/raids/${raidId}/activity`)
        .set('Authorization', `Bearer user_${i % 10}_token`)
        .send({ action: 'message', content: `Message ${i}` })
    );
    
    await Promise.all(activities);
    
    // Check raid status
    const statusResponse = await request(app)
      .get(`/api/v1/raids/${raidId}`)
      .set('Authorization', 'Bearer test_token');
    
    expect(statusResponse.body.status).toBe('active');
    expect(statusResponse.body.participants).toBe(10);
    expect(statusResponse.body.progress.messages).toBeGreaterThan(40);
  });
});
```

## Performance Testing

### Load Testing Configuration
```yaml
# tests/performance/load/k6-config.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp to 200
    { duration: '5m', target: 200 },  // Stay at 200
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    errors: ['rate<0.05'],              // Error rate under 5%
  },
};

export default function() {
  const payload = JSON.stringify({
    message: 'Hello NUBI',
    platform: 'telegram',
    user_id: `user_${__VU}`,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer load_test_token',
    },
  };

  const response = http.post(
    'https://api.nubi.ai/v1/agent/message',
    payload,
    params
  );

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response has message': (r) => JSON.parse(r.body).response !== undefined,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });

  errorRate.add(response.status !== 200);
  sleep(1);
}
```

### Stress Testing
```javascript
// tests/performance/stress/artillery-config.yml
config:
  target: "https://api.nubi.ai"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 100
      name: "Ramp up load"
    - duration: 300
      arrivalRate: 500
      name: "Sustained high load"
    - duration: 120
      arrivalRate: 1000
      name: "Stress test"

scenarios:
  - name: "Message Processing"
    flow:
      - post:
          url: "/v1/agent/message"
          json:
            message: "{{ $randomString() }}"
            platform: "telegram"
            user_id: "stress_{{ $randomNumber() }}"
          headers:
            Authorization: "Bearer {{ $processEnvironment.API_KEY }}"
          capture:
            - json: "$.message_id"
              as: "messageId"
      - think: 1
      - get:
          url: "/v1/messages/{{ messageId }}"
          headers:
            Authorization: "Bearer {{ $processEnvironment.API_KEY }}"
```

## Contract Testing

### API Contract Tests
```typescript
// tests/contracts/api/agent-contract.test.ts
import { Pact } from '@pact-foundation/pact';
import { like, term } from '@pact-foundation/pact/matchers';

describe('Agent API Contract', () => {
  const provider = new Pact({
    consumer: 'Frontend',
    provider: 'AgentAPI',
  });

  beforeAll(() => provider.setup());
  afterAll(() => provider.finalize());

  describe('message endpoint', () => {
    it('should respond with expected structure', async () => {
      await provider.addInteraction({
        state: 'agent is available',
        uponReceiving: 'a message request',
        withRequest: {
          method: 'POST',
          path: '/api/v1/agent/message',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': term({
              matcher: '^Bearer .+',
              generate: 'Bearer token123',
            }),
          },
          body: {
            message: like('Hello'),
            platform: term({
              matcher: 'telegram|discord|twitter',
              generate: 'telegram',
            }),
            user_id: like('user_123'),
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            response: like('Greetings...'),
            message_id: term({
              matcher: '^msg_[a-z0-9]+',
              generate: 'msg_abc123',
            }),
            tokens_used: like(45),
            personality_state: term({
              matcher: 'neutral|happy|excited|sad',
              generate: 'neutral',
            }),
          },
        },
      });

      // Test implementation
      const response = await sendMessage('Hello');
      expect(response.response).toBeDefined();
    });
  });
});
```

## Test Automation

### GitHub Actions Test Pipeline
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          flags: unit

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgres://postgres:test@localhost/test
          REDIS_URL: redis://localhost:6379

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: e2e-artifacts
          path: |
            test-results/
            screenshots/
            videos/

  performance-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Run k6 load test
        uses: grafana/k6-action@v0.3.0
        with:
          filename: tests/performance/load/k6-config.js
      
      - name: Upload performance results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: results/
```

## Test Commands

```json
// package.json scripts
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration --runInBand",
    "test:e2e": "playwright test",
    "test:performance": "k6 run tests/performance/load/k6-config.js",
    "test:contracts": "jest --testPathPattern=contracts",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "npm run test:unit && npm run test:integration"
  }
}
```

## Testing Best Practices

1. **Test Isolation**: Each test should be independent
2. **Clear Naming**: Descriptive test names that explain what and why
3. **AAA Pattern**: Arrange, Act, Assert structure
4. **Mock External Dependencies**: Use mocks for external services
5. **Test Data Management**: Use factories and fixtures
6. **Continuous Testing**: Run tests on every commit
7. **Performance Baselines**: Track performance over time
8. **Error Scenarios**: Test failure paths thoroughly

---

*This comprehensive testing strategy ensures reliability and quality across all components of the NUBI Agent system.*
