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
      
        // Get current streak data
        const { data: profile } = await supabase
          .from('profiles')
          .select('streak_count, streak_last_date, streak_last_week')
          .eq('id', userId)
          .single()

        // Calculate streak
        const todayDate = new Date(today)
        const currentWeek = getISOWeekString(todayDate)
        let newStreakCount = 1
        let newStreakLastDate = today
        let newStreakLastWeek = currentWeek

        if (profile) {
          const lastDate = profile.streak_last_date ? new Date(profile.streak_last_date) : null
          const lastWeek = profile.streak_last_week
        
          if (lastDate) {
            const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
          
            if (diffDays === 0) {
              // Same day - shouldn't happen (already checked)
              newStreakCount = profile.streak_count || 0
            } else if (diffDays === 1) {
              // Consecutive day
              newStreakCount = (profile.streak_count || 0) + 1
            } else if (diffDays <= 7) {
              // Within same week (1-7 days gap)
              if (lastWeek === currentWeek) {
                // Same ISO week
                newStreakCount = (profile.streak_count || 0) + 1
              } else {
                // Different week but within 7 days - check if previous week
                const prevWeek = getPreviousISOWeekString(currentWeek)
                if (lastWeek === prevWeek) {
                  newStreakCount = (profile.streak_count || 0) + 1
                } else {
                  newStreakCount = 1 // Gap > 1 week
                }
              }
            } else {
              // Gap > 7 days
              const weeksDiff = getWeeksDiff(lastDate, todayDate)
              if (weeksDiff <= 1) {
                newStreakCount = (profile.streak_count || 0) + 1
              } else {
                newStreakCount = 1 // Streak dead - reset
              }
            }
          }
        }

        // Update profile with new streak
        await supabase
          .from('profiles')
          .update({
            streak_count: newStreakCount,
            streak_last_date: newStreakLastDate,
            streak_last_week: newStreakLastWeek
          })
          .eq('id', userId)

        const { error: insertError } = await supabase
          .from('attendance')
          .insert([{ user_id: userId, date: today, status: 'hadir', photo_url: publicUrlData.publicUrl }])

        if (insertError) {
            console.error("Detail Error Supabase:", insertError)
            alert('Gagal mencatat kehadiran: ' + insertError.message)
        } else {
            alert(`Berhasil absen! 🔥 Streak: ${newStreakCount}`)
            router.push(dashboardUrl)
        }
        setLoading(false)
      }, 'image/jpeg')
    }

  // Helper functions for ISO Week
  function getISOWeekString(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
  }

  function getPreviousISOWeekString(currentWeek: string): string {
    const [year, week] = currentWeek.split('-W').map(Number)
    let prevYear = year
    let prevWeek = week - 1
    if (prevWeek === 0) {
      prevYear = year - 1
      // Get last week of previous year
      const dec31 = new Date(Date.UTC(prevYear, 11, 31))
      const dayNum = dec31.getUTCDay() || 7
      dec31.setUTCDate(dec31.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(prevYear, 0, 1))
      prevWeek = Math.ceil((((dec31.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
    }
    return `${prevYear}-W${String(prevWeek).padStart(2, '0')}`
  }

  function getWeeksDiff(date1: Date, date2: Date): number {
      const week1 = getISOWeekString(date1)
      const week2 = getISOWeekString(date2)
      const [y1, w1] = week1.split('-W').map(Number)
      const [y2, w2] = week2.split('-W').map(Number)
      return (y2 - y1) * 52 + (w2 - w1)
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
        <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: '12px', marginBottom: '16px', backgroundColor: '#000', transform: 'scaleX(-1)' }} />
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