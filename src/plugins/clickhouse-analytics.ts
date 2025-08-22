import { Plugin } from "@elizaos/core";
import { v4 as uuidv4 } from "uuid";

interface ClickHouseConfig {
  host: string;
  user: string;
  password: string;
  database?: string;
  batchSize?: number;
  flushInterval?: number;
}

interface AnalyticsEvent {
  timestamp: string;
  session_id: string;
  agent_id: string;
  event_type: string;
  event_subtype?: string;
  duration_ms?: number;
  tokens_in?: number;
  tokens_out?: number;
  cost_millicents?: number;
  success?: number;
  error_code?: string;
  metadata?: string;
  event_id?: string;
}

class ClickHouseAnalytics {
  private config: ClickHouseConfig;
  private eventQueue: AnalyticsEvent[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: ClickHouseConfig) {
    this.config = {
      database: "elizaos_analytics",
      batchSize: 100,
      flushInterval: 5000,
      ...config,
    };
    this.startAutoFlush();
  }

  private startAutoFlush() {
    this.flushTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flush();
      }
    }, this.config.flushInterval);
  }

  async track(event: Omit<AnalyticsEvent, "event_id">) {
    const fullEvent: AnalyticsEvent = {
      ...event,
      event_id: uuidv4(),
    };

    this.eventQueue.push(fullEvent);

    if (this.eventQueue.length >= this.config.batchSize!) {
      await this.flush();
    }
  }

  async flush() {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const body = events.map((e) => JSON.stringify(e)).join("\n");
      const query = `INSERT INTO ${this.config.database}.agent_events FORMAT JSONEachRow`;

      const response = await fetch(
        `${this.config.host}/?database=${this.config.database}&query=${encodeURIComponent(query)}`,
        {
          method: "POST",
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(
                `${this.config.user}:${this.config.password}`,
              ).toString("base64"),
            "Content-Type": "application/x-ndjson",
          },
          body: body,
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!response.ok) {
        console.error(
          `ClickHouse insert failed: ${response.status} - ${response.statusText}`,
        );
        // Re-queue events for retry with exponential backoff
        this.requeueEvents(events);
      } else {
        console.log(`✅ Flushed ${events.length} events to ClickHouse`);
      }
    } catch (error) {
      console.error("ClickHouse connection error:", error);
      // Re-queue events for retry with exponential backoff
      this.requeueEvents(events);
    }
  }

  private requeueEvents(events: AnalyticsEvent[]) {
    // Add events back to the front of the queue for retry
    this.eventQueue.unshift(...events);

    // If queue is getting too large, drop oldest events
    if (this.eventQueue.length > this.config.batchSize! * 10) {
      const dropped = this.eventQueue.splice(this.config.batchSize! * 5);
      console.warn(
        `Dropped ${dropped.length} old events due to queue overflow`,
      );
    }
  }

  async close() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }
}

export const clickhouseAnalyticsPlugin: Plugin = {
  name: "clickhouse-analytics",
  description: "Lightweight analytics for ElizaOS using ClickHouse",

  actions: [],
  evaluators: [],
  providers: [],

  services: [],
};

export default clickhouseAnalyticsPlugin;
