// Identity Linker Edge Function
// Manages cross-platform user identity linking for NUBI

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

interface IdentityRequest {
  action: 'setup' | 'link' | 'unlink' | 'verify' | 'resolve' | 'merge' | 'search' | 'analyze'
  platform: string
  userId?: string
  targetPlatform?: string
  targetIdentifier?: string
  verificationCode?: string
  data?: Record<string, any>
}

interface PlatformProfile {
  id: string
  identity_id: string
  platform: string
  platform_user_id: string
  username: string
  display_name: string
  message_count: number
}

interface IdentityMatch {
  profile: PlatformProfile
  confidence: number
  evidence: Record<string, any>
}

// Helper function to calculate username similarity
function calculateUsernameSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()
  
  // Exact match
  if (s1 === s2) return 100
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 85
  
  // Levenshtein distance
  const matrix: number[][] = []
  
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  const distance = matrix[s2.length][s1.length]
  const maxLength = Math.max(s1.length, s2.length)
  return Math.max(0, (1 - distance / maxLength) * 100)
}

// Analyze patterns for automatic identity detection
async function analyzeIdentityPatterns(
  supabase: any,
  profile: PlatformProfile
): Promise<IdentityMatch[]> {
  const matches: IdentityMatch[] = []
  
  // 1. Username similarity matching
  if (profile.username) {
    const { data: similarProfiles } = await supabase
      .from('platform_profiles')
      .select('*')
      .neq('platform', profile.platform)
      .not('username', 'is', null)
    
    for (const candidate of similarProfiles || []) {
      const similarity = calculateUsernameSimilarity(profile.username, candidate.username)
      if (similarity >= 70) {
        matches.push({
          profile: candidate,
          confidence: similarity,
          evidence: {
            type: 'username_similarity',
            source_username: profile.username,
            target_username: candidate.username,
            similarity_score: similarity
          }
        })
      }
    }
  }
  
  // 2. Temporal correlation (active at similar times)
  const { data: activityPattern } = await supabase
    .rpc('get_user_activity_pattern', {
      p_profile_id: profile.id
    })
    .single()
  
  if (activityPattern) {
    const { data: similarActivity } = await supabase
      .rpc('find_similar_activity_patterns', {
        p_pattern: activityPattern,
        p_exclude_platform: profile.platform
      })
    
    for (const candidate of similarActivity || []) {
      // Check if we already have this candidate
      const existingMatch = matches.find(m => m.profile.id === candidate.profile_id)
      if (existingMatch) {
        existingMatch.confidence = Math.min(100, existingMatch.confidence + 15)
        existingMatch.evidence.temporal_correlation = true
      } else if (candidate.correlation_score >= 0.7) {
        matches.push({
          profile: candidate,
          confidence: candidate.correlation_score * 60,
          evidence: {
            type: 'temporal_correlation',
            correlation_score: candidate.correlation_score
          }
        })
      }
    }
  }
  
  // 3. Social graph analysis (common connections)
  const { data: socialConnections } = await supabase
    .rpc('get_common_connections', {
      p_profile_id: profile.id,
      p_platform: profile.platform
    })
  
  for (const connection of socialConnections || []) {
    const existingMatch = matches.find(m => m.profile.id === connection.profile_id)
    if (existingMatch) {
      existingMatch.confidence = Math.min(100, existingMatch.confidence + 20)
      existingMatch.evidence.common_connections = connection.common_count
    } else if (connection.common_count >= 3) {
      matches.push({
        profile: connection,
        confidence: Math.min(80, connection.common_count * 10),
        evidence: {
          type: 'social_graph',
          common_connections: connection.common_count
        }
      })
    }
  }
  
  // Sort by confidence
  return matches.sort((a, b) => b.confidence - a.confidence)
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // CORS
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      })
    }
    
    const request: IdentityRequest = await req.json()
    
    switch (request.action) {
      case 'setup': {
        // Test database connectivity and show what tables exist
        try {
          // Check what tables exist
          const { data: tables, error } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .like('table_name', '%identit%')
          
          return new Response(
            JSON.stringify({
              success: true,
              message: "Database connection works",
              existing_tables: tables || [],
              note: "Tables must be created manually via Supabase dashboard SQL editor"
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        } catch (error) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Database connection failed",
              details: error.message
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          )
        }
      }
      
      case 'link': {
        // Manual account linking
        const { platform, userId, targetPlatform, targetIdentifier } = request
        
        if (!platform || !userId || !targetPlatform || !targetIdentifier) {
          return new Response(
            JSON.stringify({ error: "Missing required fields" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          )
        }
        
        // Get source profile
        const { data: sourceProfile } = await supabase
          .from('platform_profiles')
          .select('*')
          .eq('platform', platform)
          .eq('platform_user_id', userId)
          .single()
        
        if (!sourceProfile) {
          // Create identity first, then source profile
          const { data: newIdentity, error: identityError } = await supabase
            .from('user_identities')
            .insert({
              primary_platform: platform,
              display_name: request.data?.display_name || request.data?.username
            })
            .select()
            .single()
          
          if (!newIdentity || identityError) {
            return new Response(
              JSON.stringify({ error: "Failed to create identity", details: identityError }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            )
          }
          
          const { data: newSource, error: profileError } = await supabase
            .from('platform_profiles')
            .insert({
              identity_id: newIdentity.id,
              platform,
              platform_user_id: userId,
              username: request.data?.username,
              display_name: request.data?.display_name
            })
            .select()
            .single()
          
          if (!newSource || profileError) {
            return new Response(
              JSON.stringify({ error: "Failed to create source profile", details: profileError }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            )
          }
          
          sourceProfile = newSource
        }
        
        // Generate verification code
        const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase()
        
        // Create link request
        const { data: linkRequest } = await supabase
          .from('identity_link_requests')
          .insert({
            requester_profile_id: sourceProfile?.id || newSource?.id,
            target_platform: targetPlatform,
            target_identifier: targetIdentifier,
            verification_code: verificationCode,
            status: 'pending'
          })
          .select()
          .single()
        
        return new Response(
          JSON.stringify({
            success: true,
            linkRequestId: linkRequest.id,
            verificationCode,
            message: `Please send the code ${verificationCode} from your ${targetPlatform} account to verify`
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      
      case 'verify': {
        // Verify a link request
        const { platform, userId, verificationCode } = request
        
        if (!platform || !userId || !verificationCode) {
          return new Response(
            JSON.stringify({ error: "Missing verification data" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          )
        }
        
        // Find the link request
        const { data: linkRequest } = await supabase
          .from('identity_link_requests')
          .select('*, requester_profile:platform_profiles!requester_profile_id(*)')
          .eq('target_platform', platform)
          .eq('verification_code', verificationCode)
          .eq('status', 'pending')
          .single()
        
        if (!linkRequest) {
          return new Response(
            JSON.stringify({ error: "Invalid or expired verification code" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          )
        }
        
        // Check if expired
        if (new Date(linkRequest.expires_at) < new Date()) {
          await supabase
            .from('identity_link_requests')
            .update({ status: 'expired' })
            .eq('id', linkRequest.id)
          
          return new Response(
            JSON.stringify({ error: "Verification code expired" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          )
        }
        
        // Get or create target profile
        let { data: targetProfile } = await supabase
          .from('platform_profiles')
          .select('*')
          .eq('platform', platform)
          .eq('platform_user_id', userId)
          .single()
        
        if (!targetProfile) {
          const { data: newTarget } = await supabase
            .from('platform_profiles')
            .insert({
              platform,
              platform_user_id: userId,
              username: request.data?.username,
              display_name: request.data?.display_name
            })
            .select()
            .single()
          
          targetProfile = newTarget
        }
        
        // Link the profiles to the same identity
        let identityId = linkRequest.requester_profile.identity_id
        
        if (!identityId) {
          // Create new identity
          const { data: newIdentity } = await supabase
            .from('user_identities')
            .insert({
              primary_platform: linkRequest.requester_profile.platform,
              display_name: linkRequest.requester_profile.display_name,
              verified: true
            })
            .select()
            .single()
          
          identityId = newIdentity.id
          
          // Update source profile
          await supabase
            .from('platform_profiles')
            .update({ identity_id: identityId })
            .eq('id', linkRequest.requester_profile.id)
        }
        
        // Update target profile
        await supabase
          .from('platform_profiles')
          .update({ identity_id: identityId })
          .eq('id', targetProfile.id)
        
        // Create identity link
        await supabase
          .from('identity_links')
          .insert({
            source_profile_id: linkRequest.requester_profile.id,
            target_profile_id: targetProfile.id,
            link_type: 'manual',
            confidence: 100,
            status: 'confirmed',
            verified_by: userId,
            verified_at: new Date().toISOString()
          })
        
        // Update link request
        await supabase
          .from('identity_link_requests')
          .update({
            status: 'verified',
            verified_at: new Date().toISOString()
          })
          .eq('id', linkRequest.id)
        
        // Log the action
        await supabase
          .from('identity_audit_log')
          .insert({
            identity_id: identityId,
            action: 'link_created',
            actor_profile_id: targetProfile.id,
            details: {
              link_type: 'manual_verification',
              source_platform: linkRequest.requester_profile.platform,
              target_platform: platform
            }
          })
        
        return new Response(
          JSON.stringify({
            success: true,
            identityId,
            message: "Accounts successfully linked!"
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      
      case 'resolve': {
        // Resolve a user's identity across platforms
        const { platform, userId } = request
        
        if (!platform || !userId) {
          return new Response(
            JSON.stringify({ error: "Missing platform or userId" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          )
        }
        
        // Get the profile
        const { data: profile } = await supabase
          .from('platform_profiles')
          .select('*, identity:user_identities(*)')
          .eq('platform', platform)
          .eq('platform_user_id', userId)
          .single()
        
        if (!profile) {
          return new Response(
            JSON.stringify({ 
              identity: null,
              profiles: [],
              message: "User not found"
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        
        // If has identity, get all linked profiles
        if (profile.identity_id) {
          const { data: linkedProfiles } = await supabase
            .from('platform_profiles')
            .select('*')
            .eq('identity_id', profile.identity_id)
          
          return new Response(
            JSON.stringify({
              identity: profile.identity,
              profiles: linkedProfiles,
              confidence: profile.identity?.confidence_score || 50
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        
        // No identity yet, return just this profile
        return new Response(
          JSON.stringify({
            identity: null,
            profiles: [profile],
            confidence: 0
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      
      case 'analyze': {
        // Analyze potential identity matches
        const { platform, userId } = request
        
        if (!platform || !userId) {
          return new Response(
            JSON.stringify({ error: "Missing platform or userId" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          )
        }
        
        // Get the profile
        let { data: profile } = await supabase
          .from('platform_profiles')
          .select('*')
          .eq('platform', platform)
          .eq('platform_user_id', userId)
          .single()
        
        if (!profile) {
          // Create identity first, then profile
          const { data: newIdentity, error: identityError } = await supabase
            .from('user_identities')
            .insert({
              primary_platform: platform,
              display_name: request.data?.display_name || request.data?.username
            })
            .select()
            .single()
          
          if (!newIdentity || identityError) {
            return new Response(
              JSON.stringify({ error: "Failed to create identity", details: identityError }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            )
          }
          
          const { data: newProfile, error: profileError } = await supabase
            .from('platform_profiles')
            .insert({
              identity_id: newIdentity.id,
              platform,
              platform_user_id: userId,
              username: request.data?.username,
              display_name: request.data?.display_name
            })
            .select()
            .single()
          
          if (!newProfile || profileError) {
            return new Response(
              JSON.stringify({ error: "Failed to create profile", details: profileError }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            )
          }
          
          profile = newProfile
        }
        
        // Analyze patterns
        const matches = await analyzeIdentityPatterns(supabase, profile)
        
        // Store high-confidence matches as pending links
        for (const match of matches.filter(m => m.confidence >= 80)) {
          await supabase
            .from('identity_links')
            .upsert({
              source_profile_id: profile.id,
              target_profile_id: match.profile.id,
              link_type: `auto_${match.evidence.type}`,
              confidence: match.confidence,
              evidence: match.evidence,
              status: 'pending'
            })
        }
        
        return new Response(
          JSON.stringify({
            profileId: profile.id,
            potentialMatches: matches.slice(0, 5),
            autoLinked: matches.filter(m => m.confidence >= 80).length
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      
      case 'search': {
        // Search for users across platforms
        const { data: searchTerm } = request
        
        if (!searchTerm) {
          return new Response(
            JSON.stringify({ error: "Missing search term" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          )
        }
        
        const { data: results } = await supabase
          .from('platform_profiles')
          .select('*, identity:user_identities(*)')
          .or(`username.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`)
          .limit(20)
        
        // Group by identity
        const groupedResults = results?.reduce((acc: any, profile: any) => {
          const key = profile.identity_id || `unlinked_${profile.id}`
          if (!acc[key]) {
            acc[key] = {
              identity: profile.identity,
              profiles: []
            }
          }
          acc[key].profiles.push(profile)
          return acc
        }, {})
        
        return new Response(
          JSON.stringify({
            results: Object.values(groupedResults || {}),
            count: results?.length || 0
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      
      case 'unlink': {
        // Unlink accounts
        const { platform, userId, targetPlatform } = request
        
        if (!platform || !userId || !targetPlatform) {
          return new Response(
            JSON.stringify({ error: "Missing required fields" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          )
        }
        
        // Get profiles
        const { data: sourceProfile } = await supabase
          .from('platform_profiles')
          .select('*')
          .eq('platform', platform)
          .eq('platform_user_id', userId)
          .single()
        
        if (!sourceProfile || !sourceProfile.identity_id) {
          return new Response(
            JSON.stringify({ error: "No linked accounts found" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          )
        }
        
        const { data: targetProfile } = await supabase
          .from('platform_profiles')
          .select('*')
          .eq('platform', targetPlatform)
          .eq('identity_id', sourceProfile.identity_id)
          .single()
        
        if (!targetProfile) {
          return new Response(
            JSON.stringify({ error: "Target platform not linked" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          )
        }
        
        // Remove the link
        await supabase
          .from('identity_links')
          .delete()
          .or(`source_profile_id.eq.${sourceProfile.id},target_profile_id.eq.${sourceProfile.id}`)
          .or(`source_profile_id.eq.${targetProfile.id},target_profile_id.eq.${targetProfile.id}`)
        
        // Create new identity for the unlinked profile
        const { data: newIdentity } = await supabase
          .from('user_identities')
          .insert({
            primary_platform: targetPlatform,
            display_name: targetProfile.display_name
          })
          .select()
          .single()
        
        // Update target profile with new identity
        await supabase
          .from('platform_profiles')
          .update({ identity_id: newIdentity.id })
          .eq('id', targetProfile.id)
        
        // Log the action
        await supabase
          .from('identity_audit_log')
          .insert({
            identity_id: sourceProfile.identity_id,
            action: 'link_removed',
            actor_profile_id: sourceProfile.id,
            details: {
              unlinked_platform: targetPlatform
            }
          })
        
        return new Response(
          JSON.stringify({
            success: true,
            message: `${targetPlatform} account unlinked`
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      
      case 'merge': {
        // Merge two identities
        const { keepIdentityId, mergeIdentityId } = request.data || {}
        
        if (!keepIdentityId || !mergeIdentityId) {
          return new Response(
            JSON.stringify({ error: "Missing identity IDs" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          )
        }
        
        const { data: mergedId } = await supabase
          .rpc('merge_identities', {
            keep_identity_id: keepIdentityId,
            merge_identity_id: mergeIdentityId
          })
        
        return new Response(
          JSON.stringify({
            success: true,
            mergedIdentityId: mergedId
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
    }
    
  } catch (error) {
    console.error("Identity linker error:", error)
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        message: error.message
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})