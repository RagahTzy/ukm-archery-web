import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a Supabase client with custom fetch that injects the user's JWT for RLS
function createUserSupabase(token: string) {
  return createClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: (url, options = {}) => {
        console.log('[API createUserSupabase fetch] url:', url)
        console.log('[API createUserSupabase fetch] incoming headers:', Object.fromEntries(new Headers(options.headers).entries()))
        console.log('[API createUserSupabase fetch] supabaseKey len:', supabaseKey.length)
        console.log('[API createUserSupabase fetch] token len:', token.length)
        // In Next.js API routes, Supabase client doesn't pass headers to custom fetch
        // We MUST manually inject BOTH apikey and user's JWT Authorization
        // Use plain object for headers - ONLY set Authorization ONCE (capitalized)
        const incoming = Object.fromEntries(new Headers(options.headers).entries())
        // Remove any existing Authorization header to avoid duplicates
        const { authorization, Authorization, ...cleanIncoming } = incoming
        const headers = {
          ...cleanIncoming,
          apikey: supabaseKey,
          Authorization: `Bearer ${token}`,  // Only set ONCE
        }
        console.log('[API createUserSupabase fetch] outgoing headers:', headers)
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
  console.log('[getUserFromToken] calling auth/v1/user with token len:', token.length)
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${token}`,
    },
  })
  console.log('[getUserFromToken] response status:', res.status)
  if (!res.ok) {
    const error = await res.json()
    console.log('[getUserFromToken] error:', error)
    return { user: null, error: { message: error.msg || 'Invalid token' } }
  }
  const user = await res.json()
  console.log('[getUserFromToken] user:', user?.email)
  return { user, error: null }
}

// Helper: verify admin - create client with user's token
async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return { error: 'Unauthorized', status: 401 }
  
  const token = authHeader.replace('Bearer ', '')
  
  // Create client with user's token for proper RLS context
  const userSupabase = createUserSupabase(token)
  
  // Get user by calling auth endpoint directly (bypasses internal auth client)
  const { user, error: authError } = await getUserFromToken(token)
  console.log('[verifyAdmin] getUserFromToken result:', { user: user?.email, userId: user?.id, error: authError?.message })
  if (authError || !user) return { error: 'Unauthorized', status: 401 }
  
  const { data: profile, error: profileError } = await userSupabase
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .single()
    
  console.log('[verifyAdmin] profile query result:', { profile, profileError: profileError?.message, profileErrorCode: profileError?.code, userId: user.id })
  if (profileError || !profile || profile.role !== 'admin' || profile.status !== 'approved') {
    return { error: 'Forbidden: Admin only', status: 403 }
  }
  
  return { user, profile, userSupabase }
}

// Helper: verify user
async function verifyUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return { error: 'Unauthorized', status: 401 }
  
  const token = authHeader.replace('Bearer ', '')
  
  const userSupabase = createUserSupabase(token)
  
  const { user, error: authError } = await getUserFromToken(token)
  if (authError || !user) return { error: 'Unauthorized', status: 401 }
  
  const { data: profile, error: profileError } = await userSupabase
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .single()
    
  if (profileError || !profile || profile.status !== 'approved') {
    return { error: 'Forbidden: Account not approved', status: 403 }
  }
  
  return { user, profile, userSupabase }
}

// Generate unique code
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// GET - List all scoring sessions (admin)
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit
  
  let query = auth.userSupabase
    .from('scoring_sessions')
    .select(`
      *,
      creator:profiles!created_by(name, email),
      participants:scoring_participants(count)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }
  
  const { data, error, count } = await query
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  return NextResponse.json({
    sessions: data?.map(s => ({
      ...s,
      participant_count: s.participants?.[0]?.count || 0
    })) || [],
    total: count || 0,
    page,
    limit
  })
}

// POST - Create new scoring session (admin)
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  
  try {
    const body = await request.json()
    const { name, arrows_per_round, rounds_per_session } = body
    
    if (!name || !arrows_per_round || !rounds_per_session) {
      return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 })
    }
    
    if (arrows_per_round < 1 || arrows_per_round > 12) {
      return NextResponse.json({ error: 'Arrow per Rambahan harus 1-12' }, { status: 400 })
    }
    if (rounds_per_session < 1 || rounds_per_session > 20) {
      return NextResponse.json({ error: 'Rambahan per Sesi harus 1-20' }, { status: 400 })
    }
    
    // Generate unique code
    let code = generateCode()
    let attempts = 0
    while (attempts < 10) {
      const { data: existing } = await auth.userSupabase.from('scoring_sessions').select('id').eq('code', code).single()
      if (!existing) break
      code = generateCode()
      attempts++
    }
    
    const { data, error } = await auth.userSupabase
      .from('scoring_sessions')
      .insert({
        name,
        code,
        arrows_per_round,
        rounds_per_session,
        status: 'draft',
        created_by: auth.user.id
      })
      .select()
      .single()
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    
    return NextResponse.json({ session: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}