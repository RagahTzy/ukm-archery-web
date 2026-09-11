import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Server-side Supabase client with fetch timeout
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: (url, options = {}) => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout
      return fetch(url, {
        ...options,
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId))
    }
  }
})

// Helper: verify admin
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

// Helper: verify user
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
  
  let query = supabase
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
    const { name, arrows_per_round, rounds_per_set, sets } = body
    
    if (!name || !arrows_per_round || !rounds_per_set || !sets) {
      return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 })
    }
    
    if (arrows_per_round < 1 || arrows_per_round > 12) {
      return NextResponse.json({ error: 'Arrow per Rambahan harus 1-12' }, { status: 400 })
    }
    if (rounds_per_set < 1 || rounds_per_set > 10) {
      return NextResponse.json({ error: 'Rambahan per Set harus 1-10' }, { status: 400 })
    }
    if (sets < 1 || sets > 10) {
      return NextResponse.json({ error: 'Jumlah Set harus 1-10' }, { status: 400 })
    }
    
    // Generate unique code
    let code = generateCode()
    let attempts = 0
    while (attempts < 10) {
      const { data: existing } = await supabase.from('scoring_sessions').select('id').eq('code', code).single()
      if (!existing) break
      code = generateCode()
      attempts++
    }
    
    const { data, error } = await supabase
      .from('scoring_sessions')
      .insert({
        name,
        code,
        arrows_per_round,
        rounds_per_set,
        sets,
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