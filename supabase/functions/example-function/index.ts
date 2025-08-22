import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { edgeAnalytics } from "../_shared/clickhouse-analytics.ts"

// Set function name for analytics
Deno.env.set('FUNCTION_NAME', 'example-function');
Deno.env.set('FUNCTION_VERSION', '1.0.0');

const handler = async (req: Request): Promise<Response> => {
  const { name = 'World' } = await req.json().catch(() => ({}));
  
  const data = {
    message: `Hello ${name}!`,
    timestamp: new Date().toISOString()
  };

  return new Response(
    JSON.stringify(data),
    { headers: { "Content-Type": "application/json" } }
  );
};

serve(edgeAnalytics.middleware()(handler));
