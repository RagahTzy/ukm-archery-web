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
  
  const { data: profile } = await userSupabase.from('profiles').select('name, role, status').eq('id', user.id).single()
  if (!profile || profile.status !== 'approved') {
    return { error: 'Forbidden: Account not approved', status: 403 }
  }
  
  return { user, profile, userSupabase }
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
  
  const { data: session, error } = await auth.userSupabase
    .from('scoring_sessions')
    .select('id, name, code, arrows_per_round, rounds_per_session, distance, status')
    .eq('code', code.toUpperCase())
    .single()

  if (error || !session) {
    return NextResponse.json({ error: 'Kode scoring tidak ditemukan' }, { status: 404 })
  }

  if (session.status !== 'active') {
    return NextResponse.json({ error: 'Session scoring tidak aktif atau sudah selesai' }, { status: 400 })
  }

  // Check if user already joined
  const { data: existing } = await auth.userSupabase
    .from('scoring_participants')
    .select('id')
    .eq('session_id', session.id)
    .eq('user_id', auth.user.id)
    .single()

  return NextResponse.json({
    session: {
      ...session,
      total_arrows: session.arrows_per_round * session.rounds_per_session
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
    
    const { data: session, error: sessionError } = await auth.userSupabase
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
    const { data: existing } = await auth.userSupabase
      .from('scoring_participants')
      .select('id')
      .eq('session_id', session.id)
      .eq('user_id', auth.user.id)
      .single()
    
    if (existing) {
      return NextResponse.json({ error: 'Anda sudah bergabung ke session ini' }, { status: 400 })
    }
    
    // Join session
    const { data: participant, error: joinError } = await auth.userSupabase
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