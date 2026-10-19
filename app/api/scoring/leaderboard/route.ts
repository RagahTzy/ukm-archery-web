import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a Supabase client with custom fetch that injects the user's JWT for RLS
function createUserSupabase(token: string) {
  return createClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: (url, options = {}) => {
        // In Next.js API routes, Supabase client doesn't pass headers to custom fetch
        // We MUST manually inject BOTH apikey and user's JWT Authorization
        const incoming = Object.fromEntries(new Headers(options.headers).entries())
        // Remove any existing Authorization header to avoid duplicates
        const { authorization, Authorization, ...cleanIncoming } = incoming
        const headers = {
          ...cleanIncoming,
          apikey: supabaseKey,
          Authorization: `Bearer ${token}`,  // Only set ONCE
        }
        return fetch(url, {
          ...options,
          headers,
        })
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Helper: get user from token by calling auth endpoint directly
async function getUserFromToken(token: string) {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) {
    const error = await res.json()
    return { user: null, error: { message: error.msg || 'Invalid token' } }
  }
  return { user: await res.json(), error: null }
}

async function verifyUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return { error: 'Unauthorized', status: 401 }
  
  const token = authHeader.replace('Bearer ', '')
  
  // Create client with user's token for proper RLS context
  const userSupabase = createUserSupabase(token)
  
  // Get user by calling auth endpoint directly (bypasses internal auth client)
  const { user, error: authError } = await getUserFromToken(token)
  if (authError || !user) return { error: 'Unauthorized', status: 401 }
  
  const { data: profile } = await userSupabase.from('profiles').select('role, status').eq('id', user.id).single()
  if (!profile || profile.status !== 'approved') {
    return { error: 'Forbidden: Account not approved', status: 403 }
  }
  
  return { user, profile, userSupabase }
}

export async function GET(request: NextRequest) {
  const auth = await verifyUser(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  const distance = searchParams.get('distance')
  const limit = parseInt(searchParams.get('limit') || '10')

  // Build query for participant scores with totals
  let query = auth.userSupabase
    .from('scoring_participants')
    .select(`
      id,
      name,
      user_id,
      joined_at,
      session_id,
      scoring_sessions!inner (
        id,
        name,
        code,
        arrows_per_round,
        rounds_per_session,
        distance,
        status
      ),
      scoring_scores (
        score
      )
    `)
    .eq('scoring_sessions.status', 'completed')

  if (sessionId) {
    query = query.eq('session_id', sessionId)
  }

  if (distance) {
    query = query.eq('scoring_sessions.distance', parseInt(distance))
  }

  const { data: participants, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // DEBUG: Log raw response structure
  console.log('[LEADERBOARD DEBUG] Total participants:', participants?.length)
  if (participants && participants.length > 0) {
    const first = participants[0]
    console.log('[LEADERBOARD DEBUG] First participant keys:', Object.keys(first))
    console.log('[LEADERBOARD DEBUG] scoring_sessions type:', typeof first.scoring_sessions, Array.isArray(first.scoring_sessions))
    console.log('[LEADERBOARD DEBUG] scoring_sessions value:', JSON.stringify(first.scoring_sessions, null, 2))
  }

  // Type for participant with correct scoring_sessions shape (single object from !inner join)
  type ParticipantWithSession = {
    id: string;
    name: string;
    user_id: string;
    joined_at: string;
    session_id: string;
    scoring_sessions: {
      id: string;
      name: string;
      code: string;
      arrows_per_round: number;
      rounds_per_session: number;
      distance?: number;
      status: string
    } | null;
    scoring_scores: Array<{ score: number }>
  }

  // Calculate totals and rankings
  const leaderboard = ((participants || []) as unknown as ParticipantWithSession[]).map((p) => {
    const scores = p.scoring_scores || []
    const session = p.scoring_sessions  // Direct access, not array
    const totalScore = scores.reduce((sum: number, s: { score: number }) => sum + s.score, 0)
    const totalArrows = scores.length
    const expectedArrows = session?.arrows_per_round * session?.rounds_per_session || 0
    const avgScore = totalArrows > 0 ? totalScore / totalArrows : 0

    return {
      participant_id: p.id,
      name: p.name,
      user_id: p.user_id,
      session_id: p.session_id,
      session_name: session?.name || '',
      session_code: session?.code || '',
      session_distance: session?.distance || 0,
      total_score: totalScore,
      arrows_entered: totalArrows,
      total_arrows: expectedArrows,
      progress_percent: expectedArrows > 0 ? Math.round((totalArrows / expectedArrows) * 100) : 0,
      avg_score: Math.round(avgScore * 100) / 100,
      joined_at: p.joined_at
    }
  })

  // Sort by total score DESC, then by avg score DESC, then by arrows entered DESC
  leaderboard.sort((a, b) => {
    if (b.total_score !== a.total_score) return b.total_score - a.total_score
    if (b.avg_score !== a.avg_score) return b.avg_score - a.avg_score
    return b.arrows_entered - a.arrows_entered
  })

  // Add rank
  const rankedLeaderboard = leaderboard.slice(0, limit).map((item, index) => ({
    ...item,
    rank: index + 1
  }))

  return NextResponse.json({ leaderboard: rankedLeaderboard })
}