'use client'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isValidToken, setIsValidToken] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check if user has valid session from reset password link
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        setIsValidToken(true)
      } else {
        setError('Link reset password tidak valid atau sudah kadaluarsa. Silakan minta link baru.')
        setIsValidToken(false)
      }
    }

    checkSession()
  }, [searchParams])

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      setError('Semua field wajib diisi')
      return
    }

    if (password.length < 6) {
      setError('Password minimal 6 karakter')
      return
    }

    if (password !== confirmPassword) {
      setError('Password dan konfirmasi password tidak cocok')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (err) {
      setError('Terjadi kesalahan, coba lagi')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:linear-gradient(135deg,#ecfeff 0%,#d9f99d 55%,#fef3c7 100%);font-family:'DM Sans',sans-serif;}
        .page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px 24px;font-family:'DM Sans',sans-serif;position:relative;overflow:hidden;}
        .orb1{position:absolute;width:320px;height:320px;background:radial-gradient(circle,rgba(6,182,212,0.25) 0%,transparent 70%);top:-90px;right:-60px;pointer-events:none;}
        .orb2{position:absolute;width:280px;height:280px;background:radial-gradient(circle,rgba(245,158,11,0.22) 0%,transparent 70%);bottom:-70px;left:-40px;pointer-events:none;}
        .card{background:#ffffff;border:2px solid rgba(15,23,82,0.35);border-radius:28px;padding:32px 24px;width:100%;max-width:440px;position:relative;box-shadow:0 32px 80px rgba(30,58,138,0.08);}
        .icon-wrap{width:60px;height:60px;background:linear-gradient(135deg,#06b6d4,#22c55e);border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 20px;color:#ffffff;}
        h1{font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#0f172a;text-align:center;letter-spacing:-0.03em;}
        .subtitle{color:#475569;font-size:14px;text-align:center;margin-top:6px;font-weight:400;line-height:1.6;}
        .form{display:flex;flex-direction:column;gap:18px;margin-top:32px;}
        label{display:block;font-size:11px;font-weight:600;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;}
        input{width:100%;background:#f8fafc;border:2px solid rgba(15,23,82,0.35);border-radius:14px;padding:14px 16px;color:#0f172a;font-size:15px;font-family:'DM Sans',sans-serif;outline:none;transition:all 0.2s;}
        input::placeholder{color:#94a3b8;}
        input:focus{border-color:rgba(14,165,233,0.45);background:#f0f9ff;box-shadow:0 0 0 4px rgba(14,165,233,0.12);}
        .btn{width:100%;padding:14px;background:linear-gradient(135deg,#06b6d4 0%,#22c55e 50%,#f59e0b 100%);color:#ffffff;font-weight:700;font-size:15px;letter-spacing:0.04em;border:none;border-radius:14px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.2s;margin-top:4px;}
        .btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 18px 36px rgba(14,165,233,0.25);}
        .btn:disabled{opacity:0.6;cursor:not-allowed;}
        .error{background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.2);color:#b91c1c;padding:12px 14px;border-radius:12px;font-size:13px;margin-bottom:4px;}
        .success{background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.2);color:#166534;padding:12px 14px;border-radius:12px;font-size:13px;line-height:1.6;}
        .info{background:rgba(219,234,254,0.35);border:2px solid rgba(15,23,82,0.35);color:#0f172a;padding:12px 14px;border-radius:12px;font-size:13px;line-height:1.6;}
        .divider{height:2px;background:rgba(15,23,82,0.35);margin:28px 0;}
        .footer-text{text-align:center;font-size:13px;color:#64748b;}
        .footer-text a{color:#0ea5e9;text-decoration:none;font-weight:600;}
        .footer-text a:hover{text-decoration:underline;}
        @media (min-width: 640px) {
          .page { padding: 24px; }
          .orb1 { width: 520px; height: 520px; top: -180px; right: -120px; }
          .orb2 { width: 420px; height: 420px; bottom: -140px; left: -80px; }
          .card { padding: 44px 38px; }
          h1 { font-size: 34px; }
        }
      `}</style>
      <div className="page">
        <div className="orb1" /><div className="orb2" />
        <div className="card">
          <div className="icon-wrap">
            <img src="/logo_ukm.jpg" alt="Logo UKM" />
          </div>
          <h1>Reset Password</h1>
          <p className="subtitle">Masukkan password baru untuk akun Anda</p>
          <div className="form">
            {error && <div className="error">{error}</div>}
            {success && (
              <div className="success">
                ✓ Password berhasil direset! Redirecting ke halaman login...
              </div>
            )}
            {!success && isValidToken && (
              <>
                <div className="info">
                  🔐 Password harus minimal 6 karakter untuk keamanan akun Anda.
                </div>
                <div>
                  <label>Password Baru</label>
                  <input
                    type="password"
                    placeholder="Minimal 6 karakter"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label>Konfirmasi Password</label>
                  <input
                    type="password"
                    placeholder="Ulangi password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
                  />
                </div>
                <button
                  className="btn"
                  onClick={handleResetPassword}
                  disabled={loading}
                >
                  {loading ? 'Memproses...' : 'Reset Password →'}
                </button>
              </>
            )}
          </div>
          <div className="divider" />
          <p className="footer-text">
            Kembali ke <Link href="/login">Masuk</Link>
          </p>
        </div>
      </div>
    </>
  )
}

export default function ResetPassword() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
