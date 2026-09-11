'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'

type LeaderboardEntry = {
  participant_id: string
  name: string
  user_id: string
  session_id: string
  session_name: string
  session_code: string
  total_score: number
  arrows_entered: number
  total_arrows: number
  progress_percent: number
  avg_score: number
  joined_at: string
  rank: number
}

type LeaderboardProps = {
  sessionId?: string
  limit?: number
  title?: string
  showSessionName?: boolean
}

export default function Leaderboard({ sessionId, limit = 10, title = 'Leaderboard Scoring', showSessionName = true }: LeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchLeaderboard = useCallback(async () => {
      setLoading(true)
      setError('')
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
      
        const params = new URLSearchParams()
        if (sessionId) params.set('session_id', sessionId)
        params.set('limit', limit.toString())
      
        const res = await fetch(`/api/scoring/leaderboard?${params}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        })
      
        // Handle auth errors silently - they can happen during token refresh
        if (res.status === 401 || res.status === 403) {
          setLeaderboard([])
          return
        }
      
        const json = await res.json()
        if (json.error) { 
          // Don't show error for empty leaderboard, just empty state
          if (!json.error.includes('approved')) {
            setError(json.error)
          }
          return 
        }
        setLeaderboard(json.leaderboard || [])
      } catch (err) {
        console.error('Error fetching leaderboard:', err)
        // Don't show error for network issues, just empty state
      } finally {
        setLoading(false)
      }
    }, [sessionId, limit])

  useEffect(() => { fetchLeaderboard() }, [fetchLeaderboard])

  const getMedal = (rank: number) => {
    if (rank === 1) return { emoji: '🥇', color: '#f59e0b', bg: '#fef3c7' }
    if (rank === 2) return { emoji: '🥈', color: '#94a3b8', bg: '#f1f5f9' }
    if (rank === 3) return { emoji: '🥉', color: '#b45309', bg: '#fef9c3' }
    return { emoji: `#${rank}`, color: '#64748b', bg: '#f1f5f9' }
  }

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return '#22c55e'
    if (percent >= 75) return '#0ea5e9'
    if (percent >= 50) return '#f59e0b'
    return '#f87171'
  }

  const S = {
    container: { background: '#ffffff', border: '2px solid rgba(15,23,82,0.35)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 18px 50px rgba(30,58,138,0.08)' },
    header: { background: 'linear-gradient(135deg,#ecfeff 0%,#d9f99d 30%,#fef3c7 100%)', padding: '20px 24px', borderBottom: '2px solid rgba(15,23,82,0.35)' },
    title: { fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 },
    empty: { textAlign: 'center' as const, padding: 40, color: '#64748b' },
    row: { display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', borderBottom: '1px solid rgba(15,23,82,0.1)', transition: 'background 0.15s' },
    rank: { width: 50, height: 50, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: '#fff', flexShrink: 0 },
    info: { flex: 1, minWidth: 0 },
    name: { fontWeight: 700, fontSize: 15, color: '#0f172a', whiteSpace: 'nowrap' as const, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const },
    meta: { display: 'flex', gap: 16, marginTop: 4, fontSize: 12, color: '#64748b', flexWrap: 'wrap' as const },
    score: { fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: '#0f172a', textAlign: 'right' as const, minWidth: 100 },
    progressBar: { height: 6, background: '#e2e8f0', borderRadius: 3, marginTop: 8 },
    progressFill: { height: '100%', borderRadius: 3, transition: 'width 0.3s' }
  }

  if (loading) {
    return (
      <div style={S.container}>
        <div style={{padding: 40, textAlign: 'center', color: '#64748b'}}>Memuat leaderboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={S.container}>
        <div style={{padding: 40, textAlign: 'center', color: '#f87171'}}>⚠️ {error}</div>
      </div>
    )
  }

  if (leaderboard.length === 0) {
    return (
      <div style={S.container}>
        <div style={S.empty}>Belum ada data leaderboard. Leaderboard muncul setelah session selesai.</div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        .leaderboard-row:hover { background: #f8fbff; }
      `}</style>
      <div style={S.container}>
        <div style={S.header}>
          <div style={S.title}>
            🏆 {title}
          </div>
        </div>
        <div>
          {leaderboard.map((entry) => {
            const medal = getMedal(entry.rank)
            const isCurrentUser = typeof window !== 'undefined' // We'll check this in parent
            return (
              <div key={entry.participant_id} className="leaderboard-row" style={S.row}>
                <div style={{
                  ...S.rank,
                  background: medal.bg,
                  color: medal.color,
                  boxShadow: entry.rank <= 3 ? `0 4px 12px ${medal.color}40` : 'none'
                }}>
                  {medal.emoji}
                </div>
                <div style={S.info}>
                  <div style={S.name}>{entry.name}</div>
                  <div style={S.meta}>
                    {showSessionName && <span>📋 {entry.session_name}</span>}
                    <span>🏹 {entry.arrows_entered}/{entry.total_arrows} Arrow</span>
                    <span>📊 {entry.progress_percent}%</span>
                    <span>⭐ Avg: {entry.avg_score}</span>
                  </div>
                  <div style={{
                    ...S.progressBar,
                    width: 200
                  }}>
                    <div style={{
                      ...S.progressFill,
                      width: `${entry.progress_percent}%`,
                      background: getProgressColor(entry.progress_percent)
                    }} />
                  </div>
                </div>
                <div style={S.score}>
                  {entry.total_score}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}