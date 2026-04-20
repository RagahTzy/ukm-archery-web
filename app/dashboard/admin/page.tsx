'use client'

import { useEffect, useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

type Profile = { id: string; name: string; email: string; role: string; status: string }
type Attendance = { id: string; user_id: string; date: string; status: string; photo_url?: string }
type ActiveTab = 'members' | 'absen'

const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

export default function AdminDashboard() {
  const now = new Date()
  const [activeTab, setActiveTab] = useState<ActiveTab>('members')
  const [users, setUsers] = useState<Profile[]>([])
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'pending'|'approved'|'rejected'>('all')
  const [selMonth, setSelMonth] = useState(now.getMonth()+1)
  const [selYear, setSelYear] = useState(now.getFullYear())

  const [sudahAbsen, setSudahAbsen] = useState(false)
  
  const selectedMonth = `${selYear}-${String(selMonth).padStart(2,'0')}`
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]

  const checkAdmin = useCallback(async () => {
    const {data:{user}} = await supabase.auth.getUser()
    if (!user){router.push('/login');return}
    const {data:p} = await supabase.from('profiles').select('role,status').eq('id',user.id).single()
    if (!p||p.role!=='admin'||p.status!=='approved') {
        router.push('/login')
        return
    }

    // CEK APAKAH ADMIN SUDAH ABSEN
    const { data: absenData } = await supabase.from('attendance').select('*').eq('user_id', user.id).eq('date', today)
    if (absenData && absenData.length > 0) {
      setSudahAbsen(true)
    }

  },[router, today])

  // State baru untuk popup foto
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const yearOptions = Array.from({length:10},(_,i)=>now.getFullYear()-5+i)

  const getUsers = useCallback(async () => {
    const {data} = await supabase.from('profiles').select('*').order('name')
    setUsers(data??[])
  },[])

  const getAttendances = useCallback(async () => {
    setLoading(true)
    const lastDay = new Date(selYear, selMonth, 0).getDate()
    const dateStart = `${selYear}-${String(selMonth).padStart(2,'0')}-01`
    const dateEnd = `${selYear}-${String(selMonth).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
    
    const {data, error} = await supabase.from('attendance').select('*')
      .gte('date', dateStart)
      .lte('date', dateEnd)
      .order('date')
    
    if(error) console.error('Error fetching attendance:', error)
    setAttendances(data??[])
    setLoading(false)
  },[selYear, selMonth])

  const exportAttendanceExcel = () => {
    if(allDates.length === 0) {
      alert('Tidak ada data absensi untuk diekspor')
      return
    }

    const header = ['Nama', 'Email', 'Status', ...allDates, 'Total']
    const rows: Array<Array<string | number>> = [header]

    approvedMembers.forEach((member) => {
      const udates = absenMap[member.id] ?? {}
      const total = Object.keys(udates).length
      const row: Array<string | number> = [member.name, member.email, member.status, ...allDates.map(date => udates[date] ? '✓' : ''), total]
      rows.push(row)
    })

    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Absensi')
    XLSX.writeFile(workbook, `Rekap_Absensi_${monthNames[selMonth-1]}_${selYear}.xlsx`)
  }

  useEffect(()=>{checkAdmin();getUsers()},[checkAdmin,getUsers])
  useEffect(()=>{if(activeTab==='absen') getAttendances()},[activeTab,getAttendances])
  useEffect(()=>{if(activeTab==='absen') getAttendances()},[selMonth,selYear,activeTab,getAttendances])

  const updateStatus = async (id:string, status:string) => {
    await supabase.from('profiles').update({status}).eq('id',id); getUsers()
  }
  const updateRole = async (id:string, role:string) => {
    await supabase.from('profiles').update({role}).eq('id',id); getUsers()
  }

  const getWeekOfMonth = (dateStr:string) => Math.ceil(new Date(dateStr+'T00:00:00').getDate()/7)
  const lastDay = new Date(selYear, selMonth, 0).getDate()

  const allDates = Array.from({ length: lastDay }, (_, i) => {
    const day = String(i + 1).padStart(2, '0')
    return `${selYear}-${String(selMonth).padStart(2, '0')}-${day}`
  })
  const approvedMembers = users.filter(u=>u.status==='approved')
  
  // Mengubah struktur mapping agar menyimpan detail absen (termasuk URL foto)
  const absenMap: Record<string, Record<string, Attendance>> = {}
  attendances.forEach(a => {
    if(!absenMap[a.user_id]) absenMap[a.user_id] = {}
    absenMap[a.user_id][a.date] = a
  })

  const filtered = filter==='all'?users:users.filter(u=>u.status===filter)
  const counts = {
    pending:users.filter(u=>u.status==='pending').length,
    approved:users.filter(u=>u.status==='approved').length,
    rejected:users.filter(u=>u.status==='rejected').length,
  }

  const S = {
    layout:{minHeight:'100vh',background:'#f8fbff',color:'#0f172a',fontFamily:"'DM Sans',sans-serif"},
    topbar:{background:'linear-gradient(135deg,#ecfeff 0%,#d9f99d 30%,#fef3c7 100%)',backdropFilter:'blur(16px)',borderBottom:'2px solid rgba(15,23,82,0.35)',padding:'12px 16px',minHeight:64,display:'flex',flexWrap:'wrap' as const,alignItems:'flex-start',justifyContent:'space-between',gap:'12px',position:'sticky' as const,top:0,zIndex:10,boxShadow:'0 10px 30px rgba(30,58,138,0.08)'},
    logo:{width:36,height:36,background:'linear-gradient(135deg,#06b6d4,#22c55e,#f59e0b)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,color:'#ffffff',boxShadow:'0 16px 30px rgba(34,197,94,0.18)'},
    content:{maxWidth:1200,margin:'0 auto',padding:'20px 16px'},
    tableWrap:{background:'#ffffff',border:'2px solid rgba(15,23,82,0.35)',borderRadius:20,overflow:'hidden',boxShadow:'0 18px 50px rgba(30,58,138,0.08)'},
    empty:{textAlign:'center' as const,padding:60,color:'#64748b',fontSize:14},
  }

  const checkAbsenAdmin = async (userId: string) => {
    const today = new Date().toISOString().split('T')[0]
    const { data: absen } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
    if (absen && absen.length > 0) {
      setSudahAbsen(true)
    }
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
        .sy .sl{color:#f59e0b;} .sy .sv{color:#c2410c;}
        .sgr .sl{color:#22c55e;} .sgr .sv{color:#166534;}
        .sr .sl{color:#ef4444;} .sr .sv{color:#b91c1c;}
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
        .badge{padding:4px 8px;border-radius:999px;font-size:10px;font-weight:700;color:#0f172a;background:#eff6ff;}
        .bp{background:#fef9c3;color:#b45309;border:2px solid rgba(15,23,82,0.35);}
        .ba{background:#d1fae5;color:#166534;border:2px solid rgba(15,23,82,0.35);}
        .br{background:#fee2e2;color:#b91c1c;border:2px solid rgba(15,23,82,0.35);}
        .acts{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;}
        .ab{padding:6px 10px;border-radius:12px;font-size:11px;font-weight:700;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:all 0.15s;}
        .aap{background:#d1fae5;color:#166534;} .aap:hover{background:#86efac;}
        .arj{background:#fee2e2;color:#b91c1c;} .arj:hover{background:#fecaca;}
        .apd{background:#cffafe;color:#0c4a6e;} .apd:hover{background:#a5f3fc;}
        /* absen */
        .ctrl{display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap;}
        .cl{font-size:12px;font-weight:600;color:#0f172a;}
        .cs{background:#ffffff;border:2px solid rgba(15,23,82,0.35);border-radius:10px;padding:7px 10px;color:#0f172a;font-size:12px;font-family:'DM Sans',sans-serif;outline:none;cursor:pointer;}
        .cs option{background:#ffffff;color:#0f172a;}
        .ainfo{font-size:11px;color:#64748b;}
        .dot-h{width:24px;height:24px;background:#d1fae5;border:1.5px solid rgba(34,197,94,0.45);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:10px;color:#166534;font-weight:700;}
        .dot-a{width:24px;height:24px;background:#f8fafc;border:1px solid rgba(203,213,225,0.8);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:9px;color:#94a3b8;}
        .tot-badge{background:#cffafe;color:#0c4a6e;border:1px solid rgba(6,182,212,0.22);padding:3px 8px;border-radius:20px;font-size:11px;font-weight:600;}
        .wk-hdr{color:#0ea5e9!important;font-size:10px!important;}
        .empty{text-align:center;padding:60px;color:#64748b;font-size:14px;}
        .btn-photo{background:#e0f2fe;color:#0369a1;border:1px solid rgba(14,165,233,0.3);padding:3px 6px;border-radius:6px;font-size:9px;margin-top:4px;cursor:pointer;font-weight:600;}
        .btn-photo:hover{background:#bae6fd;}
        @media (min-width: 640px) {
          .stats-grid { grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
          .sc { padding: 24px; }
          .sl { font-size: 11px; margin-bottom: 10px; }
          .sv { font-size: 32px; }
          .filters { gap: 10px; margin-bottom: 20px; }
          .fbtn { padding: 8px 18px; font-size: 12px; }
          .tscroll { overflow-x: auto; }
          th { padding: 14px 14px; font-size: 11px; }
          td { padding: 15px 14px; font-size: 14px; }
          .mname { font-size: 14px; }
          .memail { font-size: 12px; }
          .rsel { padding: 8px 12px; font-size: 13px; }
          .badge { padding: 5px 12px; font-size: 11px; }
          .acts { gap: 8px; }
          .ab { padding: 8px 14px; font-size: 12px; }
          .ctrl { gap: 10px; margin-bottom: 20px; }
          .cl { font-size: 13px; }
          .cs { padding: 9px 13px; font-size: 13px; }
          .ainfo { font-size: 12px; }
          .dot-h, .dot-a { width: 28px; height: 28px; font-size: 12px; }
          .tot-badge { padding: 4px 10px; font-size: 12px; }
          .btn-photo { font-size: 10px; padding: 4px 8px; }
        }
        @media (min-width: 768px) {
          .stats-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 1024px) {
          .topbar { padding: 0 32px; }
          .content { padding: 40px 32px; }
        }
      `}</style>

      <div style={S.layout}>
        <div style={S.topbar}>
          <div style={{display:'flex',alignItems:'center',gap:12,minWidth:0,flex:'1 1 0',flexWrap:'wrap',maxWidth:'100%'}}>
            <div style={{...S.logo,background:'none',boxShadow:'none'}}>
              <img src="/logo_ukm.jpg" alt="Logo UKM" style={{width:'100%',height:'100%',borderRadius:14,objectFit:'cover'}} />
            </div>
            <span style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:'#0f172a',fontWeight:700,whiteSpace:'nowrap'}}>UKM Admin</span>
            <span style={{background:'rgba(245,158,11,0.14)',color:'#854d0e',fontSize:11,padding:'4px 12px',borderRadius:20,border:'1px solid rgba(245,158,11,0.22)',fontWeight:600,whiteSpace:'nowrap'}}>ADMINISTRATOR</span>
          </div>
          <button style={{background:'rgba(34,197,94,0.12)',border:'1px solid rgba(34,197,94,0.22)',color:'#0b6623',padding:'8px 16px',borderRadius:10,fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",flexShrink:0,whiteSpace:'nowrap',alignSelf:'flex-start'}}
            onClick={async()=>{await supabase.auth.signOut();router.push('/login')}}>Keluar</button>
          </div>

        <div style={S.content}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,color:'#0f172a',fontWeight:700,marginBottom:4}}>Dashboard Admin</div>
          <div style={{color:'#475569',fontSize:14,marginBottom:28}}>Kelola anggota dan pantau kehadiran UKM dengan antarmuka modern.</div>
          <div style={{ marginBottom: 16 }}>
            {sudahAbsen ? (
              <span style={{ color: 'green', fontWeight: 'bold' }}>✅ Anda sudah absen hari ini</span>
            ) : (
              <button 
                onClick={() => router.push('/dashboard/absen')} // Sesuaikan URL halaman absenmu
                style={{ background: '#22c55e', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
              >
                Absen Sekarang
              </button>
            )}
          </div>
          <div style={{display:'flex',gap:4,background:'#f8fafc',border:'2px solid rgba(15,23,82,0.35)',borderRadius:12,padding:4,marginBottom:28,width:'fit-content'}}>
            <button className={`tab-btn ${activeTab==='members'?'on':''}`} onClick={()=>setActiveTab('members')}>👥 Manajemen Anggota</button>
            <button className={`tab-btn ${activeTab==='absen'?'on':''}`} onClick={()=>{setActiveTab('absen');getAttendances()}}>📋 Rekap Absensi</button>
          </div>

          {activeTab==='members' && (
            <>
              <div className="stats-grid">
                <div className="sc sy"><div className="sl">Menunggu</div><div className="sv">{counts.pending}</div></div>
                <div className="sc sgr"><div className="sl">Disetujui</div><div className="sv">{counts.approved}</div></div>
                <div className="sc sr"><div className="sl">Ditolak</div><div className="sv">{counts.rejected}</div></div>
              </div>

              <div className="filters">
                {(['all','pending','approved','rejected'] as const).map(f=>(
                  <button key={f} className={`fbtn ${filter===f?'on':''}`} onClick={()=>setFilter(f)}>
                    {f==='all'?'Semua':f==='pending'?'Menunggu':f==='approved'?'Disetujui':'Ditolak'}
                  </button>
                ))}
              </div>

              <div style={S.tableWrap}>
                {filtered.length===0?<div className="empty">Tidak ada data</div>:(
                  <div className="tscroll">
                    <table>
                      <thead><tr>
                        <th className="tl" style={{width:44}}>No</th>
                        <th className="tl">Anggota</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr></thead>
                    <tbody>
                      {filtered.map((u,i)=>(
                        <tr key={u.id}>
                          <td className="tl"><span className="nc">{i+1}</span></td>
                          <td className="tl"><div className="mname">{u.name}</div><div className="memail">{u.email}</div></td>
                          <td>
                            <select className="rsel" value={u.role} onChange={e=>updateRole(u.id,e.target.value)}>
                              <option value="member">Member</option>
                              <option value="bendahara">Bendahara</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td>
                            <span className={`badge ${u.status==='pending'?'bp':u.status==='approved'?'ba':'br'}`}>
                              {u.status==='pending'?'Menunggu':u.status==='approved'?'Disetujui':'Ditolak'}
                            </span>
                          </td>
                          <td>
                            <div className="acts">
                              {u.status!=='approved'&&<button className="ab aap" onClick={()=>updateStatus(u.id,'approved')}>✓ Setujui</button>}
                              {u.status!=='rejected'&&<button className="ab arj" onClick={()=>updateStatus(u.id,'rejected')}>✕ Tolak</button>}
                              {u.status!=='pending'&&<button className="ab apd" onClick={()=>updateStatus(u.id,'pending')}>↺ Pending</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab==='absen' && (
            <>
              <div className="ctrl">
                <span className="cl">Bulan:</span>
                <select className="cs" value={selMonth} onChange={e=>setSelMonth(Number(e.target.value))}>
                  {monthNames.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                </select>
                <select className="cs" value={selYear} onChange={e=>setSelYear(Number(e.target.value))}>
                  {yearOptions.map(y=><option key={y} value={y}>{y}</option>)}
                </select>
                <button className="fbtn on" style={{whiteSpace:'nowrap', border:'none', padding:'8px 16px'}} onClick={exportAttendanceExcel}>Export Excel</button>
                <span className="ainfo">{allDates.length} hari pertemuan · {approvedMembers.length} anggota aktif</span>
                <span className="ainfo">📊 Total records: {attendances.length}</span>
              </div>

              {loading?<div className="empty">Memuat data...</div>:(
                <div style={S.tableWrap}>
                  <div className="tscroll">
                    {allDates.length===0?(
                      <div className="empty">Belum ada data absensi di {monthNames[selMonth-1]} {selYear}</div>
                    ):(
                      <table>
                        <thead>
                          <tr>
                            <th className="tl" style={{width:44}}>No</th>
                            <th className="tl" style={{minWidth:160}}>Nama</th>
                            {allDates.map(d=>{
                              const week=getWeekOfMonth(d)
                              const date=new Date(d+'T00:00:00')
                              const days=['Min','Sen','Sel','Rab','Kam','Jum','Sab']
                              return(
                                <th key={d} style={{minWidth:60,textAlign:'center'}}>
                                  <div className="wk-hdr">Mg {week}</div>
                                  <div style={{color:'#64748b',fontSize:10,marginTop:1}}>{days[date.getDay()]}</div>
                                  <div style={{color:'#94a3b8',fontSize:12,marginTop:1}}>{date.getDate()}</div>
                                </th>
                              )
                            })}
                            <th style={{minWidth:72}}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {approvedMembers.map((u,i)=>{
                            const udates = absenMap[u.id] ?? {}
                            const total = Object.keys(udates).length
                            const pct = allDates.length>0 ? Math.round(total/allDates.length*100) : 0
                            
                            return(
                              <tr key={u.id}>
                                <td className="tl"><span className="nc">{i+1}</span></td>
                                <td className="tl"><div className="mname">{u.name}</div></td>
                                {allDates.map(d => {
                                  const record = udates[d]
                                  return (
                                    <td key={d}>
                                      {record ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                          <div className="dot-h">✓</div>
                                          {record.photo_url && (
                                            <button 
                                              className="btn-photo"
                                              onClick={() => setSelectedPhoto(record.photo_url!)}
                                            >
                                              Lihat Foto
                                            </button>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="dot-a">–</div>
                                      )}
                                    </td>
                                  )
                                })}
                                <td>
                                  <span className="tot-badge">{total}/{allDates.length}</span>
                                  <div style={{fontSize:10,color:pct>=80?'#22c55e':pct>=50?'#0ea5e9':'#f87171',marginTop:3}}>{pct}%</div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal / Pop-up Foto */}
      {selectedPhoto && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15,23,82,0.6)', backdropFilter: 'blur(4px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: '#fff', borderRadius: '24px', padding: '24px',
            maxWidth: '450px', width: '100%', position: 'relative',
            boxShadow: '0 24px 60px rgba(30,58,138,0.2)', textAlign: 'center'
          }}>
            <button 
              onClick={() => setSelectedPhoto(null)} 
              style={{
                position: 'absolute', top: '16px', right: '16px',
                background: '#fee2e2', color: '#b91c1c', border: 'none',
                borderRadius: '50%', width: '32px', height: '32px',
                cursor: 'pointer', fontWeight: 'bold', fontSize: '14px'
              }}
            >
              ✕
            </button>
            <h3 style={{ fontFamily: "'Playfair Display',serif", marginBottom: '16px', fontSize: '20px', color: '#0f172a' }}>
              Bukti Kehadiran
            </h3>
            <img 
              src={selectedPhoto} 
              alt="Bukti Absen" 
              style={{ width: '100%', maxHeight: '60vh', borderRadius: '12px', objectFit: 'contain', background: '#f1f5f9' }} 
            />
            <button 
              onClick={() => setSelectedPhoto(null)}
              style={{
                marginTop: '20px', padding: '10px 24px', borderRadius: '12px',
                background: '#f8fafc', border: '2px solid rgba(15,23,82,0.2)',
                cursor: 'pointer', fontWeight: 600, fontFamily: "'DM Sans', sans-serif"
              }}
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </>
  )
}