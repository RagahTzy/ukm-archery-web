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
  
  const { data: profile } = await supabase.from('profiles').select('name, role, status').eq('id', user.id).single()
  if (!profile || profile.status !== 'approved') {
    return { error: 'Forbidden: Account not approved', status: 403 }
  }
  
  return { user, profile }
}

// GET - Get session info by code (for join page)
export async function GET(request: NextRequest) {
  const auth = await verifyUser(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (!code) {
    return NextResponse.json({ error: 'Kode scoring diperlukan' }, { status: 400 })
  }
  
  const { data: session, error } = await supabase
    .from('scoring_sessions')
    .select('id, name, code, arrows_per_round, rounds_per_set, sets, status')
    .eq('code', code.toUpperCase())
    .single()
  
  if (error || !session) {
    return NextResponse.json({ error: 'Kode scoring tidak ditemukan' }, { status: 404 })
  }
  
  if (session.status !== 'active') {
    return NextResponse.json({ error: 'Session scoring tidak aktif atau sudah selesai' }, { status: 400 })
  }
  
  // Check if user already joined
  const { data: existing } = await supabase
    .from('scoring_participants')
    .select('id')
    .eq('session_id', session.id)
    .eq('user_id', auth.user.id)
    .single()
  
  return NextResponse.json({
    session: {
      ...session,
      total_arrows: session.arrows_per_round * session.rounds_per_set * session.sets
    },
    already_joined: !!existing,
    user_name: auth.profile.name
  })
}

// POST - Join scoring session
export async function POST(request: NextRequest) {
  const auth = await verifyUser(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  
  try {
    const body = await request.json()
    const { code, name } = body
    
    if (!code) {
      return NextResponse.json({ error: 'Kode scoring diperlukan' }, { status: 400 })
    }
    
    const { data: session, error: sessionError } = await supabase
      .from('scoring_sessions')
      .select('id, name, code, status')
      .eq('code', code.toUpperCase())
      .single()
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Kode scoring tidak ditemukan' }, { status: 404 })
    }
    
    if (session.status !== 'active') {
      return NextResponse.json({ error: 'Session scoring tidak aktif atau sudah selesai' }, { status: 400 })
    }
    
    // Check if already joined
    const { data: existing } = await supabase
      .from('scoring_participants')
      .select('id')
      .eq('session_id', session.id)
      .eq('user_id', auth.user.id)
      .single()
    
    if (existing) {
      return NextResponse.json({ error: 'Anda sudah bergabung ke session ini' }, { status: 400 })
    }
    
    // Join session
    const { data: participant, error: joinError } = await supabase
      .from('scoring_participants')
      .insert({
        session_id: session.id,
        user_id: auth.user.id,
        name: name || auth.profile.name
      })
      .select()
      .single()
    
    if (joinError) return NextResponse.json({ error: joinError.message }, { status: 500 })
    
    return NextResponse.json({
      participant,
      session: {
        id: session.id,
        name: session.name,
        code: session.code
      }
    }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}