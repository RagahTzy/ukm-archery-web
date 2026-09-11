'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useParams } from 'next/navigation'

type SessionConfig = {
  arrows_per_round: number
  rounds_per_set: number
  sets: number
}

type Participant = {
  id: string
  name: string
}

type ScoreData = {
  [setNum: number]: {
    [roundNum: number]: {
      [arrowNum: number]: number
    }
  }
}

type RoundTotals = {
  [setNum: number]: {
    [roundNum: number]: number
  }
}

type SetTotals = {
  [setNum: number]: number
}

export default function ScoringInputPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string
  const participantId = params.participantId as string
  
  const [session, setSession] = useState<SessionConfig | null>(null)
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [scores, setScores] = useState<ScoreData>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [currentSet, setCurrentSet] = useState(1)
  const [currentRound, setCurrentRound] = useState(1)

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession) { router.push('/login'); return }
      
      const res = await fetch(`/api/scoring/${sessionId}/participants/${participantId}`, {
              headers: { Authorization: `Bearer ${authSession.access_token}` }
            })
      const json = await res.json()
      if (json.error) { alert(json.error); router.push(`/dashboard/admin/scoring/${sessionId}`); return }
      
      setSession(json.session_config)
      setParticipant(json.participant)
      // Convert scores object to nested structure
      const scoreStructure: ScoreData = {}
      if (json.scores) {
        Object.keys(json.scores).forEach(setKey => {
          const setNum = parseInt(setKey)
          scoreStructure[setNum] = {}
          Object.keys(json.scores[setKey]).forEach(roundKey => {
            const roundNum = parseInt(roundKey)
            scoreStructure[setNum][roundNum] = {}
            Object.keys(json.scores[setKey][roundKey]).forEach(arrowKey => {
              const arrowNum = parseInt(arrowKey)
              scoreStructure[setNum][roundNum][arrowNum] = json.scores[setKey][roundKey][arrowKey]
            })
          })
        })
      }
      setScores(scoreStructure)
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }, [sessionId, participantId, router])

  useEffect(() => { fetchData() }, [fetchData])

  // Computed totals
  const { roundTotals, setTotals, grandTotal } = useMemo(() => {
    if (!session) return { roundTotals: {} as RoundTotals, setTotals: {} as SetTotals, grandTotal: 0 }
    
    const rt: RoundTotals = {}
    const st: SetTotals = {}
    let gt = 0
    
    for (let set = 1; set <= session.sets; set++) {
      rt[set] = {}
      st[set] = 0
      for (let round = 1; round <= session.rounds_per_set; round++) {
        let roundTotal = 0
        for (let arrow = 1; arrow <= session.arrows_per_round; arrow++) {
          roundTotal += scores[set]?.[round]?.[arrow] || 0
        }
        rt[set][round] = roundTotal
        st[set] += roundTotal
      }
      gt += st[set]
    }
    
    return { roundTotals: rt, setTotals: st, grandTotal: gt }
  }, [session, scores])

  // Handle score change
  const handleScoreChange = (setNum: number, roundNum: number, arrowNum: number, value: number) => {
    setScores(prev => ({
      ...prev,
      [setNum]: {
        ...prev[setNum],
        [roundNum]: {
          ...prev[setNum]?.[roundNum],
          [arrowNum]: Math.max(0, Math.min(10, value))
        }
      }
    }))
    setSaved(false)
  }

  // Save all scores
  const handleSave = async () => {
    if (!session || !participant) return
    setSaving(true)
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      
      // Flatten scores for API
      const flatScores: Array<{ set_number: number; round_number: number; arrow_number: number; score: number }> = []
      for (let set = 1; set <= session.sets; set++) {
        for (let round = 1; round <= session.rounds_per_set; round++) {
          for (let arrow = 1; arrow <= session.arrows_per_round; arrow++) {
            const score = scores[set]?.[round]?.[arrow] || 0
            if (score > 0 || score === 0) { // Include zeros
              flatScores.push({ set_number: set, round_number: round, arrow_number: arrow, score })
            }
          }
        }
      }
      
      const res = await fetch(`/api/scoring/${sessionId}/participants/${participantId}`, {
        method: 'POST',
        headers: { 
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authSession?.access_token}`
                },
        body: JSON.stringify({ scores: flatScores })
      })
      const json = await res.json()
      if (json.error) { alert(json.error); return }
      
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      fetchData() // Refresh to get updated totals
    } catch (err) {
      alert('Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  // Navigation
  const goToSet = (setNum: number) => {
    setCurrentSet(setNum)
    setCurrentRound(1)
  }
  
  const goToRound = (roundNum: number) => {
    setCurrentRound(roundNum)
  }

  const prevRound = () => {
    if (currentRound > 1) {
      setCurrentRound(currentRound - 1)
    } else if (currentSet > 1) {
      setCurrentSet(currentSet - 1)
      setCurrentRound(session?.rounds_per_set || 1)
    }
  }
  
  const nextRound = () => {
    if (currentRound < (session?.rounds_per_set || 1)) {
      setCurrentRound(currentRound + 1)
    } else if (currentSet < (session?.sets || 1)) {
      setCurrentSet(currentSet + 1)
      setCurrentRound(1)
    }
  }

  const handleBack = () => router.push(`/dashboard/admin/scoring/${sessionId}`)

  if (loading) {
    return (
      <div style={{minHeight:'100vh',background:'#f8fbff',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',sans-serif"}}>
        <span style={{color:'#0f172a'}}>Memuat data scoring...</span>
      </div>
    )
  }

  if (!session || !participant) {
    return (
      <div style={{minHeight:'100vh',background:'#f8fbff',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',sans-serif"}}>
        <span style={{color:'#0f172a'}}>Data tidak ditemukan</span>
      </div>
    )
  }

  const arrows = Array.from({length: session.arrows_per_round}, (_, i) => i + 1)
  const sets = Array.from({length: session.sets}, (_, i) => i + 1)
  const rounds = Array.from({length: session.rounds_per_set}, (_, i) => i + 1)

  const getScore = (setNum: number, roundNum: number, arrowNum: number) => scores[setNum]?.[roundNum]?.[arrowNum] || 0

  const S = {
    layout: { minHeight: '100vh', background: '#f8fbff', color: '#0f172a', fontFamily: "'DM Sans',sans-serif" },
    topbar: { background: 'linear-gradient(135deg,#ecfeff 0%,#d9f99d 30%,#fef3c7 100%)', backdropFilter: 'blur(16px)', borderBottom: '2px solid rgba(15,23,82,0.35)', padding: '12px 16px', minHeight: 64, display: 'flex', flexWrap: 'wrap' as const, alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', position: 'sticky' as const, top: 0, zIndex: 10, boxShadow: '0 10px 30px rgba(30,58,138,0.08)' },
    content: { maxWidth: 1000, margin: '0 auto', padding: '20px 16px' },
    card: { background: '#ffffff', border: '2px solid rgba(15,23,82,0.35)', borderRadius: 20, padding: '24px', boxShadow: '0 18px 50px rgba(30,58,138,0.08)', marginBottom: 24 },
    input: { width: 60, height: 60, background: '#f8fafc', border: '2px solid rgba(15,23,82,0.35)', borderRadius: 12, fontSize: 18, fontWeight: 700, color: '#0f172a', textAlign: 'center', outline: 'none', fontFamily: "'DM Sans',sans-serif" },
    inputFocus: { borderColor: 'rgba(14,165,233,0.45)', background: '#f0f9ff', boxShadow: '0 0 0 4px rgba(14,165,233,0.12)' }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:linear-gradient(180deg,#f8fbff 0%,#ecfdf5 60%,#fef3c7 100%)!important;color:#0f172a!important;}
        .score-input{width:60px;height:60px;background:#f8fafc;border:2px solid rgba(15,23,82,0.35);border-radius:12px;font-size:18px;font-weight:700;color:#0f172a;text-align:center;outline:none;font-family:'DM Sans',sans-serif;transition:all 0.15s;}
        .score-input:focus{border-color:rgba(14,165,233,0.45);background:#f0f9ff;box-shadow:0 0 0 4px rgba(14,165,233,0.12);}
        .score-input.filled{background:#d1fae5;border-color:#22c55e;color:#166534;}
        .total-badge{background:#cffafe;color:#0c4a6e;border:1px solid rgba(6,182,212,0.22);padding:6px 12px;border-radius:10px;font-size:12px;font-weight:700;font-family:'DM Sans',sans-serif;}
        .set-badge{background:#fef9c3;color:#b45309;border:1px solid rgba(245,158,11,0.22);padding:6px 12px;border-radius:10px;font-size:12px;font-weight:700;font-family:'DM Sans',sans-serif;}
        .grand-badge{background:linear-gradient(135deg,#06b6d4,#22c55e,#f59e0b);color:#fff;padding:10px 20px;border-radius:14px;font-size:16px;font-weight:700;font-family:'Playfair Display',serif;box-shadow:0 8px 24px rgba(34,197,94,0.2);}
        .nav-btn{padding:8px 16px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:all 0.15s;}
        .nav-btn.active{background:linear-gradient(135deg,#06b6d4,#22c55e);color:#fff;box-shadow:0 4px 12px rgba(6,182,212,0.3);}
        .nav-btn.inactive{background:#f1f5f9;color:#475569;border:1px solid rgba(15,23,82,0.2);}
        .nav-btn.inactive:hover{background:#e2e8f0;}
        .nav-btn:disabled{opacity:0.5;cursor:not-allowed;}
        .btn-save{padding:12px 28px;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:all 0.15s;background:linear-gradient(135deg,#06b6d4 0%,#22c55e 50%,#f59e0b 100%);color:#fff;}
        .btn-save:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 12px 32px rgba(34,197,94,0.24);}
        .btn-save:disabled{opacity:0.7;cursor:not-allowed;}
        .btn-back{background:#f1f5f9;color:#475569;border:1px solid rgba(15,23,82,0.2);padding:10px 20px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}
        .btn-back:hover{background:#e2e8f0;}
        .saved-toast{position:fixed;bottom:24px;right:24px;background:#22c55e;color:#fff;padding:14px 24px;border-radius:12px;font-weight:600;box-shadow:0 12px 32px rgba(34,197,94,0.3);z-index:1000;animation:slideUp 0.3s ease;}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .arrow-grid{display:grid;gap:8px;}
        .arrow-label{font-size:10px;font-weight:600;color:#64748b;text-align:center;margin-bottom:2px;letter-spacing:0.05em;text-transform:uppercase;}
        .round-header{font-family:'Playfair Display',serif;font-size:16px;font-weight:700;color:#0f172a;marginBottom:12px;paddingBottom:8px;borderBottom:2px solid rgba(15,23,82,0.15);}
        .info-row{display:flex;gap:16;flex-wrap:wrap;marginBottom:16;padding:12px 16px;background:#f8fafc;border:1px solid rgba(15,23,82,0.15);borderRadius:12px;}
        .info-item{font-size:12px;color:#475569;}
        .info-item strong{color:#0f172a;font-family:'Playfair Display',serif;font-size:14px;}
        @media (min-width: 640px) {
          .arrow-grid { grid-template-columns: repeat(${session?.arrows_per_round || 6}, 1fr); }
        }
      `}</style>

      <div style={S.layout}>
        <div style={S.topbar}>
          <div style={{display:'flex',alignItems:'center',gap:12,minWidth:0,flex:'1 1 0',flexWrap:'wrap',maxWidth:'100%'}}>
            <button onClick={handleBack} style={{background:'none',border:'none',cursor:'pointer',padding:8,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8,color:'#475569'}} title="Kembali">←</button>
            <div style={{width:36,height:36,background:'linear-gradient(135deg,#06b6d4,#22c55e,#f59e0b)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,color:'#ffffff',boxShadow:'0 16px 30px rgba(34,197,94,0.18)'}}>🏹</div>
            <span style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:'#0f172a',fontWeight:700,whiteSpace:'nowrap' }}>{participant.name}</span>
            <span style={{background:'rgba(245,158,11,0.14)',color:'#854d0e',fontSize:11,padding:'4px 12px',borderRadius:20,border:'1px solid rgba(245,158,11,0.22)',fontWeight:600,whiteSpace:'nowrap' }}>SCORING</span>
          </div>
          <button className="btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Menyimpan...' : saved ? '✓ Tersimpan' : 'Simpan Semua'}
          </button>
        </div>

        {saved && (
          <div className="saved-toast">✓ Berhasil disimpan!</div>
        )}

        <div style={S.content}>
          {/* Info Bar */}
          <div className="info-row">
            <div className="info-item">Set <strong>{currentSet} / {session.sets}</strong></div>
            <div className="info-item">Rambahan <strong>{currentRound} / {session.rounds_per_set}</strong></div>
            <div className="info-item">Arrow <strong>{session.arrows_per_round} per Rambahan</strong></div>
            <div className="info-item">Total Set <strong>{setTotals[currentSet] || 0}</strong></div>
            <div className="info-item">Grand Total <strong>{grandTotal}</strong></div>
          </div>

          {/* Set Navigation */}
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:20}}>
            {sets.map(setNum => (
              <button
                key={setNum}
                className={`nav-btn ${currentSet === setNum ? 'active' : 'inactive'}`}
                onClick={() => goToSet(setNum)}
                disabled={currentSet !== setNum && (setTotals[setNum] || 0) === 0 && sets.some(s => s > setNum && (setTotals[s] || 0) > 0)}
              >
                Set {setNum} <span className="set-badge">{setTotals[setNum] || 0}</span>
              </button>
            ))}
          </div>

          {/* Round Navigation */}
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:24}}>
            {rounds.map(roundNum => (
              <button
                key={roundNum}
                className={`nav-btn ${currentRound === roundNum ? 'active' : 'inactive'}`}
                onClick={() => goToRound(roundNum)}
              >
                Rambahan {roundNum} <span className="total-badge">{roundTotals[currentSet]?.[roundNum] || 0}</span>
              </button>
            ))}
          </div>

          {/* Arrow Input Grid */}
          <div style={S.card}>
            <div className="round-header">
              Set {currentSet} — Rambahan {currentRound} / {session.rounds_per_set}
            </div>
            
            <div className="arrow-grid" style={{gridTemplateColumns: `repeat(${session.arrows_per_round}, 1fr)`}}>
              {arrows.map(arrowNum => {
                const score = getScore(currentSet, currentRound, arrowNum)
                return (
                  <div key={arrowNum} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                    <div className="arrow-label">Arrow {arrowNum}</div>
                    <input
                      type="number"
                      className={`score-input ${score > 0 ? 'filled' : ''}`}
                      min="0"
                      max="10"
                      value={score}
                      onChange={e => handleScoreChange(currentSet, currentRound, arrowNum, parseInt(e.target.value) || 0)}
                      onBlur={e => {
                        const v = parseInt(e.target.value) || 0
                        if (v > 10) handleScoreChange(currentSet, currentRound, arrowNum, 10)
                        else if (v < 0) handleScoreChange(currentSet, currentRound, arrowNum, 0)
                        else handleScoreChange(currentSet, currentRound, arrowNum, v)
                      }}
                    />
                    <div style={{fontSize:11,color: score > 0 ? '#22c55e' : '#94a3b8'}}>
                      {score > 0 ? '✓' : '—'}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Round Total */}
            <div style={{marginTop:20,paddingTop:16,borderTop:'2px solid rgba(15,23,82,0.15)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:'#0f172a',fontWeight:700}}>
                Total Rambahan: <span style={{color:'#06b6d4'}}>{roundTotals[currentSet]?.[currentRound] || 0}</span>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="nav-btn inactive" onClick={prevRound} disabled={currentSet===1 && currentRound===1}>← Sebelumnya</button>
                <button className="nav-btn inactive" onClick={nextRound} disabled={currentSet===session.sets && currentRound===session.rounds_per_set}>Selanjutnya →</button>
              </div>
            </div>
          </div>

          {/* Summary Card */}
          <div style={S.card}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:'#0f172a',fontWeight:700,marginBottom:16}}>Ringkasan Scoring</div>
            
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:16}}>
              {sets.map(setNum => (
                <div key={setNum} style={{background:'#f8fafc',border:'1px solid rgba(15,23,82,0.15)',borderRadius:12,padding:'16px',textAlign:'center'}}>
                  <div style={{fontSize:11,fontWeight:600,color:'#64748b',letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:4}}>Set {setNum}</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:'#0f172a'}}>{setTotals[setNum] || 0}</div>
                </div>
              ))}
            </div>

            <div style={{textAlign:'center',paddingTop:16,borderTop:'2px solid rgba(15,23,82,0.15)'}}>
              <div className="grand-badge">Grand Total: {grandTotal}</div>
              <div style={{marginTop:8,fontSize:13,color:'#64748b'}}>
                {Object.values(scores).flatMap(s => Object.values(s).flatMap(r => Object.values(r))).filter(v => v > 0).length} / {session.arrows_per_round * session.rounds_per_set * session.sets} Arrow diisi
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}