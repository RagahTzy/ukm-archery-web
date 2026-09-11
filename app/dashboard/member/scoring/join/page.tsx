'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

type SessionInfo = {
  id: string
  name: string
  code: string
  arrows_per_round: number
  rounds_per_set: number
  sets: number
  status: string
  total_arrows: number
}

export default function JoinScoringPage() {
  const router = useRouter()
  const [step, setStep] = useState<'code' | 'confirm'>('code')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [alreadyJoined, setAlreadyJoined] = useState(false)
  const [userName, setUserName] = useState('')

  // Get user name on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
      if (profile) setUserName(profile.name)
    }
    getUser()
  }, [router])

  const handleCheckCode = async () => {
    if (!code.trim()) { setError('Masukkan kode scoring'); return }
    setError('')
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/scoring/join?code=${encodeURIComponent(code.toUpperCase())}`, {
              headers: { Authorization: `Bearer ${session?.access_token}` }
            })
      const json = await res.json()
      if (json.error) { setError(json.error); return }
      
      setSessionInfo(json.session)
      setAlreadyJoined(json.already_joined)
      setName(json.user_name)
      if (!json.already_joined) {
        setStep('confirm')
      } else {
        alert('Anda sudah bergabung ke session ini!')
        router.push('/dashboard/member')
      }
    } catch (err) {
      setError('Terjadi kesalahan, coba lagi')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!name.trim()) { setError('Nama tidak boleh kosong'); return }
    if (!sessionInfo) return
    
    setError('')
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/scoring/join', {
        method: 'POST',
        headers: { 
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session?.access_token}`
                },
        body: JSON.stringify({ code: sessionInfo.code, name })
      })
      const json = await res.json()
      if (json.error) { setError(json.error); return }
      
      alert(`Berhasil bergabung!\n\nAnda terdaftar sebagai: ${json.participant.name}\nScoring: ${json.session.name}`)
      router.push('/dashboard/member')
    } catch (err) {
      setError('Terjadi kesalahan, coba lagi')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    if (step === 'confirm') {
      setStep('code')
      setError('')
    } else {
      router.push('/dashboard/member')
    }
  }

  const S = {
    layout: { minHeight: '100vh', background: '#f8fbff', color: '#0f172a', fontFamily: "'DM Sans',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' },
    card: { background: '#ffffff', border: '2px solid rgba(15,23,82,0.35)', borderRadius: 28, padding: '40px 32px', width: '100%', maxWidth: 480, boxShadow: '0 32px 80px rgba(30,58,138,0.08)', position: 'relative' as const },
    iconWrap: { width: 70, height: 70, background: 'linear-gradient(135deg,#06b6d4,#22c55e)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 24px', color: '#ffffff' },
    title: { fontFamily: "'Playfair Display',serif", fontSize: 30, fontWeight: 700, color: '#0f172a', textAlign: 'center' as const, letterSpacing: '-0.02em', marginBottom: 8 },
    subtitle: { color: '#475569', fontSize: 15, textAlign: 'center' as const, marginBottom: 32, fontWeight: 400 },
    form: { display: 'flex', flexDirection: 'column' as const, gap: 20 },
    label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 },
    input: { width: '100%', background: '#f8fafc', border: '2px solid rgba(15,23,82,0.35)', borderRadius: 16, padding: '16px 18px', color: '#0f172a', fontSize: 17, fontFamily: "'DM Sans',sans-serif", outline: 'none', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.15em' },
    inputFocus: { borderColor: 'rgba(14,165,233,0.45)', background: '#f0f9ff', boxShadow: '0 0 0 4px rgba(14,165,233,0.12)' },
    error: { background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.2)', color: '#b91c1c', padding: '14px 16px', borderRadius: 14, fontSize: 14, marginBottom: 8 },
    infoBox: { background: 'rgba(219,234,254,0.35)', border: '2px solid rgba(15,23,82,0.35)', color: '#0f172a', padding: '16px', borderRadius: 14, fontSize: 14, lineHeight: 1.6, marginBottom: 20 },
    btn: { width: '100%', padding: '16px', background: 'linear-gradient(135deg,#06b6d4 0%,#22c55e 50%,#f59e0b 100%)', color: '#ffffff', fontWeight: 700, fontSize: 16, letterSpacing: '0.04em', border: 'none', borderRadius: 16, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.2s', marginTop: 8 },
    btnSecondary: { width: '100%', padding: '14px', background: '#f1f5f9', color: '#475569', border: '1px solid rgba(15,23,82,0.2)', fontWeight: 600, fontSize: 15, borderRadius: 14, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.2s', marginTop: 12 },
    sessionInfo: { background: '#f8fafc', border: '2px solid rgba(15,23,82,0.2)', borderRadius: 16, padding: '20px', marginBottom: 24 },
    sessionRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(15,23,82,0.1)' },
    sessionLabel: { fontSize: 13, color: '#64748b', fontWeight: 600 },
    sessionValue: { fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, color: '#0f172a' },
    divider: { height: '1px', background: 'rgba(30,58,138,0.18)', margin: '24px 0' },
    footerText: { textAlign: 'center' as const, fontSize: 14, color: '#64748b' },
    footerLink: { color: '#0ea5e9', textDecoration: 'none', fontWeight: 600 }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:linear-gradient(135deg,#ecfeff 0%,#d9f99d 55%,#fde68a 100%);font-family:'DM Sans',sans-serif;}
        input::placeholder{color:#94a3b8;}
        input:focus{border-color:rgba(14,165,233,0.45);background:#f0f9ff;box-shadow:0 0 0 4px rgba(14,165,233,0.12);}
        .btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 18px 36px rgba(14,165,233,0.25);}
        .btn:disabled{opacity:0.6;cursor:not-allowed;}
        .btn-secondary:hover{background:#e2e8f0;}
        @media (min-width: 640px) {
          .card { padding: 48px 44px; }
          .title { font-size: 36px; }
          .iconWrap { width: 80px; height: 80px; font-size: 32px; margin-bottom: 28px; }
        }
      `}</style>

      <div style={S.layout}>
        <div style={S.card}>
          <div style={S.iconWrap}>🏹</div>
          
          {step === 'code' ? (
            <>
              <h1 style={S.title}>Masukkan Kode Scoring</h1>
              <p style={S.subtitle}>Bergabung ke sesi scoring panahan UKM</p>
              
              {error && <div style={S.error}>{error}</div>}
              
              <div style={S.form}>
                <div>
                  <label style={S.label}>Kode Scoring (6 Karakter)</label>
                  <input
                    style={S.input}
                    type="text"
                    placeholder="Contoh: A7K92P"
                    maxLength={6}
                    value={code.toUpperCase()}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleCheckCode()}
                    autoFocus
                  />
                </div>
                <button style={S.btn} onClick={handleCheckCode} disabled={loading}>
                  {loading ? 'Memeriksa...' : 'Cek Kode & Lanjutkan →'}
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 style={S.title}>Konfirmasi Bergabung</h1>
              <p style={S.subtitle}>Pastikan data berikut sudah benar</p>
              
              {sessionInfo && (
                <div style={S.sessionInfo}>
                  <div style={S.sessionRow}>
                    <span style={S.sessionLabel}>Scoring</span>
                    <span style={S.sessionValue}>{sessionInfo.name}</span>
                  </div>
                  <div style={S.sessionRow}>
                    <span style={S.sessionLabel}>Kode</span>
                    <span style={{fontFamily:'monospace',fontSize:16,fontWeight:700,color:'#06b6d4'}}>{sessionInfo.code}</span>
                  </div>
                  <div style={S.sessionRow}>
                    <span style={S.sessionLabel}>Konfigurasi</span>
                    <span style={S.sessionValue}>{sessionInfo.arrows_per_round} Arrow × {sessionInfo.rounds_per_set} Rambahan × {sessionInfo.sets} Set</span>
                  </div>
                  <div style={S.sessionRow}>
                    <span style={S.sessionLabel}>Total Arrow</span>
                    <span style={S.sessionValue}>{sessionInfo.total_arrows} per peserta</span>
                  </div>
                </div>
              )}
              
              {error && <div style={S.error}>{error}</div>}
              
              <div style={S.form}>
                <div>
                  <label style={S.label}>Nama Anda</label>
                  <input
                    type="text"
                    placeholder="Masukkan nama lengkap"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={{...S.input, textTransform: 'none', letterSpacing: 'normal'}}
                  />
                </div>
                <button style={S.btn} onClick={handleJoin} disabled={loading}>
                  {loading ? 'Mendaftarkan...' : 'Bergabung ke Scoring →'}
                </button>
              </div>
            </>
          )}

          <div style={S.divider} />
          <button style={S.btnSecondary} onClick={handleBack}>
            {step === 'code' ? '← Kembali ke Dashboard' : '← Ganti Kode'}
          </button>
        </div>
      </div>
    </>
  )
}