'use client'

import { useEffect, useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

type Profile = { id: string; name: string; email: string }
type KasPayment = {
  id: string; user_id: string; month: string
  pertemuan_1: boolean; pertemuan_2: boolean; pertemuan_3: boolean; pertemuan_4: boolean
  pertemuan_5: boolean; pertemuan_6: boolean; pertemuan_7: boolean; pertemuan_8: boolean
}

const IURAN = 2000
const TOTAL_P = 8

const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

function addMonths(monthStr: string, n: number) {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

const rp = (n: number) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(n)

export default function BendaharaDashboard() {
  const now = new Date()
  const [members, setMembers] = useState<Profile[]>([])
  const [kasData, setKasData] = useState<KasPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'kas'|'transaksi'>('kas')
  const [selYear, setSelYear] = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth()+1)
  const selectedMonth = `${selYear}-${String(selMonth).padStart(2,'0')}`
  const [inputModal, setInputModal] = useState<{userId:string;name:string}|null>(null)
  const [inputAmount, setInputAmount] = useState('')
  const [transactions, setTransactions] = useState<{id:string;title:string;amount:number;type:string;description:string|null;created_at:string}[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({title:'',amount:'',type:'masuk' as 'masuk'|'keluar',description:''})
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const yearOptions = Array.from({length:10},(_,i)=>now.getFullYear()-5+i)

  const checkAccess = useCallback(async () => {
    const {data:{user}} = await supabase.auth.getUser()
    if (!user){router.push('/login');return}
    const {data:p} = await supabase.from('profiles').select('role,status').eq('id',user.id).single()
    if (!p||!['bendahara','admin'].includes(p.role)||p.status!=='approved') router.push('/login')
  },[router])

  const getMembers = useCallback(async () => {
    const {data} = await supabase.from('profiles').select('id,name,email').eq('status','approved').order('name')
    setMembers(data??[])
  },[])

  const getKasData = useCallback(async () => {
    setLoading(true)
    const {data} = await supabase.from('kas_payments').select('*').eq('month',selectedMonth)
    setKasData(data??[])
    setLoading(false)
  },[selectedMonth])

  const exportKasExcel = () => {
    if(members.length === 0) {
      alert('Tidak ada data iuran untuk diekspor')
      return
    }

    const header = ['No', 'Nama Anggota', 'Email', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'Dibayar', 'Status']
    const rows: Array<Array<string | number>> = [header]

    members.forEach((member, index) => {
      const rec = getRec(member.id)
      const paid = getPaid(rec)
      const status = paid === TOTAL_P ? 'Lunas' : 'Belum Lunas'
      const row: Array<string | number> = [
        index + 1,
        member.name,
        member.email,
        ...[1,2,3,4,5,6,7,8].map(n => (rec?.[`pertemuan_${n}` as keyof KasPayment] ? '✓' : '')),
        paid * IURAN,
        status,
      ]
      rows.push(row)
    })

    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Iuran')
    XLSX.writeFile(workbook, `Rekap_Iuran_Rutin_${monthNames[selMonth-1]}_${selYear}.xlsx`)
  }

  const getTx = useCallback(async () => {
    const {data} = await supabase.from('transactions').select('*').order('created_at',{ascending:false})
    setTransactions(data??[])
  },[])

  useEffect(()=>{checkAccess();getMembers();getTx()},[checkAccess,getMembers,getTx])
  useEffect(()=>{getKasData()},[getKasData])

  const getRec = (uid:string) => kasData.find(k=>k.user_id===uid)
  const getPaid = (rec?:KasPayment) => !rec?0:[1,2,3,4,5,6,7,8].filter(n=>rec[`pertemuan_${n}` as keyof KasPayment]).length

  const toggleP = async (uid:string, n:number, cur:boolean) => {
    setSaving(true)
    const field=`pertemuan_${n}` as keyof KasPayment
    const rec=getRec(uid)
    if(rec){
      await supabase.from('kas_payments').update({[field]:!cur,updated_at:new Date().toISOString()}).eq('id',rec.id)
    } else {
      const nr:Record<string,boolean|string>={user_id:uid,month:selectedMonth,pertemuan_1:false,pertemuan_2:false,pertemuan_3:false,pertemuan_4:false,pertemuan_5:false,pertemuan_6:false,pertemuan_7:false,pertemuan_8:false}
      nr[field]=true
      await supabase.from('kas_payments').insert([nr])
    }
    await getKasData()
    setSaving(false)
  }

  const handleInputUang = async () => {
    if(!inputModal) return
    const amount=parseInt(inputAmount)
    if(isNaN(amount)||amount<IURAN){alert(`Minimal Rp ${rp(IURAN)}`);return}
    setSaving(true)
    let remaining=Math.floor(amount/IURAN)
    let cur=selectedMonth
    const {data:allKas}=await supabase.from('kas_payments').select('*').eq('user_id',inputModal.userId)
    const kasMap:Record<string,KasPayment>={}
    ;(allKas??[]).forEach((k:KasPayment)=>{kasMap[k.month]=k})
    let loop=0
    while(remaining>0&&loop<36){
      const rec=kasMap[cur]
      const unpaid=[1,2,3,4,5,6,7,8].filter(n=>!rec||!rec[`pertemuan_${n}` as keyof KasPayment])
      if(unpaid.length>0){
        const fill=Math.min(remaining,unpaid.length)
        const nr:Record<string,boolean|string>={user_id:inputModal.userId,month:cur,pertemuan_1:rec?.pertemuan_1??false,pertemuan_2:rec?.pertemuan_2??false,pertemuan_3:rec?.pertemuan_3??false,pertemuan_4:rec?.pertemuan_4??false,pertemuan_5:rec?.pertemuan_5??false,pertemuan_6:rec?.pertemuan_6??false,pertemuan_7:rec?.pertemuan_7??false,pertemuan_8:rec?.pertemuan_8??false}
        for(let i=0;i<fill;i++) nr[`pertemuan_${unpaid[i]}`]=true
        if(rec) await supabase.from('kas_payments').update({...nr,updated_at:new Date().toISOString()}).eq('id',rec.id)
        else await supabase.from('kas_payments').insert([nr])
        remaining-=fill
      }
      cur=addMonths(cur,1); loop++
    }
    await getKasData()
    setInputModal(null); setInputAmount('')
    setSaving(false)
  }

  const getPreview = () => {
    if(!inputModal||!inputAmount) return null
    const amount=parseInt(inputAmount)
    if(isNaN(amount)||amount<IURAN) return null
    let remaining=Math.floor(amount/IURAN)
    const sisa=amount%IURAN
    const lines:{month:string;count:number}[]=[]
    let cur=selectedMonth; let loop=0
    while(remaining>0&&loop<36){
      const rec=kasData.find(k=>k.user_id===inputModal.userId&&k.month===cur)
      const unpaid=[1,2,3,4,5,6,7,8].filter(n=>!rec||!rec[`pertemuan_${n}` as keyof KasPayment])
      if(unpaid.length>0){const fill=Math.min(remaining,unpaid.length);lines.push({month:cur,count:fill});remaining-=fill}
      cur=addMonths(cur,1); loop++
    }
    return {lines,sisa}
  }

  const handleTambahTx = async () => {
    if(!form.title||!form.amount){alert('Judul dan nominal wajib diisi');return}
    setSubmitting(true)
    const {data:{user}}=await supabase.auth.getUser()
    await supabase.from('transactions').insert([{title:form.title,amount:Number(form.amount),type:form.type,description:form.description||null,created_by:user?.id}])
    setForm({title:'',amount:'',type:'masuk',description:''}); setShowForm(false); getTx()
    setSubmitting(false)
  }

  const totalLunas=members.filter(m=>{const r=getRec(m.id);return r&&[1,2,3,4,5,6,7,8].every(n=>r[`pertemuan_${n}` as keyof KasPayment])}).length
  const totalTerkumpul=kasData.reduce((s,r)=>s+getPaid(r)*IURAN,0)
  const preview=getPreview()

  const S = {
    layout:{minHeight:'100vh',background:'linear-gradient(180deg,#ecfeff 0%,#d9f99d 55%,#fde68a 100%)',color:'#0f172a',fontFamily:"'DM Sans',sans-serif"},
    topbar:{background:'linear-gradient(135deg,#ecfeff 0%,#d9f99d 30%,#fef3c7 100%)',backdropFilter:'blur(18px)',borderBottom:'2px solid rgba(15,23,82,0.35)',padding:'12px 16px',minHeight:64,display:'flex',flexWrap:'wrap' as const,alignItems:'flex-start',justifyContent:'space-between',gap:'12px',position:'sticky' as const,top:0,zIndex:10,boxShadow:'0 12px 30px rgba(30,58,138,0.08)'},
    logo:{width:36,height:36,background:'linear-gradient(135deg,#06b6d4,#22c55e,#f59e0b)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:'#ffffff',boxShadow:'0 16px 30px rgba(34,197,94,0.18)'},
    title:{fontFamily:"'Playfair Display',serif",fontSize:18,color:'#0f172a',fontWeight:700},
    badge:{background:'rgba(245,158,11,0.14)',color:'#92400e',fontSize:11,padding:'4px 12px',borderRadius:20,border:'1px solid rgba(245,158,11,0.22)',fontWeight:600},
    btnLogout:{background:'rgba(34,197,94,0.12)',border:'1px solid rgba(34,197,94,0.22)',color:'#0b6623',padding:'10px 18px',borderRadius:14,fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"},
    content:{maxWidth:1200,margin:'0 auto',padding:'20px 16px'},
    pageTitle:{fontFamily:"'Playfair Display',serif",fontSize:26,color:'#0f172a',fontWeight:700,marginBottom:4},
    pageSub:{color:'#475569',fontSize:14,marginBottom:28},
    tabs:{display:'flex',gap:4,background:'#f8fafc',border:'2px solid rgba(15,23,82,0.35)',borderRadius:12,padding:4,marginBottom:28,width:'fit-content'},
    tableWrap:{background:'#ffffff',border:'2px solid rgba(15,23,82,0.35)',borderRadius:20,overflow:'hidden',boxShadow:'0 18px 50px rgba(30,58,138,0.08)'},
    empty:{textAlign:'center' as const,padding:60,color:'#64748b',fontSize:14},
    overlay:{position:'fixed' as const,inset:0,background:'rgba(15,23,42,0.18)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:16},
    modal:{background:'#ffffff',border:'2px solid rgba(15,23,82,0.35)',borderRadius:24,padding:24,width:'100%',maxWidth:500,color:'#0f172a',boxShadow:'0 30px 80px rgba(30,58,138,0.12)'},
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:linear-gradient(180deg,#ecfeff 0%,#d9f99d 55%,#fde68a 100%)!important;color:#0f172a!important;}
        .tab-btn{padding:9px 20px;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:all 0.2s;color:#475569;background:transparent;}
        .tab-btn.on{background:rgba(56,111,232,0.10);color:#0f172a;border:1px solid rgba(30,58,138,0.25);}
        .stats-grid{display:grid;grid-template-columns:repeat(1,1fr);gap:16px;margin-bottom:28px;}
        .sc{background:#ffffff;border:2px solid rgba(15,23,82,0.35);border-radius:20px;padding:24px;box-shadow:0 24px 60px rgba(30,58,138,0.08);}
        .sl{font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;color:#64748b;}
        .sv{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;line-height:1;color:#0f172a;}
        .sg .sl{color:rgba(6,182,212,0.7);} .sg .sv{color:#0c4a6e;}
        .sgr .sl{color:rgba(34,197,94,0.7);} .sgr .sv{color:#166534;}
        .sb .sl{color:rgba(59,130,246,0.7);} .sb .sv{color:#2563eb;}
        .sr .sl{color:rgba(248,113,113,0.7);} .sr .sv{color:#b91c1c;}
        .ctrl{display:flex;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:wrap;}
        .cl{font-size:13px;font-weight:600;color:#0f172a;}
        .cs{background:#f8fafc;border:2px solid rgba(15,23,82,0.35);border-radius:12px;padding:10px 14px;color:#0f172a;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;cursor:pointer;}
        .cs option{background:#ffffff;color:#0f172a;}
        .ipill{background:rgba(6,182,212,0.12);border:1px solid rgba(6,182,212,0.2);color:#0c4a6e;font-size:12px;padding:6px 12px;border-radius:20px;}
        .tscroll{overflow-x:auto;}
        table{width:100%;border-collapse:collapse;}
        thead{background:#f8fafc;}
        th{padding:13px 12px;font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;border-bottom:2px solid rgba(15,23,82,0.35);white-space:nowrap;text-align:center;}
        th.tl{text-align:left;padding-left:18px;}
        td{padding:13px 12px;border-bottom:1px solid rgba(226,232,240,0.8);text-align:center;vertical-align:middle;color:#0f172a;}
        td.tl{text-align:left;padding-left:18px;}
        tr:last-child td{border-bottom:none;}
        tr:hover td{background:#f8fbff;}
        .mn{font-weight:600;color:#0f172a;font-size:14px;}
        .ms{color:#64748b;font-size:12px;margin-top:2px;}
        .nc{color:#475569;font-size:13px;}
        .chk{width:32px;height:32px;border-radius:10px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;transition:all 0.15s;margin:0 auto;}
        .con{background:rgba(34,197,94,0.18);border:1.5px solid rgba(34,197,94,0.45);color:#166534;}
        .con:hover{background:rgba(34,197,94,0.28);}
        .coff{background:#f8fafc;border:2px solid rgba(15,23,82,0.35);color:transparent;}
        .coff:hover{background:#e0f2fe;border-color:rgba(14,165,233,0.25);}
        .chk:disabled{opacity:0.4;cursor:not-allowed;}
        .pw{display:flex;align-items:center;gap:7px;justify-content:center;}
        .pb{width:44px;height:4px;background:#e2e8f0;border-radius:2px;overflow:hidden;}
        .pf{height:100%;border-radius:2px;transition:width 0.3s;}
        .pt{font-size:11px;font-weight:600;color:#64748b;}
        .binp{background:rgba(6,182,212,0.12);border:1px solid rgba(6,182,212,0.2);color:#0c4a6e;padding:6px 14px;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;}
        .binp:hover{background:rgba(6,182,212,0.18);}
        /* modal */
        .mtitle{font-family:'Playfair Display',serif;font-size:20px;color:#0f172a;font-weight:700;margin-bottom:4px;}
        .msub{font-size:13px;color:#475569;margin-bottom:20px;}
        .minfo{background:rgba(6,182,212,0.08);border:1px solid rgba(6,182,212,0.18);border-radius:14px;padding:14px 16px;font-size:13px;color:#0c4a6e;margin-bottom:18px;line-height:1.7;}
        .mlbl{display:block;font-size:11px;font-weight:600;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;}
        .minp{width:100%;background:#f8fafc;border:2px solid rgba(15,23,82,0.35);border-radius:14px;padding:14px 16px;color:#0f172a;font-size:15px;font-family:'DM Sans',sans-serif;outline:none;}
        .minp:focus{border-color:rgba(6,182,212,0.45);}
        .minp::placeholder{color:#94a3b8;}
        .pvbox{margin-top:12px;background:rgba(219,234,254,0.35);border:2px solid rgba(15,23,82,0.35);border-radius:14px;padding:14px;}
        .pvrow{display:flex;justify-content:space-between;font-size:12px;color:#475569;padding:4px 0;}
        .pvrow span:last-child{color:#0f766e;font-weight:600;}
        .pvsisa{font-size:11px;color:#64748b;margin-top:8px;padding-top:8px;border-top:1px solid rgba(226,232,240,0.8);}
        .macts{display:flex;gap:10px;margin-top:22px;}
        .bconf{flex:1;background:linear-gradient(135deg,#06b6d4,#0ea5e9);color:#ffffff;padding:14px;border-radius:14px;font-size:14px;font-weight:700;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;}
        .bconf:disabled{opacity:0.6;cursor:not-allowed;}
        .bcanm{flex:1;background:#f8fafc;border:2px solid rgba(15,23,82,0.35);color:#0f172a;padding:14px;border-radius:14px;font-size:14px;cursor:pointer;font-family:'DM Sans',sans-serif;}
        /* transaksi */
        .sh{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;}
        .badd{background:linear-gradient(135deg,#06b6d4,#22c55e,#f59e0b);color:#ffffff;padding:10px 20px;border-radius:14px;font-size:13px;font-weight:700;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;}
        .fcard{background:#ffffff;border:2px solid rgba(15,23,82,0.35);border-radius:20px;padding:24px;margin-bottom:20px;box-shadow:0 24px 60px rgba(30,58,138,0.08);}
        .fgrid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
        .flbl{display:block;font-size:11px;font-weight:600;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;}
        .fi{width:100%;background:#f8fafc;border:2px solid rgba(15,23,82,0.35);border-radius:14px;padding:14px 16px;color:#0f172a;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;}
        .fi::placeholder{color:#94a3b8;}
        .fi:focus{border-color:rgba(6,182,212,0.45);}
        .fi option{background:#ffffff;color:#0f172a;}
        .fa{display:flex;gap:10px;margin-top:16px;}
        .bsv{background:linear-gradient(135deg,#22c55e,#14b8a6);color:#ffffff;padding:12px 20px;border-radius:14px;font-size:13px;font-weight:700;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;}
        .bcn{background:#f8fafc;border:2px solid rgba(15,23,82,0.35);color:#0f172a;padding:12px 20px;border-radius:14px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;}
        .txn{font-weight:700;color:#0f172a;font-size:14px;}
        .txd{color:#64748b;font-size:12px;margin-top:2px;}
        .bm{background:rgba(34,197,94,0.12);color:#0f766e;border:1px solid rgba(34,197,94,0.22);padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;}
        .bk{background:rgba(248,113,113,0.12);color:#b91c1c;border:1px solid rgba(248,113,113,0.22);padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;}
        .am{color:#0f766e;font-weight:700;font-size:14px;}
        .ak{color:#b91c1c;font-weight:700;font-size:14px;}
        .dt{color:#64748b;font-size:12px;}
        .empty{text-align:center;padding:60px;color:#64748b;font-size:14px;}
        @media (min-width: 640px) {
          .stats-grid { grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
          .sc { padding: 24px; }
          .sl { font-size: 11px; margin-bottom: 10px; }
          .sv { font-size: 22px; }
          .ctrl { gap: 10px; margin-bottom: 20px; }
          .cl { font-size: 13px; }
          .cs { padding: 10px 14px; font-size: 13px; }
          .ipill { font-size: 12px; padding: 6px 12px; }
          .tscroll { overflow-x: auto; }
          th { padding: 13px 12px; font-size: 11px; }
          td { padding: 13px 12px; font-size: 14px; }
          .mn { font-size: 14px; }
          .ms { font-size: 12px; }
          .nc { font-size: 13px; }
          .chk { width: 32px; height: 32px; font-size: 14px; }
          .pw { gap: 7px; }
          .pb { width: 44px; height: 4px; }
          .pt { font-size: 11px; }
          .binp { padding: 6px 14px; font-size: 12px; }
          .mtitle { font-size: 20px; }
          .msub { font-size: 13px; margin-bottom: 20px; }
          .minfo { padding: 14px 16px; font-size: 13px; margin-bottom: 18px; }
          .mlbl { font-size: 11px; margin-bottom: 8px; }
          .minp { padding: 14px 16px; font-size: 15px; }
          .pvbox { margin-top: 12px; padding: 14px; }
          .pvrow { font-size: 12px; padding: 4px 0; }
          .pvsisa { font-size: 11px; margin-top: 8px; padding-top: 8px; }
          .macts { gap: 10px; margin-top: 22px; }
          .bconf { padding: 14px; font-size: 14px; }
          .bcanm { padding: 14px; font-size: 14px; }
          .sh { margin-bottom: 16px; }
          .badd { padding: 10px 20px; font-size: 13px; }
          .fcard { padding: 24px; margin-bottom: 20px; }
          .fgrid { grid-template-columns: 1fr 1fr; gap: 16px; }
          .flbl { font-size: 11px; margin-bottom: 8px; }
          .fi { padding: 14px 16px; font-size: 13px; }
          .fa { gap: 10px; margin-top: 16px; }
          .bsv { padding: 12px 20px; font-size: 13px; }
          .bcn { padding: 12px 20px; font-size: 13px; }
          .txn { font-size: 14px; }
          .txd { font-size: 12px; margin-top: 2px; }
          .bm { padding: 5px 12px; font-size: 11px; }
          .bk { padding: 5px 12px; font-size: 11px; }
          .am { font-size: 14px; }
          .ak { font-size: 14px; }
          .dt { font-size: 12px; }
        }
        @media (min-width: 768px) {
          .stats-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 1024px) {
          .topbar { padding: 0 32px; }
          .content { padding: 40px 32px; }
          .pageTitle { font-size: 26px; }
          .pageSub { font-size: 14px; margin-bottom: 28px; }
          .tabs { margin-bottom: 28px; }
        }
      `}</style>

      <div style={S.layout}>
        <div style={S.topbar}>
          <div style={{display:'flex',alignItems:'center',gap:12,minWidth:0,flex:'1 1 0',flexWrap:'wrap',maxWidth:'100%'}}>
            <div style={{...S.logo,background:'none',boxShadow:'none'}}>
              <img src="/logo_ukm.jpg" alt="Logo UKM" style={{width:'100%',height:'100%',borderRadius:14,objectFit:'cover'}} />
            </div>
            <span style={{...S.title,whiteSpace:'nowrap'}}>Kas UKM</span>
            <span style={{...S.badge,whiteSpace:'nowrap'}}>BENDAHARA</span>
          </div>
          <button style={{...S.btnLogout,flexShrink:0,alignSelf:'flex-start',whiteSpace:'nowrap'}} onClick={async()=>{await supabase.auth.signOut();router.push('/login')}}>Keluar</button>
        </div>

        <div style={S.content}>
          <div style={S.pageTitle}>Kelola Keuangan</div>
          <div style={S.pageSub}>Pantau iuran dan kas keuangan UKM</div>

          <div style={S.tabs}>
            <button className={`tab-btn ${activeTab==='kas'?'on':''}`} onClick={()=>setActiveTab('kas')}>💳 Iuran Anggota</button>
            <button className={`tab-btn ${activeTab==='transaksi'?'on':''}`} onClick={()=>setActiveTab('transaksi')}>📊 Kas Umum</button>
          </div>

          {activeTab==='kas' && (
            <>
              <div className="stats-grid">
                <div className="sc sg"><div className="sl">Terkumpul Bulan Ini</div><div className="sv">{rp(totalTerkumpul)}</div></div>
                <div className="sc sgr"><div className="sl">Lunas Penuh</div><div className="sv">{totalLunas} <span style={{fontSize:14,fontWeight:400,color:'rgba(52,211,153,0.5)',fontFamily:'DM Sans'}}>anggota</span></div></div>
                <div className="sc sb"><div className="sl">Target Bulan Ini</div><div className="sv">{rp(members.length*TOTAL_P*IURAN)}</div></div>
              </div>

              <div className="ctrl">
                <span className="cl">Bulan:</span>
                <select className="cs" value={selMonth} onChange={e=>setSelMonth(Number(e.target.value))}>
                  {monthNames.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                </select>
                <select className="cs" value={selYear} onChange={e=>setSelYear(Number(e.target.value))}>
                  {yearOptions.map(y=><option key={y} value={y}>{y}</option>)}
                </select>
                <button className="binp" style={{whiteSpace:'nowrap'}} onClick={exportKasExcel}>Export Excel</button>
                <span className="ipill">Rp {IURAN.toLocaleString('id-ID')}/pertemuan · {TOTAL_P} pertemuan/bulan</span>
              </div>

              <div style={S.tableWrap}>
                <div className="tscroll">
                  {loading ? <div className="empty">Memuat...</div> : members.length===0 ? <div className="empty">Belum ada anggota</div> : (
                    <table>
                      <thead>
                        <tr>
                          <th className="tl" style={{width:44}}>No</th>
                          <th className="tl" style={{minWidth:170}}>Nama Anggota</th>
                          {[1,2,3,4,5,6,7,8].map(n=><th key={n} style={{minWidth:48}}>P{n}</th>)}
                          <th style={{minWidth:90}}>Progress</th>
                          <th style={{minWidth:110}}>Input</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m,i)=>{
                          const rec=getRec(m.id)
                          const paid=getPaid(rec)
                          const pct=(paid/8)*100
                          const pc=pct===100?'#22c55e':pct>=50?'#0ea5e9':'#f87171'
                          return (
                            <tr key={m.id}>
                              <td className="tl"><span className="nc">{i+1}</span></td>
                              <td className="tl"><div className="mn">{m.name}</div><div className="ms">{rp(paid*IURAN)} dibayar</div></td>
                              {[1,2,3,4,5,6,7,8].map(n=>{
                                const ip=rec?rec[`pertemuan_${n}` as keyof KasPayment] as boolean:false
                                return(
                                  <td key={n}>
                                    <button className={`chk ${ip?'con':'coff'}`} onClick={()=>toggleP(m.id,n,ip)} disabled={saving}>
                                      {ip?'✓':''}
                                    </button>
                                  </td>
                                )
                              })}
                              <td><div className="pw"><div className="pb"><div className="pf" style={{width:`${pct}%`,background:pc}}/></div><span className="pt">{paid}/8</span></div></td>
                              <td><button className="binp" onClick={()=>{setInputModal({userId:m.id,name:m.name});setInputAmount('')}}>+ Input Uang</button></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab==='transaksi' && (
            <>
              {(()=>{
                const tm=transactions.filter(t=>t.type==='masuk').reduce((s,t)=>s+t.amount,0)
                const tk=transactions.filter(t=>t.type==='keluar').reduce((s,t)=>s+t.amount,0)
                return(
                  <div className="stats-grid">
                    <div className="sc sgr"><div className="sl">Total Pemasukan</div><div className="sv">{rp(tm)}</div></div>
                    <div className="sc sr"><div className="sl">Total Pengeluaran</div><div className="sv">{rp(tk)}</div></div>
                    <div className="sc sg"><div className="sl">Saldo Kas</div><div className="sv">{rp(tm-tk)}</div></div>
                  </div>
                )
              })()}
              <div className="sh">
                <span style={{fontSize:15,fontWeight:600,color:'#0f172a'}}>Riwayat Transaksi</span>
                <button className="badd" onClick={()=>setShowForm(!showForm)}>+ Tambah</button>
              </div>
              {showForm&&(
                <div className="fcard">
                  <div className="fgrid">
                    <div><label className="flbl">Judul</label><input className="fi" type="text" placeholder="Contoh: Iuran Bulanan" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></div>
                    <div><label className="flbl">Nominal (Rp)</label><input className="fi" type="number" placeholder="10000" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></div>
                    <div><label className="flbl">Jenis</label><select className="fi" value={form.type} onChange={e=>setForm({...form,type:e.target.value as 'masuk'|'keluar'})}><option value="masuk">Pemasukan</option><option value="keluar">Pengeluaran</option></select></div>
                    <div><label className="flbl">Keterangan</label><input className="fi" type="text" placeholder="Opsional" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
                  </div>
                  <div className="fa">
                    <button className="bsv" onClick={handleTambahTx} disabled={submitting}>{submitting?'Menyimpan...':'Simpan'}</button>
                    <button className="bcn" onClick={()=>setShowForm(false)}>Batal</button>
                  </div>
                </div>
              )}
              <div style={S.tableWrap}>
                {transactions.length===0?<div className="empty">Belum ada transaksi</div>:(
                  <table>
                    <thead><tr><th className="tl">Transaksi</th><th>Jenis</th><th>Nominal</th><th>Tanggal</th></tr></thead>
                    <tbody>
                      {transactions.map(t=>(
                        <tr key={t.id}>
                          <td className="tl"><div className="txn">{t.title}</div>{t.description&&<div className="txd">{t.description}</div>}</td>
                          <td><span className={t.type==='masuk'?'bm':'bk'}>{t.type==='masuk'?'Pemasukan':'Pengeluaran'}</span></td>
                          <td><span className={t.type==='masuk'?'am':'ak'}>{t.type==='masuk'?'+':'-'}{rp(t.amount)}</span></td>
                          <td><span className="dt">{new Date(t.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {inputModal&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setInputModal(null)}>
          <div style={S.modal}>
            <div className="mtitle">Input Pembayaran</div>
            <div className="msub">Anggota: <strong style={{color:'#15803d'}}>{inputModal.name}</strong></div>
            <div className="minfo">
              💡 Masukkan total uang yang dibayarkan.<br/>
              Sistem otomatis mencentang pertemuan berurutan, dan <strong>melanjutkan ke bulan berikutnya</strong> jika melebihi 8 pertemuan.<br/>
              <strong>Rp {IURAN.toLocaleString('id-ID')} per pertemuan</strong>
            </div>
            <label className="mlbl">Nominal Dibayar (Rp)</label>
            <input className="minp" type="number" placeholder={`Min. Rp ${IURAN.toLocaleString('id-ID')}`} value={inputAmount} onChange={e=>setInputAmount(e.target.value)} autoFocus/>

            {preview&&preview.lines.length>0&&(
              <div className="pvbox">
                {preview.lines.map(l=>{
                  const [y,mo]=l.month.split('-')
                  return(
                    <div key={l.month} className="pvrow">
                      <span>{monthNames[parseInt(mo)-1]} {y}</span>
                      <span>+{l.count} pertemuan ({rp(l.count*IURAN)})</span>
                    </div>
                  )
                })}
                {preview.sisa>0&&<div className="pvsisa">⚠ Sisa Rp {preview.sisa.toLocaleString('id-ID')} diabaikan (kurang dari 1 pertemuan)</div>}
              </div>
            )}
            {inputAmount&&Number(inputAmount)>0&&Number(inputAmount)<IURAN&&(
              <div style={{marginTop:10,fontSize:12,color:'#f87171'}}>⚠ Nominal terlalu kecil (min. {rp(IURAN)})</div>
            )}

            <div className="macts">
              <button className="bcanm" onClick={()=>setInputModal(null)}>Batal</button>
              <button className="bconf" onClick={handleInputUang} disabled={saving||!inputAmount||Number(inputAmount)<IURAN}>
                {saving?'Menyimpan...':'Simpan Pembayaran'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}