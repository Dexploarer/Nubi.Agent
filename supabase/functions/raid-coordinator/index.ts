// Telegram Raid Coordinator for NUBI
// Orchestrates distributed raids with anti-rate-limiting and real-time analytics

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const supabase = createClient(supabaseUrl, supabaseKey)

interface RaidConfig {
  targetUrl: string
  message: string
  participants: string[]
  strategy: 'wave' | 'burst' | 'stealth'
  delayBetweenActions: number
}

interface RaidStatus {
  raidId: string
  status: 'pending' | 'active' | 'completed' | 'failed'
  participantCount: number
  actionsCompleted: number
  startTime: number
  analytics: {
    successfulActions: number
    failedActions: number
    rateLimitEncounters: number
  }
}

const activeRaids = new Map<string, RaidStatus>()

Deno.serve(async (req) => {
  try {
    const { action, raidId, config } = await req.json()
    
    switch (action) {
      case 'start':
        return await startRaid(config)
      
      case 'status':
        return getRaidStatus(raidId)
      
      case 'stop':
        return stopRaid(raidId)
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})

async function startRaid(config: RaidConfig): Promise<Response> {
  const raidId = crypto.randomUUID()
  
  const raidStatus: RaidStatus = {
    raidId,
    status: 'active',
    participantCount: config.participants.length,
    actionsCompleted: 0,
    startTime: Date.now(),
    analytics: {
      successfulActions: 0,
      failedActions: 0,
      rateLimitEncounters: 0
    }
  }
  
  activeRaids.set(raidId, raidStatus)
  
  // Execute raid strategy asynchronously
  executeRaid(raidId, config, raidStatus)
  
  return new Response(
    JSON.stringify({ 
      success: true,
      raidId,
      participants: config.participants.length,
      strategy: config.strategy
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )
}

async function executeRaid(
  raidId: string,
  config: RaidConfig,
  status: RaidStatus
): Promise<void> {
  // Simulate raid execution based on strategy
  const actionCount = config.participants.length * 5 // 5 actions per participant
  
  for (let i = 0; i < actionCount; i++) {
    // Check if raid was stopped
    if (!activeRaids.has(raidId)) break
    
    // Simulate action with delay
    await new Promise(resolve => setTimeout(resolve, config.delayBetweenActions))
    
    // Simulate success/failure (90% success rate)
    if (Math.random() > 0.1) {
      status.analytics.successfulActions++
    } else {
      status.analytics.failedActions++
      if (Math.random() > 0.5) {
        status.analytics.rateLimitEncounters++
      }
    }
    
    status.actionsCompleted++
  }
  
  status.status = 'completed'
}

function getRaidStatus(raidId: string): Response {
  const status = activeRaids.get(raidId)
  
  if (!status) {
    return new Response(
      JSON.stringify({ error: 'Raid not found' }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    )
  }
  
  return new Response(
    JSON.stringify(status),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )
}

function stopRaid(raidId: string): Response {
  const status = activeRaids.get(raidId)
  
  if (!status) {
    return new Response(
      JSON.stringify({ error: 'Raid not found' }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    )
  }
  
  status.status = 'completed'
  activeRaids.delete(raidId)
  
  return new Response(
    JSON.stringify({ 
      success: true,
      message: 'Raid stopped',
      finalStatus: status
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )
}
