'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useParams } from 'next/navigation'

type Participant = {
  id: string
  user_id: string
  name: string
  joined_at: string
  arrows_entered: number
  total_arrows: number
  progress_percent: number
  total_score: number
  set_totals: Record<number, number>
}

type ScoringSession = {
  id: string
  name: string
  code: string
  arrows_per_round: number
  rounds_per_set: number
  sets: number
  status: 'draft' | 'active' | 'completed'
  created_at: string
  updated_at: string
  creator: { name: string; email: string } | null
}

export default function ScoringDetailPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string
  
  const [session, setSession] = useState<ScoringSession | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null)

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession) { router.push('/login'); return }
      
      const res = await fetch(`/api/scoring/${sessionId}`, {
              headers: { Authorization: `Bearer ${authSession.access_token}` }
            })
      const json = await res.json()
      if (json.error) { alert(json.error); router.push('/dashboard/admin/scoring'); return }
      
      setSession({
        id: json.id,
        name: json.name,
        code: json.code,
        arrows_per_round: json.arrows_per_round,
        rounds_per_set: json.rounds_per_set,
        sets: json.sets,
        status: json.status,
        created_at: json.created_at,
        updated_at: json.updated_at,
        creator: json.creator
      })
      setParticipants(json.participants || [])
    } catch (err) {
      console.error('Error fetching detail:', err)
    } finally {
      setLoading(false)
    }
  }, [sessionId, router])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  const handleScoreClick = (participantId: string) => {
    router.push(`/dashboard/admin/scoring/${sessionId}/score/${participantId}`)
  }

  const handleBack = () => router.push('/dashboard/admin/scoring')

  const handleCopyCode = () => {
    navigator.clipboard.writeText(session?.code || '')
    alert('Kode disalin ke clipboard!')
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; border: string; label: string }> = {
      draft: { bg: '#fef9c3', color: '#b45309', border: 'rgba(15,23,82,0.35)', label: 'Draft' },
      active: { bg: '#d1fae5', color: '#166534', border: 'rgba(15,23,82,0.35)', label: 'Aktif' },
      completed: { bg: '#e0e7ff', color: '#3730a3', border: 'rgba(15,23,82,0.35)', label: 'Selesai' }
    }
    const s = styles[status] || styles.draft
    return (
      <span style={{
        padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
        color: s.color, background: s.bg, border: `2px solid ${s.border}`
      }}>{s.label}</span>
    )
  }

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return '#22c55e'
    if (percent >= 50) return '#0ea5e9'
    return '#f87171'
  }

  const S = {
    layout: { minHeight: '100vh', background: '#f8fbff', color: '#0f172a', fontFamily: "'DM Sans',sans-serif" },
    topbar: { background: 'linear-gradient(135deg,#ecfeff 0%,#d9f99d 30%,#fef3c7 100%)', backdropFilter: 'blur(16px)', borderBottom: '2px solid rgba(15,23,82,0.35)', padding: '12px 16px', minHeight: 64, display: 'flex', flexWrap: 'wrap' as const, alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', position: 'sticky' as const, top: 0, zIndex: 10, boxShadow: '0 10px 30px rgba(30,58,138,0.08)' },
    content: { maxWidth: 1200, margin: '0 auto', padding: '20px 16px' },
    card: { background: '#ffffff', border: '2px solid rgba(15,23,82,0.35)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 18px 50px rgba(30,58,138,0.08)' },
    empty: { textAlign: 'center' as const, padding: 60, color: '#64748b', fontSize: 14 },
    participantCard: { background: '#ffffff', border: '2px solid rgba(15,23,82,0.35)', borderRadius: 16, padding: '20px', marginBottom: 16, transition: 'all 0.2s', cursor: 'pointer' },
    selectedCard: { borderColor: '#06b6d4', boxShadow: '0 0 0 3px rgba(6,182,212,0.2)', background: '#f0f9ff' }
  }

  if (loading) {
    return (
      <div style={S.layout}>
        <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',sans-serif"}}>
          <span style={{color:'#0f172a'}}>Memuat...</span>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={S.layout}>
        <div style={S.content}>
          <div style={S.empty}>Session tidak ditemukan</div>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:linear-gradient(180deg,#f8fbff 0%,#ecfdf5 60%,#fef3c7 100%)!important;color:#0f172a!important;}
        .code-display{font-family:monospace;background:#f1f5f9;border:1px solid rgba(15,23,82,0.2);padding:8px 16px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:2px;}
        .stat-item{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f8fafc;border:1px solid rgba(15,23,82,0.15);border-radius:10px;}
        .stat-label{font-size:11px;font-weight:600;color:#64748b;letter-spacing:0.05em;text-transform:uppercase;}
        .stat-value{font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:#0f172a;}
        .progress-bar{height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;}
        .progress-fill{height:100%;border-radius:4px;transition:width 0.3s;}
        .participant-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(30,58,138,0.1);}
        .score-preview{font-family:monospace;font-size:13px;color:#0f172a;background:#f8fafc;padding:8px 12px;border-radius:8px;border:1px solid rgba(15,23,82,0.15);}
        .btn-action{padding:8px 16px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:all 0.15s;}
        .btn-primary{background:linear-gradient(135deg,#06b6d4 0%,#22c55e 50%,#f59e0b 100%);color:#fff;}
        .btn-primary:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 24px rgba(34,197,94,0.24);}
        .btn-secondary{background:#f1f5f9;color:#475569;border:1px solid rgba(15,23,82,0.2);}
        .btn-secondary:hover{background:#e2e8f0;}
        .copy-btn{background:#e0f2fe;color:#0369a1;border:1px solid rgba(14,165,233,0.3);padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;}
        .copy-btn:hover{background:#bae6fd;}
        @media (min-width: 640px) {
          .participant-card { padding: 24px; }
        }
      `}</style>

      <div style={S.layout}>
        <div style={S.topbar}>
          <div style={{display:'flex',alignItems:'center',gap:12,minWidth:0,flex:'1 1 0',flexWrap:'wrap',maxWidth:'100%'}}>
            <button onClick={handleBack} style={{background:'none',border:'none',cursor:'pointer',padding:8,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8,color:'#475569'}} title="Kembali">←</button>
            <div style={{width:36,height:36,background:'linear-gradient(135deg,#06b6d4,#22c55e,#f59e0b)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,color:'#ffffff',boxShadow:'0 16px 30px rgba(34,197,94,0.18)'}}>🏹</div>
            <span style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:'#0f172a',fontWeight:700,whiteSpace:'nowrap' }}>{session.name}</span>
            <span style={{background:'rgba(245,158,11,0.14)',color:'#854d0e',fontSize:11,padding:'4px 12px',borderRadius:20,border:'1px solid rgba(245,158,11,0.22)',fontWeight:600,whiteSpace:'nowrap' }}>ADMIN</span>
          </div>
        </div>

        <div style={S.content}>
          {/* Session Info Card */}
          <div style={{...S.card, padding: '24px', marginBottom: '24px'}}>
            <div style={{display:'flex',flexWrap:'wrap',gap:16,alignItems:'flex-start',marginBottom:20}}>
              <div style={{flex:1,minWidth:200}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:'#0f172a',fontWeight:700,marginBottom:4}}>{session.name}</div>
                <div style={{color:'#475569',fontSize:13}}>Dibuat oleh {session.creator?.name || '—'} • {new Date(session.created_at).toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8,alignItems:'flex-end'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:12,color:'#64748b',fontWeight:600}}>Kode:</span>
                  <span className="code-display">{session.code}</span>
                  <button className="copy-btn" onClick={handleCopyCode}>Salin</button>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:12,color:'#64748b',fontWeight:600}}>Status:</span>
                  {getStatusBadge(session.status)}
                </div>
              </div>
            </div>

            {/* Config Stats */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
              <div className="stat-item">
                <span className="stat-label">Arrow per Rambahan</span>
                <span className="stat-value">{session.arrows_per_round}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Rambahan per Set</span>
                <span className="stat-value">{session.rounds_per_set}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Jumlah Set</span>
                <span className="stat-value">{session.sets}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total Arrow/Peserta</span>
                <span className="stat-value">{session.arrows_per_round * session.rounds_per_set * session.sets}</span>
              </div>
            </div>
          </div>

          {/* Participants */}
          <div style={{marginBottom: 16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:'#0f172a',fontWeight:700}}>
                Peserta ({participants.length})
              </div>
              {session.status === 'active' && participants.length > 0 && (
                <span style={{fontSize:12,color:'#06b6d4',fontWeight:600}}>
                  Klik peserta untuk mulai scoring
                </span>
              )}
            </div>

            {participants.length === 0 ? (
              <div style={{...S.card, padding: '40px', textAlign: 'center'}}>
                <div style={{fontSize:48,marginBottom:16}}>🏹</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:'#0f172a',fontWeight:600,marginBottom:8}}>Belum ada peserta</div>
                <div style={{color:'#64748b',fontSize:14,marginBottom:20}}>
                  Bagikan kode <strong>{session.code}</strong> kepada peserta agar mereka bisa bergabung.
                </div>
                {session.status === 'draft' && (
                  <button className="btn-action btn-primary" onClick={async () => {
                    const { data: { session: authSession } } = await supabase.auth.getSession()
                    fetch(`/api/scoring/${sessionId}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession?.access_token}` },
                      body: JSON.stringify({ status: 'active' })
                    }).then(() => fetchDetail())
                  }}>
                    Aktifkan Session
                  </button>
                )}
              </div>
            ) : (
              <div>
                {participants.map((p, i) => (
                  <div
                    key={p.id}
                    className="participant-card"
                    style={{
                      ...S.participantCard,
                      ...(selectedParticipant === p.id ? S.selectedCard : {})
                    }}
                    onClick={() => setSelectedParticipant(selectedParticipant === p.id ? null : p.id)}
                  >
                    <div style={{display:'flex',flexWrap:'wrap',gap:16,alignItems:'center',justifyContent:'space-between'}}>
                      <div style={{display:'flex',alignItems:'center',gap:16,flex:1,minWidth:0}}>
                        <div style={{width:40,height:40,background:'linear-gradient(135deg,#06b6d4,#22c55e)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:14,flexShrink:0}}>
                          {i+1}
                        </div>
                        <div>
                          <div style={{fontWeight:700,fontSize:16,color:'#0f172a'}}>{p.name}</div>
                          <div style={{fontSize:12,color:'#64748b'}}>Bergabung: {new Date(p.joined_at).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
                        </div>
                      </div>
                      
                      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8,minWidth:180}}>
                        <div className="score-preview">
                          Total: <strong>{p.total_score}</strong>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:2,alignItems:'flex-end'}}>
                          {Array.from({length: session.sets}, (_, si) => si+1).map(setNum => (
                            <span key={setNum} style={{fontSize:11,color:'#475569'}}>
                              Set {setNum}: <strong>{p.set_totals[setNum] || 0}</strong>
                            </span>
                          ))}
                        </div>
                        <div className="progress-bar" style={{width:120}}>
                          <div className="progress-fill" style={{
                            width: `${p.progress_percent}%`,
                            background: getProgressColor(p.progress_percent)
                          }} />
                        </div>
                        <div style={{fontSize:11,color:'#64748b',textAlign:'right',width:120}}>
                          {p.arrows_entered} / {p.total_arrows} Arrow ({p.progress_percent}%)
                        </div>
                      </div>
                      
                      {session.status === 'active' && (
                        <button
                          className="btn-action btn-primary"
                          onClick={(e) => { e.stopPropagation(); handleScoreClick(p.id) }}
                          style={{alignSelf:'flex-end',minWidth:140}}
                        >
                          {selectedParticipant === p.id ? 'Scoring...' : 'Input Score'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}