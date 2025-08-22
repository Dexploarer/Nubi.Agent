// Community Analytics Engine for NUBI
// Processes engagement metrics, sentiment analysis, and trend detection

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const supabase = createClient(supabaseUrl, supabaseKey)

interface CommunityMetrics {
  activeUsers: string[]
  dailyMessages: number
  engagementScore: number
  topTopics: Record<string, number>
  averageResponseTime: number
  communityMood: string
  timestamp: number
}

interface AnalyticsRequest {
  action: 'calculate' | 'fetch' | 'trend' | 'sentiment'
  platform?: string
  timeRange?: { start: number; end: number }
  userId?: string
  content?: string
}

// Sentiment keywords for basic analysis
const POSITIVE_KEYWORDS = ['love', 'amazing', 'great', 'excellent', 'awesome', 'good', 'nice', 'helpful', 'thanks', 'appreciate']
const NEGATIVE_KEYWORDS = ['hate', 'terrible', 'bad', 'awful', 'horrible', 'sucks', 'annoying', 'useless', 'waste', 'stupid']
const TREND_KEYWORDS = ['solana', 'memecoin', 'defi', 'nft', 'pump', 'dump', 'moon', 'diamond hands', 'hodl', 'rug']

Deno.serve(async (req) => {
  try {
    const request: AnalyticsRequest = await req.json()
    
    switch (request.action) {
      case 'calculate':
        return await calculateMetrics(request)
      
      case 'sentiment':
        return await analyzeSentiment(request)
      
      case 'trend':
        return await detectTrends(request)
      
      case 'fetch':
        return await fetchMetrics(request)
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
    }
  } catch (error) {
    console.error("Analytics error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})

async function calculateMetrics(request: AnalyticsRequest): Promise<Response> {
  const now = Date.now()
  const dayAgo = now - 86400000
  
  // For demo, return sample metrics (would fetch from database in production)
  const metrics: CommunityMetrics = {
    activeUsers: ['user1', 'user2', 'user3'],
    dailyMessages: 150,
    engagementScore: 4.5,
    topTopics: {
      'solana': 25,
      'memecoin': 18,
      'defi': 12
    },
    averageResponseTime: 45000, // 45 seconds
    communityMood: 'positive',
    timestamp: now
  }
  
  return new Response(
    JSON.stringify({ success: true, metrics }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )
}

async function analyzeSentiment(request: AnalyticsRequest): Promise<Response> {
  if (!request.content) {
    return new Response(
      JSON.stringify({ error: 'Content required for sentiment analysis' }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }
  
  const content = request.content.toLowerCase()
  let score = 0
  
  // Basic keyword-based sentiment analysis
  POSITIVE_KEYWORDS.forEach(word => {
    if (content.includes(word)) score += 1
  })
  
  NEGATIVE_KEYWORDS.forEach(word => {
    if (content.includes(word)) score -= 1
  })
  
  // Normalize score to -1 to 1 range
  const normalizedScore = Math.max(-1, Math.min(1, score / 5))
  
  let sentiment = 'neutral'
  if (normalizedScore > 0.5) sentiment = 'very_positive'
  else if (normalizedScore > 0.2) sentiment = 'positive'
  else if (normalizedScore < -0.5) sentiment = 'very_negative'
  else if (normalizedScore < -0.2) sentiment = 'negative'
  
  return new Response(
    JSON.stringify({ 
      sentiment,
      score: normalizedScore,
      keywords: {
        positive: POSITIVE_KEYWORDS.filter(w => content.includes(w)),
        negative: NEGATIVE_KEYWORDS.filter(w => content.includes(w))
      }
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )
}

async function detectTrends(request: AnalyticsRequest): Promise<Response> {
  // Sample trend data (would analyze real messages in production)
  const trends = [
    { keyword: 'solana', count: 45, trendScore: 8.5, isViral: true },
    { keyword: 'memecoin', count: 32, trendScore: 6.2, isViral: false },
    { keyword: 'defi', count: 28, trendScore: 5.1, isViral: false }
  ]
  
  return new Response(
    JSON.stringify({ 
      trends,
      viralTopics: trends.filter(t => t.isViral),
      timeRange: request.timeRange || { start: Date.now() - 86400000, end: Date.now() }
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )
}

async function fetchMetrics(request: AnalyticsRequest): Promise<Response> {
  // Return cached or fresh metrics
  return await calculateMetrics(request)
}