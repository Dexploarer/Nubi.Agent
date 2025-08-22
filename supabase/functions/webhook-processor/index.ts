// Webhook Processor Edge Function for NUBI
// Handles Telegram, Discord, and X platform webhooks with rate limiting and deduplication
//
// Rate Limiting Strategy (Database-Persistent):
// - Initial: 7 messages in 7 minutes
// - Progressive delays: After hitting limit, delay increases by 3 minutes
// - Period 1: 3 min delay, Period 2: 6 min, Period 3: 9 min... up to Period 9: 27 min
// - Uses Supabase database for persistent storage across function invocations

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RATE_LIMIT_WINDOW = 420000 // 7 minutes
const MAX_REQUESTS_PER_WINDOW = 7 // 7 messages in 7 minutes

interface WebhookEvent {
  platform: "telegram" | "discord" | "x"
  eventType: string
  userId: string
  messageId?: string
  content?: string
  metadata?: Record<string, any>
  timestamp: number
}

interface RateLimitRecord {
  user_key: string
  message_count: number
  window_start: string
  delay_period: number
  last_message_time: string
}

Deno.serve(async (req) => {
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase environment variables")
      return new Response(
        JSON.stringify({ error: "Configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // CORS headers
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      })
    }

    // Get platform from header
    const platform = req.headers.get("x-platform") as "telegram" | "discord" | "x"
    if (!platform) {
      return new Response(
        JSON.stringify({ error: "Missing platform header" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Parse webhook event
    const body = await req.json()
    const event: WebhookEvent = {
      ...body,
      platform: platform,
      timestamp: Date.now()
    }

    // Tables should be created via Supabase dashboard or migration
    // Just proceed with the rate limiting logic

    const rateLimitKey = `${platform}_${event.userId}`
    const now = new Date()
    
    // Get or create rate limit record
    const { data: rateLimitData } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('user_key', rateLimitKey)
      .single()
    
    let rateLimit: RateLimitRecord | null = rateLimitData

    if (rateLimit) {
      const windowStart = new Date(rateLimit.window_start)
      const lastMessageTime = new Date(rateLimit.last_message_time)
      const windowAge = now.getTime() - windowStart.getTime()
      
      // Check if window has expired (7 minutes)
      if (windowAge > RATE_LIMIT_WINDOW) {
        // Reset window
        const { data: updated } = await supabase
          .from('rate_limits')
          .update({
            message_count: 1,
            window_start: now.toISOString(),
            delay_period: Math.max(1, rateLimit.delay_period - 1), // Reduce delay period
            last_message_time: now.toISOString()
          })
          .eq('user_key', rateLimitKey)
          .select()
          .single()
        
        rateLimit = updated
      } else {
        // Check progressive delay
        const timeSinceLastMessage = now.getTime() - lastMessageTime.getTime()
        const requiredDelay = rateLimit.delay_period * 180000 // 3 minutes * period
        
        if (timeSinceLastMessage < requiredDelay) {
          const waitTime = requiredDelay - timeSinceLastMessage
          return new Response(
            JSON.stringify({
              error: "Please wait before sending another message",
              retryAfter: Math.ceil(waitTime / 1000),
              delayPeriod: rateLimit.delay_period,
              nextAllowedIn: `${Math.ceil(waitTime / 60000)} minutes`
            }),
            { status: 429, headers: { "Content-Type": "application/json" } }
          )
        }
        
        // Check message count
        if (rateLimit.message_count >= MAX_REQUESTS_PER_WINDOW) {
          // Increase delay period
          await supabase
            .from('rate_limits')
            .update({
              delay_period: Math.min(rateLimit.delay_period + 1, 9)
            })
            .eq('user_key', rateLimitKey)
          
          return new Response(
            JSON.stringify({
              error: "Rate limit exceeded - delay period increased",
              retryAfter: Math.ceil((RATE_LIMIT_WINDOW - windowAge) / 1000),
              newDelayPeriod: Math.min(rateLimit.delay_period + 1, 9),
              nextMessageDelay: `${Math.min(rateLimit.delay_period + 1, 9) * 3} minutes`,
              messagesUsed: rateLimit.message_count,
              maxMessages: MAX_REQUESTS_PER_WINDOW
            }),
            { status: 429, headers: { "Content-Type": "application/json" } }
          )
        }
        
        // Update message count
        await supabase
          .from('rate_limits')
          .update({
            message_count: rateLimit.message_count + 1,
            last_message_time: now.toISOString()
          })
          .eq('user_key', rateLimitKey)
      }
    } else {
      // Create new rate limit record
      await supabase
        .from('rate_limits')
        .insert({
          user_key: rateLimitKey,
          message_count: 1,
          window_start: now.toISOString(),
          delay_period: 1,
          last_message_time: now.toISOString()
        })
    }

    // Check for duplicate events (using database)
    const eventId = `${platform}_${event.eventType}_${event.messageId || event.timestamp}`
    
    // Events table should exist, created via migration
    
    // Check if event was already processed
    const { data: existingEvent } = await supabase
      .from('processed_events')
      .select('event_id')
      .eq('event_id', eventId)
      .single()
    
    if (existingEvent) {
      return new Response(
        JSON.stringify({
          success: true,
          deduplicated: true,
          eventId
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }
    
    // Store processed event
    await supabase
      .from('processed_events')
      .insert({ event_id: eventId })
    
    // Clean up old events (older than 5 minutes)
    await supabase
      .from('processed_events')
      .delete()
      .lt('processed_at', new Date(Date.now() - 300000).toISOString())

    // Process the event and forward to NUBI if needed
    const shouldForward = event.content && (
      event.content.toLowerCase().includes("@nubi") ||
      event.content.toLowerCase().includes("@anubis") ||
      event.content.startsWith("/")
    )

    if (shouldForward) {
      const nubiEndpoint = Deno.env.get("NUBI_AGENT_ENDPOINT") || "http://localhost:3000/api/messaging"
      const nubiApiKey = Deno.env.get("NUBI_API_KEY")
      
      try {
        const response = await fetch(nubiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(nubiApiKey && { "Authorization": `Bearer ${nubiApiKey}` }),
          },
          body: JSON.stringify({
            source: "webhook",
            platform,
            event,
          }),
        })
        
        if (!response.ok) {
          console.log("Failed to forward to NUBI:", response.status)
        }
      } catch (error) {
        console.log("Error forwarding to NUBI:", error)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        eventId,
        forwarded: shouldForward,
        platform
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("Webhook error:", error)
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error.message || "Unknown error",
        details: error.toString()
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})