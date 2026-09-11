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

// GET - Get single session detail with participants
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  
  const { id } = await params
  
  const { data: session, error } = await supabase
    .from('scoring_sessions')
    .select(`
      *,
      creator:profiles!created_by(name, email),
      participants:scoring_participants(
        id,
        user_id,
        name,
        joined_at,
        scores:scoring_scores(id, set_number, round_number, arrow_number, score)
      )
    `)
    .eq('id', id)
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  
  // Calculate summary for each participant
  const participantsWithSummary = session.participants?.map((p: { id: string; user_id: string; name: string; joined_at: string; scores: Array<{ set_number: number; score: number }> }) => {
    const scores = p.scores || []
    const totalArrows = session.arrows_per_round * session.rounds_per_set * session.sets
    const arrowsEntered = scores.length
    const totalScore = scores.reduce((sum: number, s: { score: number }) => sum + s.score, 0)
    
    // Group by set
    const setTotals: Record<number, number> = {}
    for (let i = 1; i <= session.sets; i++) {
      setTotals[i] = scores
        .filter((s: { set_number: number }) => s.set_number === i)
        .reduce((sum: number, s: { score: number }) => sum + s.score, 0)
    }
    
    return {
      ...p,
      arrows_entered: arrowsEntered,
      total_arrows: totalArrows,
      progress_percent: totalArrows > 0 ? Math.round((arrowsEntered / totalArrows) * 100) : 0,
      total_score: totalScore,
      set_totals: setTotals
    }
  }) || []
  
  return NextResponse.json({
    ...session,
    participants: participantsWithSummary
  })
}

// PUT - Update session (admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  
  const { id } = await params
  
  try {
    const body = await request.json()
    const { name, arrows_per_round, rounds_per_set, sets, status } = body
    
    // Check if session exists and get current config
    const { data: current } = await supabase
      .from('scoring_sessions')
      .select('arrows_per_round, rounds_per_set, sets')
      .eq('id', id)
      .single()
    
    if (!current) {
      return NextResponse.json({ error: 'Session tidak ditemukan' }, { status: 404 })
    }
    
    // Validate: if config changing and session has participants/scores, warn/block
    const configChanged = 
      arrows_per_round !== current.arrows_per_round ||
      rounds_per_set !== current.rounds_per_set ||
      sets !== current.sets
    
    if (configChanged) {
      const { count: participantCount } = await supabase
        .from('scoring_participants')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', id)
      
      if (participantCount && participantCount > 0) {
        const { count: scoreCount } = await supabase
          .from('scoring_scores')
          .select('id', { count: 'exact', head: true })
          .in('participant_id', 
            (await supabase.from('scoring_participants').select('id').eq('session_id', id)).data?.map(p => p.id) || []
          )
        
        if (scoreCount && scoreCount > 0) {
          return NextResponse.json({ 
            error: 'Tidak dapat mengubah konfigurasi scoring karena sudah ada nilai yang diinput. Hapus nilai terlebih dahulu atau buat session baru.' 
          }, { status: 400 })
        }
      }
    }
    
    const updates: Record<string, unknown> = {}
    if (name) updates.name = name
    if (arrows_per_round) updates.arrows_per_round = arrows_per_round
    if (rounds_per_set) updates.rounds_per_set = rounds_per_set
    if (sets) updates.sets = sets
    if (status) updates.status = status
    
    const { data, error } = await supabase
      .from('scoring_sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    
    return NextResponse.json({ session: data })
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

// DELETE - Delete session (admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  
  const { id } = await params
  
  const { error } = await supabase
    .from('scoring_sessions')
    .delete()
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  return NextResponse.json({ success: true })
}