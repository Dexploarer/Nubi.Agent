// Shared ClickHouse analytics middleware for Supabase Edge Functions

interface EdgeFunctionEvent {
  timestamp: string;
  function_name: string;
  function_version?: string;
  region?: string;
  request_id: string;
  method: string;
  path: string;
  status_code: number;
  cold_start?: number;
  execution_time_ms: number;
  memory_used_mb?: number;
  request_size_bytes: number;
  response_size_bytes: number;
  compute_time_ms?: number;
  estimated_cost?: string;
  error_type?: string;
  error_message?: string;
  session_id?: string;
  user_id?: string;
  trace_id?: string;
  metadata?: string;
}

class ClickHouseEdgeAnalytics {
  private host: string;
  private auth: string;
  private queue: EdgeFunctionEvent[] = [];
  private flushTimer?: number;

  constructor() {
    this.host = Deno.env.get('CLICKHOUSE_HOST') || '';
    const user = Deno.env.get('CLICKHOUSE_USER') || 'default';
    const pass = Deno.env.get('CLICKHOUSE_PASSWORD') || '';
    this.auth = btoa(`${user}:${pass}`);
    
    // Auto-flush every 5 seconds
    if (this.host) {
      this.flushTimer = setInterval(() => this.flush(), 5000);
    }
  }

  async track(event: Partial<EdgeFunctionEvent>) {
    if (!this.host) return;
    
    const fullEvent: EdgeFunctionEvent = {
      timestamp: new Date().toISOString(),
      request_id: crypto.randomUUID(),
      execution_time_ms: 0,
      request_size_bytes: 0,
      response_size_bytes: 0,
      status_code: 200,
      method: 'GET',
      path: '/',
      function_name: 'unknown',
      ...event
    };
    
    this.queue.push(fullEvent);
    
    // Flush if queue is large
    if (this.queue.length >= 50) {
      await this.flush();
    }
  }

  async flush() {
    if (this.queue.length === 0 || !this.host) return;
    
    const events = [...this.queue];
    this.queue = [];
    
    try {
      const body = events.map(e => JSON.stringify(e)).join('\n');
      const query = 'INSERT INTO elizaos_analytics.edge_function_events FORMAT JSONEachRow';
      
      const response = await fetch(
        `${this.host}/?database=elizaos_analytics&query=${encodeURIComponent(query)}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${this.auth}`,
            'Content-Type': 'application/x-ndjson'
          },
          body: body
        }
      );
      
      if (!response.ok) {
        console.error('ClickHouse insert failed:', response.status);
        // Re-queue events
        this.queue.unshift(...events);
      }
    } catch (error) {
      console.error('ClickHouse error:', error);
      this.queue.unshift(...events);
    }
  }

  middleware() {
    return async (req: Request, handler: (req: Request) => Promise<Response>) => {
      const startTime = Date.now();
      const requestId = crypto.randomUUID();
      const traceId = req.headers.get('x-trace-id') || crypto.randomUUID();
      
      // Track request size
      const requestBody = await req.clone().text();
      const requestSize = new TextEncoder().encode(requestBody).length;
      
      let response: Response;
      let error: Error | null = null;
      
      try {
        response = await handler(req);
      } catch (e) {
        error = e as Error;
        response = new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Track response size
      const responseBody = await response.clone().text();
      const responseSize = new TextEncoder().encode(responseBody).length;
      
      // Get function info from environment
      const functionName = Deno.env.get('FUNCTION_NAME') || 'unknown';
      const functionVersion = Deno.env.get('FUNCTION_VERSION') || '1.0.0';
      const region = Deno.env.get('FUNCTION_REGION') || Deno.env.get('DENO_REGION') || 'unknown';
      
      // Extract session/user from request
      const sessionId = req.headers.get('x-session-id') || undefined;
      const userId = req.headers.get('x-user-id') || undefined;
      
      // Track the event
      await this.track({
        function_name: functionName,
        function_version: functionVersion,
        region: region,
        request_id: requestId,
        method: req.method,
        path: new URL(req.url).pathname,
        status_code: response.status,
        cold_start: globalThis.coldStart ? 1 : 0,
        execution_time_ms: executionTime,
        request_size_bytes: requestSize,
        response_size_bytes: responseSize,
        compute_time_ms: executionTime,
        estimated_cost: ((executionTime / 1000) * 0.0000002).toFixed(9), // Rough estimate
        error_type: error ? error.constructor.name : undefined,
        error_message: error ? error.message : undefined,
        session_id: sessionId,
        user_id: userId,
        trace_id: traceId,
        metadata: JSON.stringify({
          headers: Object.fromEntries(req.headers.entries()),
          url: req.url
        })
      });
      
      // Mark that we're no longer in a cold start
      globalThis.coldStart = false;
      
      // Add trace headers to response
      const tracedResponse = new Response(response.body, response);
      tracedResponse.headers.set('x-request-id', requestId);
      tracedResponse.headers.set('x-trace-id', traceId);
      tracedResponse.headers.set('x-execution-time-ms', executionTime.toString());
      
      return tracedResponse;
    };
  }
}

// Mark cold start
declare global {
  var coldStart: boolean;
}
globalThis.coldStart = true;

// Export singleton
export const edgeAnalytics = new ClickHouseEdgeAnalytics();
