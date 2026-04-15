'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

type Attendance = { id: string; date: string; status: string }
type Profile = { name: string; email: string; role: string }

export default function MemberDashboard() {
  const [profile, setProfile] = useState<Profile|null>(null)
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [absenLoading, setAbsenLoading] = useState(false)
  const [sudahAbsen, setSudahAbsen] = useState(false)
  const [userId, setUserId] = useState<string|null>(null)
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]

  const loadData = useCallback(async () => {
    const {data:{user}} = await supabase.auth.getUser()
    if (!user){router.push('/login');return}
    setUserId(user.id)

    const {data:p} = await supabase.from('profiles').select('name,email,role,status').eq('id',user.id).single()
    if (!p||p.status!=='approved'){await supabase.auth.signOut();router.push('/login');return}
    setProfile(p)

    const {data:absen} = await supabase.from('attendance').select('*').eq('user_id',user.id).order('date',{ascending:false})
    setAttendances(absen??[])
    setSudahAbsen(absen?.some(a=>a.date===today)??false)
    setLoading(false)
  },[router,today])

  const handleAbsen = async () => {
    if (!userId) return
    setAbsenLoading(true)
    const {error} = await supabase.from('attendance').insert([{user_id:userId,date:today,status:'hadir'}])
    if (error){
      alert('Gagal absen: '+error.message)
    } else {
      setSudahAbsen(true)
      loadData()
    }
    setAbsenLoading(false)
  }

  useEffect(()=>{loadData()},[loadData])

  const totalAbsen=attendances.length
  const bulanIni=attendances.filter(a=>a.date.startsWith(new Date().toISOString().slice(0,7))).length

  if (loading) return (
    <div style={{minHeight:'100vh',background:'linear-gradient(180deg,#ecfeff 0%,#f8fafc 100%)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',sans-serif"}}>
      <span style={{color:'#0f172a'}}>Memuat...</span>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:linear-gradient(180deg,#ecfeff 0%,#d9f99d 55%,#fef3c7 100%)!important;color:#0f172a!important;}
        .layout{min-height:100vh;background:#f8fbff;color:#0f172a;font-family:'DM Sans',sans-serif;}
        .topbar{background:#ffffff;border-bottom:2px solid rgba(15,23,82,0.35);box-shadow:0 20px 50px rgba(30,58,138,0.08);padding:0 32px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10;}
        .logo{width:42px;height:42px;background:linear-gradient(135deg,#06b6d4,#22c55e);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:18px;color:#ffffff;}
        .ttl{font-family:'Playfair Display',serif;font-size:18px;color:#0f172a;font-weight:600;}
        .badge{background:rgba(219,234,254,0.35);color:#0f172a;font-size:11px;padding:4px 12px;border-radius:999px;border:2px solid rgba(15,23,82,0.35);font-weight:700;text-transform:uppercase;}
        .btn-out{background:#e0f2fe;border:1px solid rgba(14,165,233,0.22);color:#0c4a6e;padding:10px 18px;border-radius:12px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;}
        .content{max-width:840px;margin:0 auto;padding:40px 32px;}
        .ptitle{font-family:'Playfair Display',serif;font-size:28px;color:#0f172a;font-weight:700;margin-bottom:6px;}
        .psub{color:#475569;font-size:14px;margin-bottom:32px;}
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;}
        .card{background:#ffffff;border:2px solid rgba(15,23,82,0.35);border-radius:24px;padding:24px;box-shadow:0 24px 60px rgba(30,58,138,0.08);}
        .clbl{font-size:11px;font-weight:600;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;}
        .cval{font-family:'Playfair Display',serif;font-size:32px;font-weight:700;color:#0f172a;}
        .cunit{font-size:13px;font-weight:500;color:#64748b;font-family:'DM Sans',sans-serif;margin-left:6px;}
        .prow{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:2px solid rgba(15,23,82,0.35);}
        .prow:last-child{border-bottom:none;}
        .pk{font-size:12px;color:#64748b;font-weight:600;}
        .pv{font-size:14px;color:#0f172a;font-weight:600;}
        .absen-done{display:flex;align-items:center;gap:10px;background:rgba(219,234,254,0.35);border:2px solid rgba(15,23,82,0.35);border-radius:16px;padding:18px 20px;}
        .adone-txt{color:#166534;font-weight:700;font-size:14px;}
        .btn-absen{background:linear-gradient(135deg,#06b6d4 0%,#22c55e 50%,#f59e0b 100%);color:#ffffff;padding:14px 30px;border-radius:16px;font-size:14px;font-weight:700;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.2s;}
        .btn-absen:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 12px 32px rgba(34,197,94,0.24);}
        .btn-absen:disabled{opacity:0.5;cursor:not-allowed;}
        .hitem{display:flex;justify-content:space-between;align-items:center;padding:18px 24px;border-bottom:1px solid rgba(30,58,138,0.12);}
        .hitem:last-child{border-bottom:none;}
        .hdate{font-size:13px;color:#64748b;}
        .hbadge{background:rgba(245,158,11,0.12);color:#92400e;border:1px solid rgba(245,158,11,0.24);padding:5px 14px;border-radius:999px;font-size:11px;font-weight:700;}
        .hempty{padding:32px 24px;text-align:center;color:#94a3b8;font-size:13px;}
        .hhead{padding:20px 24px;border-bottom:2px solid rgba(15,23,82,0.35);font-size:14px;font-weight:700;color:#0f172a;}
      `}</style>

      <div className="layout">
        <div className="topbar">
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div className="logo" style={{background:'none',boxShadow:'none',padding:0}}>
              <img src="/logo_ukm.jpg" alt="Logo UKM" style={{width:'100%',height:'100%',borderRadius:14,objectFit:'cover'}} />
            </div>
            <span className="ttl">UKM</span>
            <span className="badge">{profile?.role}</span>
          </div>
          <button className="btn-out" onClick={async()=>{await supabase.auth.signOut();router.push('/login')}}>Keluar</button>
        </div>

        <div className="content">
          <div className="ptitle">Halo, {profile?.name?.split(' ')[0]} 👋</div>
          <div className="psub">Selamat datang kembali di portal anggota UKM</div>

          <div className="grid2">
            <div className="card"><div className="clbl">Total Kehadiran</div><div className="cval">{totalAbsen}<span className="cunit">kali</span></div></div>
            <div className="card"><div className="clbl">Bulan Ini</div><div className="cval">{bulanIni}<span className="cunit">kali</span></div></div>
          </div>

          <div className="card" style={{marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:600,color:'#0c4a6e',letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:14}}>Profil Saya</div>
            <div className="prow"><span className="pk">Nama</span><span className="pv">{profile?.name}</span></div>
            <div className="prow"><span className="pk">Email</span><span className="pv">{profile?.email}</span></div>
            <div className="prow"><span className="pk">Role</span><span className="pv" style={{textTransform:'capitalize'}}>{profile?.role}</span></div>
          </div>

          <div className="card" style={{marginBottom:16}}>
            <div style={{fontSize:15,fontWeight:600,color:'#0f172a',marginBottom:4}}>Absensi Hari Ini</div>
            <div style={{fontSize:12,color:'#64748b',marginBottom:20}}>
              {new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
            </div>
            {sudahAbsen?(
              <div className="absen-done">
                <span style={{fontSize:20}}>✅</span>
                <span className="adone-txt">Kamu sudah absen hari ini</span>
              </div>
            ):(
              <button className="btn-absen" onClick={handleAbsen} disabled={absenLoading}>
                {absenLoading?'Memproses...':'Absen Sekarang →'}
              </button>
            )}
          </div>

          <div className="card">
            <div className="hhead">Riwayat Absensi ({totalAbsen} kali)</div>
            {attendances.length===0?(
              <div className="hempty">Belum ada riwayat absensi</div>
            ):attendances.slice(0,15).map(a=>(
              <div key={a.id} className="hitem">
                <span className="hdate">
                  {new Date(a.date+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
                </span>
                <span className="hbadge">{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}