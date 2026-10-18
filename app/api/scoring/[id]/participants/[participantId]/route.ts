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

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return { error: 'Unauthorized', status: 401 }
  
  const token = authHeader.replace('Bearer ', '')
  
  // Create client with user's token for proper RLS context
  const userSupabase = createUserSupabase(token)
  
  // Get user by calling auth endpoint directly (bypasses internal auth client)
  const { user, error: authError } = await getUserFromToken(token)
  if (authError || !user) return { error: 'Unauthorized', status: 401 }
  
  const { data: profile, error: profileError } = await userSupabase
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .single()
    
  if (profileError || !profile || profile.role !== 'admin' || profile.status !== 'approved') {
    return { error: 'Forbidden: Admin only', status: 403 }
  }
  
  return { user, profile, userSupabase }
}

// GET - Get scores for a specific participant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  
  const { id, participantId } = await params
  
  // Get session config
  const { data: session } = await auth.userSupabase
    .from('scoring_sessions')
    .select('arrows_per_round, rounds_per_session')
    .eq('id', id)
    .single()
  
  if (!session) {
    return NextResponse.json({ error: 'Session tidak ditemukan' }, { status: 404 })
  }
  
  // Get participant
  const { data: participant } = await auth.userSupabase
    .from('scoring_participants')
    .select('*')
    .eq('id', participantId)
    .eq('session_id', id)
    .single()
  
  if (!participant) {
    return NextResponse.json({ error: 'Peserta tidak ditemukan' }, { status: 404 })
  }
  
  // Get all scores for this participant
  const { data: scores } = await auth.userSupabase
    .from('scoring_scores')
    .select('*')
    .eq('participant_id', participantId)
    .order('round_number')
    .order('arrow_number')
  
  // Build nested structure: Round -> Arrow (no sets)
  const structure: Record<number, Record<number, number>> = {}
  for (let round = 1; round <= session.rounds_per_session; round++) {
    structure[round] = {}
    for (let arrow = 1; arrow <= session.arrows_per_round; arrow++) {
      const score = scores?.find(s => s.round_number === round && s.arrow_number === arrow)
      structure[round][arrow] = score?.score ?? 0
    }
  }
  
  // Calculate totals
  const roundTotals: Record<number, number> = {}
  let grandTotal = 0
  
  for (let round = 1; round <= session.rounds_per_session; round++) {
    let roundTotal = 0
    for (let arrow = 1; arrow <= session.arrows_per_round; arrow++) {
      roundTotal += structure[round][arrow]
    }
    roundTotals[round] = roundTotal
    grandTotal += roundTotal
  }
  
  return NextResponse.json({
    participant,
    session_config: session,
    scores: structure,
    round_totals: roundTotals,
    set_totals: {},
    grand_total: grandTotal
  })
}

// POST - Save scores for a participant (bulk update)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  
  const { id, participantId } = await params
  
  try {
    const body = await request.json()
    const { scores } = body // Array of { round_number, arrow_number, score }
    
    if (!scores || !Array.isArray(scores)) {
      return NextResponse.json({ error: 'Format scores tidak valid' }, { status: 400 })
    }
    
    // Verify participant exists
    const { data: participant } = await auth.userSupabase
      .from('scoring_participants')
      .select('id')
      .eq('id', participantId)
      .eq('session_id', id)
      .single()
    
    if (!participant) {
      return NextResponse.json({ error: 'Peserta tidak ditemukan' }, { status: 404 })
    }
    
    // Upsert scores (without set_number)
    const upsertData = scores.map(s => ({
      participant_id: participantId,
      round_number: s.round_number,
      arrow_number: s.arrow_number,
      score: s.score,
      updated_at: new Date().toISOString()
    }))
    
    const { error } = await auth.userSupabase
      .from('scoring_scores')
      .upsert(upsertData, { onConflict: 'participant_id,round_number,arrow_number' })
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    
    return NextResponse.json({ success: true, count: upsertData.length })
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}