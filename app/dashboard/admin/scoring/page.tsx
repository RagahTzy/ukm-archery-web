'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

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
  participant_count: number
}

export default function ScoringListPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<ScoringSession[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'draft' | 'active' | 'completed'>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  
  // Create form state
  const [formName, setFormName] = useState('')
  const [formArrows, setFormArrows] = useState(6)
  const [formRounds, setFormRounds] = useState(5)
  const [formSets, setFormSets] = useState(3)
  const [formError, setFormError] = useState('')

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      
      const token = session.access_token
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)
      
      const res = await fetch(`/api/scoring?${params}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
      const json = await res.json()
      if (json.sessions) setSessions(json.sessions)
    } catch (err) {
      console.error('Error fetching sessions:', err)
    } finally {
      setLoading(false)
    }
  }, [filter, router])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const handleCreate = async () => {
    setFormError('')
    setCreating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/scoring', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.access_token}`
              },
              body: JSON.stringify({
                name: formName,
                arrows_per_round: formArrows,
                rounds_per_set: formRounds,
                sets: formSets
              })
            })
      const json = await res.json()
      if (json.error) { setFormError(json.error); return }
      setShowCreateModal(false)
      setFormName('')
      setFormArrows(6)
      setFormRounds(5)
      setFormSets(3)
      fetchSessions()
      alert(`Scoring berhasil dibuat!\n\nKode Scoring: ${json.session.code}`)
    } catch (err) {
      setFormError('Terjadi kesalahan')
    } finally {
      setCreating(false)
    }
  }

  const handleStatusChange = async (id: string, newStatus: 'draft' | 'active' | 'completed') => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/scoring/${id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ status: newStatus })
        })
    const json = await res.json()
    if (json.error) { alert(json.error); return }
    fetchSessions()
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus scoring "${name}"? Semua peserta dan nilai akan terhapus.`)) return
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/scoring/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session?.access_token}` }
        })
    const json = await res.json()
    if (json.error) { alert(json.error); return }
    fetchSessions()
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

  const S = {
    layout: { minHeight: '100vh', background: '#f8fbff', color: '#0f172a', fontFamily: "'DM Sans',sans-serif" },
    topbar: { background: 'linear-gradient(135deg,#ecfeff 0%,#d9f99d 30%,#fef3c7 100%)', backdropFilter: 'blur(16px)', borderBottom: '2px solid rgba(15,23,82,0.35)', padding: '12px 16px', minHeight: 64, display: 'flex', flexWrap: 'wrap' as const, alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', position: 'sticky' as const, top: 0, zIndex: 10, boxShadow: '0 10px 30px rgba(30,58,138,0.08)' },
    content: { maxWidth: 1200, margin: '0 auto', padding: '20px 16px' },
    tableWrap: { background: '#ffffff', border: '2px solid rgba(15,23,82,0.35)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 18px 50px rgba(30,58,138,0.08)' },
    empty: { textAlign: 'center' as const, padding: 60, color: '#64748b', fontSize: 14 },
    modalOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,82,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
    modal: { background: '#fff', borderRadius: 24, padding: '32px', width: '100%', maxWidth: 500, boxShadow: '0 24px 60px rgba(30,58,138,0.15)' }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:linear-gradient(180deg,#f8fbff 0%,#ecfdf5 60%,#fef3c7 100%)!important;color:#0f172a!important;}
        .tab-btn{padding:9px 20px;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:all 0.2s;color:#475569;background:transparent;}
        .tab-btn.on{background:rgba(56,111,232,0.10);color:#0f172a;border:1px solid rgba(30,58,138,0.25);}
        .stats-grid{display:grid;grid-template-columns:repeat(1,1fr);gap:12px;margin-bottom:20px;}
        .sc{background:#ffffff;border:2px solid rgba(15,23,82,0.35);border-radius:20px;padding:16px;box-shadow:0 18px 40px rgba(30,58,138,0.08);}
        .sl{font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;color:#64748b;}
        .sv{font-family:'Playfair Display',serif;font-size:24px;font-weight:700;line-height:1;color:#0f172a;}
        .filters{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;}
        .fbtn{padding:6px 12px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:2px solid rgba(15,23,82,0.35);background:#f8fafc;color:#475569;font-family:'DM Sans',sans-serif;transition:all 0.2s;}
        .fbtn.on{background:rgba(6,182,212,0.14);border-color:rgba(6,182,212,0.28);color:#0c4a6e;}
        .tscroll{overflow-x:auto;}
        table{width:100%;border-collapse:collapse;}
        thead{background:#f8fafc;}
        th{padding:10px 8px;font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;border-bottom:2px solid rgba(15,23,82,0.35);white-space:nowrap;text-align:center;}
        th.tl{text-align:left;padding-left:12px;}
        td{padding:12px 8px;border-bottom:1px solid rgba(226,232,240,0.8);text-align:center;vertical-align:middle;color:#0f172a;font-size:12px;}
        td.tl{text-align:left;padding-left:12px;}
        tr:last-child td{border-bottom:none;}
        tr:hover td{background:#f8fbff;}
        .mname{font-weight:700;color:#0f172a;font-size:13px;}
        .memail{color:#64748b;font-size:11px;margin-top:2px;}
        .nc{color:#475569;font-size:12px;}
        .rsel{background:#f8fafc;border:2px solid rgba(15,23,82,0.35);border-radius:12px;padding:6px 8px;color:#0f172a;font-size:12px;font-family:'DM Sans',sans-serif;outline:none;cursor:pointer;}
        .rsel option{background:#ffffff;color:#0f172a;}
        .acts{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;}
        .ab{padding:6px 10px;border-radius:12px;font-size:11px;font-weight:700;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:all 0.15s;}
        .aap{background:#d1fae5;color:#166534;} .aap:hover{background:#86efac;}
        .aed{background:#dbeafe;color:#1e40af;} .aed:hover{background:#bfdbfe;}
        .adel{background:#fee2e2;color:#b91c1c;} .adel:hover{background:#fecaca;}
        .code-badge{font-family:monospace;background:#f1f5f9;border:1px solid rgba(15,23,82,0.2);padding:2px 8px;border-radius:6px;font-size:12px;}
        .config-badge{font-size:11px;color:#475569;}
        .modal-input{width:100%;background:#f8fafc;border:2px solid rgba(15,23,82,0.35);border-radius:12px;padding:12px 14px;color:#0f172a;font-size:14px;font-family:'DM Sans',sans-serif;outline:none;margin-top:6px;margin-bottom:16px;}
        .modal-input:focus{border-color:rgba(14,165,233,0.45);background:#f0f9ff;box-shadow:0 0 0 4px rgba(14,165,233,0.12);}
        .modal-label{display:block;font-size:11px;font-weight:600;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;}
        .modal-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;}
        .btn-modal{padding:12px 24px;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:all 0.15s;}
        .btn-primary{background:linear-gradient(135deg,#06b6d4 0%,#22c55e 50%,#f59e0b 100%);color:#fff;}
        .btn-primary:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 12px 32px rgba(34,197,94,0.24);}
        .btn-secondary{background:#f1f5f9;color:#475569;border:1px solid rgba(15,23,82,0.2);}
        .btn-secondary:hover{background:#e2e8f0;}
        .error-msg{background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.2);color:#b91c1c;padding:10px 12px;border-radius:10px;font-size:13px;margin-bottom:16px;}
        @media (min-width: 640px) {
          .stats-grid { grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
          .sc { padding: 24px; }
          .sl { font-size: 11px; margin-bottom: 10px; }
          .sv { font-size: 32px; }
          .filters { gap: 10px; margin-bottom: 20px; }
          .fbtn { padding: 8px 18px; font-size: 12px; }
          .modal-row { grid-template-columns: 1fr 1fr 1fr; }
        }
      `}</style>

      <div style={S.layout}>
        <div style={S.topbar}>
          <div style={{display:'flex',alignItems:'center',gap:12,minWidth:0,flex:'1 1 0',flexWrap:'wrap',maxWidth:'100%'}}>
            <button onClick={()=>router.push('/dashboard/admin')} style={{background:'none',border:'none',cursor:'pointer',padding:8,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8,color:'#475569'}} title="Kembali ke Dashboard">←</button>
            <div style={{width:36,height:36,background:'linear-gradient(135deg,#06b6d4,#22c55e,#f59e0b)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,color:'#ffffff',boxShadow:'0 16px 30px rgba(34,197,94,0.18)'}}>🏹</div>
            <span style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:'#0f172a',fontWeight:700,whiteSpace:'nowrap' }}>Scoring Panahan</span>
            <span style={{background:'rgba(245,158,11,0.14)',color:'#854d0e',fontSize:11,padding:'4px 12px',borderRadius:20,border:'1px solid rgba(245,158,11,0.22)',fontWeight:600,whiteSpace:'nowrap' }}>ADMIN</span>
          </div>
        </div>

        <div style={S.content}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,color:'#0f172a',fontWeight:700,marginBottom:4}}>Kelola Scoring Session</div>
          <div style={{color:'#475569',fontSize:14,marginBottom:28}}>Buat, kelola, dan pantau sesi scoring panahan UKM.</div>

          <div style={{display:'flex',gap:4,background:'#f8fafc',border:'2px solid rgba(15,23,82,0.35)',borderRadius:12,padding:4,marginBottom:28,width:'fit-content'}}>
            <button className={`tab-btn ${filter==='all'?'on':''}`} onClick={()=>setFilter('all')}>Semua</button>
            <button className={`tab-btn ${filter==='draft'?'on':''}`} onClick={()=>setFilter('draft')}>Draft</button>
            <button className={`tab-btn ${filter==='active'?'on':''}`} onClick={()=>setFilter('active')}>Aktif</button>
            <button className={`tab-btn ${filter==='completed'?'on':''}`} onClick={()=>setFilter('completed')}>Selesai</button>
          </div>

          <button
            onClick={()=>setShowCreateModal(true)}
            style={{
              background: 'linear-gradient(135deg,#06b6d4 0%,#22c55e 50%,#f59e0b 100%)',
              color: '#fff', padding: '12px 24px', borderRadius: 12, border: 'none',
              cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: "'DM Sans',sans-serif",
              display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            + Buat Scoring Baru
          </button>

          {loading ? (
            <div className="empty">Memuat data...</div>
          ) : sessions.length === 0 ? (
            <div style={S.tableWrap}>
              <div className="empty">Belum ada scoring session. Klik "Buat Scoring Baru" untuk memulai.</div>
            </div>
          ) : (
            <div style={S.tableWrap}>
              <div className="tscroll">
                <table>
                  <thead>
                    <tr>
                      <th className="tl" style={{width:50}}>No</th>
                      <th className="tl" style={{minWidth:200}}>Nama Scoring</th>
                      <th style={{minWidth:100}}>Kode</th>
                      <th style={{minWidth:160}}>Konfigurasi</th>
                      <th style={{minWidth:100}}>Peserta</th>
                      <th style={{minWidth:100}}>Status</th>
                      <th style={{minWidth:200}}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, i) => (
                      <tr key={s.id}>
                        <td className="tl"><span className="nc">{i+1}</span></td>
                        <td className="tl">
                          <div className="mname">{s.name}</div>
                          <div className="memail">Oleh {s.creator?.name || '—'}</div>
                        </td>
                        <td><span className="code-badge">{s.code}</span></td>
                        <td>
                          <span className="config-badge">
                            {s.arrows_per_round} Arrow × {s.rounds_per_set} Rambahan × {s.sets} Set
                          </span>
                          <div style={{fontSize:10,color:'#94a3b8',marginTop:2}}>
                            Total: {s.arrows_per_round * s.rounds_per_set * s.sets} Arrow
                          </div>
                        </td>
                        <td><span style={{fontWeight:700,fontSize:14}}>{s.participant_count}</span></td>
                        <td>{getStatusBadge(s.status)}</td>
                        <td>
                          <div className="acts">
                            <button className="ab aed" onClick={()=>router.push(`/dashboard/admin/scoring/${s.id}`)}>Detail</button>
                            {s.status === 'draft' && (
                              <button className="ab aap" onClick={()=>handleStatusChange(s.id, 'active')}>Aktifkan</button>
                            )}
                            {s.status === 'active' && (
                              <button className="ab" style={{background:'#fef9c3',color:'#b45309'}} onClick={()=>handleStatusChange(s.id, 'completed')}>Selesaikan</button>
                            )}
                            <button className="ab adel" onClick={()=>handleDelete(s.id, s.name)}>Hapus</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Create Modal */}
          {showCreateModal && (
            <div style={S.modalOverlay} onClick={()=>setShowCreateModal(false)}>
              <div style={S.modal} onClick={e=>e.stopPropagation()}>
                <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:'#0f172a',fontWeight:700,marginBottom:8}}>Buat Scoring Baru</h2>
                <p style={{color:'#475569',fontSize:14,marginBottom:24}}>Isi konfigurasi scoring session. Kode akan digenerate otomatis.</p>
                {formError && <div className="error-msg">{formError}</div>}
                <div>
                  <label className="modal-label">Nama/Judul Scoring</label>
                  <input className="modal-input" placeholder="Contoh: Latihan Panahan Minggu Pagi" value={formName} onChange={e=>setFormName(e.target.value)} />
                </div>
                <div className="modal-row">
                  <div>
                    <label className="modal-label">Arrow per Rambahan</label>
                    <input className="modal-input" type="number" min="1" max="12" value={formArrows} onChange={e=>setFormArrows(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="modal-label">Rambahan per Set</label>
                    <input className="modal-input" type="number" min="1" max="10" value={formRounds} onChange={e=>setFormRounds(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="modal-label">Jumlah Set</label>
                    <input className="modal-input" type="number" min="1" max="10" value={formSets} onChange={e=>setFormSets(Number(e.target.value))} />
                  </div>
                </div>
                <div style={{fontSize:12,color:'#64748b',marginBottom:16}}>
                  Total Arrow per Peserta: <strong>{formArrows * formRounds * formSets}</strong>
                </div>
                <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
                  <button className="btn-modal btn-secondary" onClick={()=>setShowCreateModal(false)}>Batal</button>
                  <button className="btn-modal btn-primary" onClick={handleCreate} disabled={creating}>{creating?'Membuat...':'Buat Scoring'}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}