'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function AbsenPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [dashboardUrl, setDashboardUrl] = useState<string>('/dashboard/member')
  
  // STATE BARU: Mencegah UI muncul sebelum pengecekan selesai
  const [isChecking, setIsChecking] = useState(true) 
  
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    let currentStream: MediaStream | null = null;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        // PERHATIAN: Pastikan path ini sesuai dengan letak URL halaman absenmu!
        // Misalnya jika link-nya namaukm.com/dashboard/absen, maka tulis ?next=/dashboard/absen
        router.push('/login?next=/dashboard/absen')
        return // Kita biarkan isChecking tetap true agar UI absen tidak muncul saat proses dilempar
      }
      
      setUserId(user.id)

      // Cek role untuk menentukan URL kembali
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const role = profile?.role || 'member'
      const targetDashboard = `/dashboard/${role}`
      setDashboardUrl(targetDashboard)

      // Check if already absen today
      const { data: absen } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        
      if (absen && absen.length > 0) {
        alert('Anda sudah absen hari ini')
        router.push(targetDashboard)
        return
      }

      // Access camera
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true })
        currentStream = mediaStream;
        setStream(mediaStream)
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
        
        // JIKA SEMUA AMAN (SUDAH LOGIN & BLM ABSEN), BARU MUNCULKAN UI ABSENNYA
        setIsChecking(false)
        
      } catch (error) {
        alert('Tidak dapat mengakses kamera: ' + error)
        setIsChecking(false)
      }
    }
    init()

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [router, today])

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !userId) return
    const canvas = canvasRef.current
    const video = videoRef.current
    const context = canvas.getContext('2d')
    if (!context) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0)
    canvas.toBlob(async (blob) => {
      if (!blob) return
      setLoading(true)
      const timestamp = new Date().getTime()
      const fileName = `${userId}_${today}_${timestamp}.jpg`
      const { data, error } = await supabase.storage
        .from('attendance-photos')
        .upload(fileName, blob, { contentType: 'image/jpeg' })

      if (error) {
          alert('Gagal upload foto')
          setLoading(false)
          return
      }

      const { data: publicUrlData } = supabase.storage.from('attendance-photos').getPublicUrl(fileName)
      
      const { error: insertError } = await supabase
        .from('attendance')
        .insert([{ user_id: userId, date: today, status: 'hadir', photo_url: publicUrlData.publicUrl }])

      if (insertError) {
          console.error("Detail Error Supabase:", insertError)
          alert('Gagal mencatat kehadiran: ' + insertError.message)
      } else {
          alert('Berhasil absen!')
          router.push(dashboardUrl)
      }
      setLoading(false)
    }, 'image/jpeg')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans',sans-serif", background: '#f8fbff' }}>
      
      {/* TAMPILAN SEMENTARA SELAMA PENGECEKAN */}
      {isChecking && (
        <h2 style={{ fontFamily: "'Playfair Display',serif", color: '#0f172a' }}>
          Memeriksa sesi akses...
        </h2>
      )}

      {/* TAMPILAN ABSEN ASLI (DISEMBUNYIKAN JIKA BELUM SELESAI CEK) */}
      <div style={{ 
          display: isChecking ? 'none' : 'block', // Menyembunyikan div ini via CSS
          background: '#ffffff', border: '2px solid rgba(15,23,82,0.35)', borderRadius: '24px', padding: '32px', boxShadow: '0 24px 60px rgba(30,58,138,0.08)', maxWidth: '500px', width: '100%', textAlign: 'center' 
      }}>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: '24px', color: '#0f172a', fontWeight: '700', marginBottom: '16px' }}>Absen Kehadiran</h1>
        <p style={{ color: '#475569', fontSize: '14px', marginBottom: '24px' }}>Ambil foto sebagai bukti kehadiran</p>
        <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: '12px', marginBottom: '16px', backgroundColor: '#000' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <button
          onClick={capturePhoto}
          disabled={loading}
          style={{
            background: 'linear-gradient(135deg,#06b6d4 0%,#22c55e 50%,#f59e0b 100%)',
            color: '#ffffff',
            padding: '14px 30px',
            borderRadius: '16px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'bold',
            width: '100%'
          }}
        >
          {loading ? 'Memproses...' : 'Ambil Foto & Absen'}
        </button>
      </div>
    </div>
  )
}