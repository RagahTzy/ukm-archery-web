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

// GET - Get single session detail with participants
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  
  const { id } = await params
  
  const { data: session, error } = await auth.userSupabase
    .from('scoring_sessions')
    .select(`
      *,
      creator:profiles!created_by(name, email),
      participants:scoring_participants(
        id,
        user_id,
        name,
        joined_at,
        scores:scoring_scores(id, round_number, arrow_number, score)
      )
    `)
    .eq('id', id)
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  
  // Calculate summary for each participant
  const participantsWithSummary = session.participants?.map((p: any) => {
    const scores = p.scores || []
    const totalArrows = session.arrows_per_round * session.rounds_per_session
    const arrowsEntered = scores.length
    const totalScore = scores.reduce((sum: number, s: any) => sum + s.score, 0)
    
    return {
      ...p,
      arrows_entered: arrowsEntered,
      total_arrows: totalArrows,
      progress_percent: totalArrows > 0 ? Math.round((arrowsEntered / totalArrows) * 100) : 0,
      total_score: totalScore,
      set_totals: {}
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
    const { name, arrows_per_round, rounds_per_session, status } = body
    
    const { data: current } = await auth.userSupabase
      .from('scoring_sessions')
      .select('arrows_per_round, rounds_per_session')
      .eq('id', id)
      .single()
    
    if (!current) {
      return NextResponse.json({ error: 'Session tidak ditemukan' }, { status: 404 })
    }
    
    // Hanya anggap config berubah jika field memang dikirim dalam body request
    // (bukan undefined). Ini penting supaya PUT { status: 'completed' } tidak
    // salah dianggap mengubah konfigurasi.
    const configChanged =
      (arrows_per_round !== undefined && arrows_per_round !== current.arrows_per_round) ||
      (rounds_per_session !== undefined && rounds_per_session !== current.rounds_per_session)
    
    if (configChanged) {
      const { count: participantCount } = await auth.userSupabase
        .from('scoring_participants')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', id)
      
      if (participantCount && participantCount > 0) {
        const { data: participants } = await auth.userSupabase
          .from('scoring_participants')
          .select('id')
          .eq('session_id', id)
        const { count: scoreCount } = await auth.userSupabase
          .from('scoring_scores')
          .select('id', { count: 'exact', head: true })
          .in('participant_id', participants?.map(p => p.id) || [])
        if (scoreCount && scoreCount > 0) {
          return NextResponse.json({ 
            error: 'Tidak dapat mengubah konfigurasi scoring karena sudah ada nilai yang diinput. Hapus nilai terlebih dahulu atau buat session baru.' 
          }, { status: 400 })
        }
      }
    }
    
    const updates: Record<string, any> = {}
    if (name) updates.name = name
    if (arrows_per_round) updates.arrows_per_round = arrows_per_round
    if (rounds_per_session) updates.rounds_per_session = rounds_per_session
    if (status) updates.status = status
    
    const { data, error } = await auth.userSupabase
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
  
  const { error } = await auth.userSupabase
    .from('scoring_sessions')
    .delete()
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  return NextResponse.json({ success: true })
}