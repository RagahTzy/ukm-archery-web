import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: (url, options = {}) => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeoutId))
    }
  }
})

async function verifyUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return { error: 'Unauthorized', status: 401 }
  
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return { error: 'Unauthorized', status: 401 }
  
  const { data: profile } = await supabase.from('profiles').select('role, status').eq('id', user.id).single()
  if (!profile || profile.status !== 'approved') {
    return { error: 'Forbidden: Account not approved', status: 403 }
  }
  
  return { user, profile }
}

export async function GET(request: NextRequest) {
  const auth = await verifyUser(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  const limit = parseInt(searchParams.get('limit') || '10')
  
  // Build query for participant scores with totals
  let query = supabase
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
        rounds_per_set,
        sets,
        status
      ),
      scoring_scores (
        score
      )
    `)
    .eq('scoring_sessions.status', 'completed') // Only show completed sessions
  
  if (sessionId) {
    query = query.eq('session_id', sessionId)
  }
  
  const { data: participants, error } = await query
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Calculate totals and rankings
  const leaderboard = (participants || []).map((p: { 
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
      rounds_per_set: number; 
      sets: number; 
      status: string 
    }[]; 
    scoring_scores: Array<{ score: number }> 
  }) => {
    const scores = p.scoring_scores || []
    const session = p.scoring_sessions?.[0]
    const totalScore = scores.reduce((sum: number, s: { score: number }) => sum + s.score, 0)
    const totalArrows = scores.length
    const expectedArrows = session?.arrows_per_round * session?.rounds_per_set * session?.sets || 0
    const avgScore = totalArrows > 0 ? totalScore / totalArrows : 0
    
    return {
      participant_id: p.id,
      name: p.name,
      user_id: p.user_id,
      session_id: p.session_id,
      session_name: session?.name || '',
      session_code: session?.code || '',
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