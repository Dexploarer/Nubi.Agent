// Supabase Edge Function: Raid Processor
// Handles raid operations, webhooks, and real-time updates

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RaidRequest {
  action: 'start' | 'join' | 'end' | 'update' | 'stats' | 'leaderboard';
  raidId?: string;
  sessionId?: string;
  userId?: string;
  username?: string;
  targetUrl?: string;
  platform?: string;
  metadata?: any;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, ...params } = await req.json() as RaidRequest;

    let response: any;

    switch (action) {
      case 'start':
        response = await startRaid(supabase, params);
        break;
      
      case 'join':
        response = await joinRaid(supabase, params);
        break;
      
      case 'end':
        response = await endRaid(supabase, params);
        break;
      
      case 'update':
        response = await updateRaidMetrics(supabase, params);
        break;
      
      case 'stats':
        response = await getRaidStats(supabase, params);
        break;
      
      case 'leaderboard':
        response = await getLeaderboard(supabase, params);
        break;
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: response }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Raid processor error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});

async function startRaid(supabase: any, params: any) {
  const { sessionId, targetUrl, platform = 'telegram', userId, metadata } = params;
  
  // Extract target platform from URL
  let targetPlatform = 'unknown';
  if (targetUrl.includes('twitter.com') || targetUrl.includes('x.com')) {
    targetPlatform = 'twitter';
  } else if (targetUrl.includes('instagram.com')) {
    targetPlatform = 'instagram';
  }
  
  // Create raid session
  const { data: raid, error } = await supabase
    .from('raids')
    .insert({
      session_id: sessionId,
      target_url: targetUrl,
      target_platform: targetPlatform,
      platform,
      created_by: userId,
      metadata: metadata || {},
      status: 'active'
    })
    .select()
    .single();
  
  if (error) throw error;
  
  // Send real-time notification
  await supabase.channel('raid-updates').send({
    type: 'broadcast',
    event: 'raid_started',
    payload: { 
      raidId: raid.id, 
      sessionId: raid.session_id,
      targetUrl: raid.target_url 
    }
  });
  
  return raid;
}

async function joinRaid(supabase: any, params: any) {
  const { sessionId, userId, username } = params;
  
  // Get raid
  const { data: raid } = await supabase
    .from('raids')
    .select('*')
    .eq('session_id', sessionId)
    .eq('status', 'active')
    .single();
  
  if (!raid) throw new Error('Raid not found or inactive');
  
  // Add participant
  const { data: participant, error } = await supabase
    .from('raid_participants')
    .upsert({
      raid_id: raid.id,
      user_id: userId,
      username,
      telegram_user_id: userId, // Store Telegram ID
      is_active: true
    }, {
      onConflict: 'raid_id,user_id'
    })
    .select()
    .single();
  
  if (error) throw error;
  
  // Update raid metrics
  await supabase
    .from('raids')
    .update({ 
      total_participants: raid.total_participants + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', raid.id);
  
  // Broadcast participant joined
  await supabase.channel('raid-updates').send({
    type: 'broadcast',
    event: 'participant_joined',
    payload: { 
      raidId: raid.id,
      participant: { id: participant.id, username }
    }
  });
  
  return { raid, participant };
}

async function endRaid(supabase: any, params: any) {
  const { sessionId } = params;
  
  // Get raid with participants
  const { data: raid } = await supabase
    .from('raids')
    .select(`
      *,
      raid_participants (
        user_id,
        username,
        points,
        actions_count
      )
    `)
    .eq('session_id', sessionId)
    .single();
  
  if (!raid) throw new Error('Raid not found');
  
  // Calculate final stats
  const stats = await supabase.rpc('calculate_raid_stats', { raid_uuid: raid.id });
  
  // Update raid status
  await supabase
    .from('raids')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      total_points: stats.data[0].total_points,
      engagement_quality_score: stats.data[0].engagement_rate
    })
    .eq('id', raid.id);
  
  // Refresh materialized view for leaderboard
  await supabase.rpc('refresh_materialized_view', { view_name: 'raid_leaderboard' });
  
  // Send completion notification
  await supabase.channel('raid-updates').send({
    type: 'broadcast',
    event: 'raid_ended',
    payload: { 
      raidId: raid.id,
      stats: stats.data[0],
      topPerformers: raid.raid_participants
        .sort((a: any, b: any) => b.points - a.points)
        .slice(0, 3)
    }
  });
  
  return { raid, stats: stats.data[0] };
}

async function updateRaidMetrics(supabase: any, params: any) {
  const { raidId, userId, actionType, points = 10 } = params;
  
  // Get participant
  const { data: participant } = await supabase
    .from('raid_participants')
    .select('*')
    .eq('raid_id', raidId)
    .eq('user_id', userId)
    .single();
  
  if (!participant) throw new Error('Participant not found');
  
  // Record action
  await supabase
    .from('raid_actions')
    .insert({
      raid_id: raidId,
      participant_id: participant.id,
      action_type: actionType,
      points_earned: points
    });
  
  // Update participant points
  await supabase
    .from('raid_participants')
    .update({
      points: participant.points + points,
      actions_count: participant.actions_count + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', participant.id);
  
  // Update raid total
  await supabase
    .from('raids')
    .update({
      total_engagements: supabase.raw('total_engagements + 1'),
      total_points: supabase.raw(`total_points + ${points}`),
      updated_at: new Date().toISOString()
    })
    .eq('id', raidId);
  
  // Broadcast update
  await supabase.channel('raid-updates').send({
    type: 'broadcast',
    event: 'points_updated',
    payload: { 
      raidId,
      userId,
      points,
      actionType
    }
  });
  
  return { success: true, newPoints: participant.points + points };
}

async function getRaidStats(supabase: any, params: any) {
  const { sessionId } = params;
  
  const { data: raid } = await supabase
    .from('raids')
    .select(`
      *,
      raid_participants (
        username,
        points,
        actions_count,
        joined_at
      )
    `)
    .eq('session_id', sessionId)
    .single();
  
  if (!raid) throw new Error('Raid not found');
  
  const stats = {
    raidId: raid.id,
    sessionId: raid.session_id,
    status: raid.status,
    targetUrl: raid.target_url,
    startedAt: raid.started_at,
    duration: raid.duration_minutes,
    participants: raid.raid_participants.length,
    totalPoints: raid.total_points,
    totalEngagements: raid.total_engagements,
    leaderboard: raid.raid_participants
      .sort((a: any, b: any) => b.points - a.points)
      .slice(0, 10),
    averageEngagement: raid.total_engagements / Math.max(raid.raid_participants.length, 1)
  };
  
  return stats;
}

async function getLeaderboard(supabase: any, params: any) {
  const { limit = 10, timeframe = 'all' } = params;
  
  let query = supabase
    .from('raid_leaderboard')
    .select('*')
    .order('total_points', { ascending: false })
    .limit(limit);
  
  const { data: leaderboard, error } = await query;
  
  if (error) throw error;
  
  return leaderboard;
}
