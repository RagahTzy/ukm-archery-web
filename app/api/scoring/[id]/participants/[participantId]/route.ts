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

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return { error: 'Unauthorized', status: 401 }
  
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return { error: 'Unauthorized', status: 401 }
  
  const { data: profile } = await supabase.from('profiles').select('role, status').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin' || profile.status !== 'approved') {
    return { error: 'Forbidden: Admin only', status: 403 }
  }
  
  return { user, profile }
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
  const { data: session } = await supabase
    .from('scoring_sessions')
    .select('arrows_per_round, rounds_per_set, sets')
    .eq('id', id)
    .single()
  
  if (!session) {
    return NextResponse.json({ error: 'Session tidak ditemukan' }, { status: 404 })
  }
  
  // Get participant
  const { data: participant } = await supabase
    .from('scoring_participants')
    .select('*')
    .eq('id', participantId)
    .eq('session_id', id)
    .single()
  
  if (!participant) {
    return NextResponse.json({ error: 'Peserta tidak ditemukan' }, { status: 404 })
  }
  
  // Get all scores for this participant
  const { data: scores } = await supabase
    .from('scoring_scores')
    .select('*')
    .eq('participant_id', participantId)
    .order('set_number')
    .order('round_number')
    .order('arrow_number')
  
  // Build nested structure: Set -> Round -> Arrow
  const structure: Record<number, Record<number, Record<number, number>>> = {}
  for (let set = 1; set <= session.sets; set++) {
    structure[set] = {}
    for (let round = 1; round <= session.rounds_per_set; round++) {
      structure[set][round] = {}
      for (let arrow = 1; arrow <= session.arrows_per_round; arrow++) {
        const score = scores?.find(s => s.set_number === set && s.round_number === round && s.arrow_number === arrow)
        structure[set][round][arrow] = score?.score ?? 0
      }
    }
  }
  
  // Calculate totals
  const roundTotals: Record<number, Record<number, number>> = {}
  const setTotals: Record<number, number> = {}
  let grandTotal = 0
  
  for (let set = 1; set <= session.sets; set++) {
    setTotals[set] = 0
    roundTotals[set] = {}
    for (let round = 1; round <= session.rounds_per_set; round++) {
      let roundTotal = 0
      for (let arrow = 1; arrow <= session.arrows_per_round; arrow++) {
        roundTotal += structure[set][round][arrow]
      }
      roundTotals[set][round] = roundTotal
      setTotals[set] += roundTotal
    }
    grandTotal += setTotals[set]
  }
  
  return NextResponse.json({
    participant,
    session_config: session,
    scores: structure,
    round_totals: roundTotals,
    set_totals: setTotals,
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
    const { scores } = body // Array of { set_number, round_number, arrow_number, score }
    
    if (!scores || !Array.isArray(scores)) {
      return NextResponse.json({ error: 'Format scores tidak valid' }, { status: 400 })
    }
    
    // Verify participant exists
    const { data: participant } = await supabase
      .from('scoring_participants')
      .select('id')
      .eq('id', participantId)
      .eq('session_id', id)
      .single()
    
    if (!participant) {
      return NextResponse.json({ error: 'Peserta tidak ditemukan' }, { status: 404 })
    }
    
    // Upsert scores
    const upsertData = scores.map(s => ({
      participant_id: participantId,
      set_number: s.set_number,
      round_number: s.round_number,
      arrow_number: s.arrow_number,
      score: s.score,
      updated_at: new Date().toISOString()
    }))
    
    const { error } = await supabase
      .from('scoring_scores')
      .upsert(upsertData, { onConflict: 'participant_id,set_number,round_number,arrow_number' })
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    
    return NextResponse.json({ success: true, count: upsertData.length })
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}