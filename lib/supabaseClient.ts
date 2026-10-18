import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Handle sesi expired / refresh token tidak valid
// Ketika autoRefreshToken gagal (misal token sudah di-revoke atau expired),
// Supabase akan emit event SIGNED_OUT. Kita tangkap dan redirect ke login
// supaya user tidak stuck di halaman dengan sesi yang sudah tidak valid.
if (typeof window !== 'undefined') {
  let lastPath = ''
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' && !session) {
      // Hanya redirect jika bukan sudah di halaman login/register
      const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/']
      const isPublicPage = publicPaths.some(p => window.location.pathname === p || window.location.pathname.startsWith(p + '?'))
      if (!isPublicPage && lastPath !== window.location.pathname) {
        lastPath = window.location.pathname
        window.location.href = '/login'
      }
    }
  })
}