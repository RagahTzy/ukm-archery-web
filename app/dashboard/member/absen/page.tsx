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
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    let currentStream: MediaStream | null = null;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)

      // Check if already absen today
      const { data: absen } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
      if (absen && absen.length > 0) {
        alert('Anda sudah absen hari ini')
        router.push('/dashboard/member')
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
      } catch (error) {
        alert('Tidak dapat mengakses kamera: ' + error)
      }
    }
    init()

    // Cleanup saat komponen dibongkar (unmount)
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
      
      // 1. Tambahkan timestamp agar nama file SELALU UNIK
      const timestamp = new Date().getTime()
      const fileName = `${userId}_${today}_${timestamp}.jpg`
      
      // 2. Hapus opsi upsert: true
      const { data, error } = await supabase.storage
        .from('attendance-photos')
        .upload(fileName, blob, { contentType: 'image/jpeg' })

      if (error) {
        alert('Gagal upload foto: ' + error.message)
        setLoading(false)
        return
      }

      const photoUrl = supabase.storage.from('attendance-photos').getPublicUrl(fileName).data.publicUrl

      const { error: insertError } = await supabase
        .from('attendance')
        .insert([{ user_id: userId, date: today, status: 'hadir', photo_url: photoUrl }])

      if (insertError) {
        alert('Gagal absen: ' + insertError.message)
      } else {
        // --- LOGIKA MEMATIKAN KAMERA ---
        if (stream) {
          stream.getTracks().forEach(track => track.stop())
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null
        }
        // -------------------------------

        alert('Absen berhasil!')
        router.push('/dashboard/member')
      }
      setLoading(false)
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#ecfeff 0%,#f8fafc 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ background: '#ffffff', border: '2px solid rgba(15,23,82,0.35)', borderRadius: '24px', padding: '32px', boxShadow: '0 24px 60px rgba(30,58,138,0.08)', maxWidth: '500px', width: '100%', textAlign: 'center' }}>
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
            fontSize: '14px',
            fontWeight: '700',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: "'DM Sans',sans-serif",
            transition: 'all 0.2s',
            opacity: loading ? 0.5 : 1
          }}
        >
          {loading ? 'Mengupload...' : 'Ambil Foto & Absen'}
        </button>
      </div>
    </div>
  )
}