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
  session_distance: number
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
  showDistanceFilter?: boolean
}

export default function Leaderboard({ sessionId, limit = 10, title = 'Leaderboard Scoring', showSessionName = true, showDistanceFilter = false }: LeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDistance, setSelectedDistance] = useState<number | 'all'>('all')

  const fetchLeaderboard = useCallback(async () => {
      setLoading(true)
      setError('')
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const params = new URLSearchParams()
        if (sessionId) params.set('session_id', sessionId)
        if (selectedDistance !== 'all') params.set('distance', selectedDistance.toString())
        params.set('limit', limit.toString())

        const res = await fetch(`/api/scoring/leaderboard?${params}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        })

        if (res.status === 401 || res.status === 403) {
          setLeaderboard([])
          return
        }

        const json = await res.json()
        if (json.error) {
          if (!json.error.includes('approved')) {
            setError(json.error)
          }
          return
        }
        setLeaderboard(json.leaderboard || [])
      } catch (err) {
        console.error('Error fetching leaderboard:', err)
      } finally {
        setLoading(false)
      }
    }, [sessionId, limit, selectedDistance])

  useEffect(() => { fetchLeaderboard() }, [fetchLeaderboard])

  const getMedal = (rank: number) => {
    if (rank === 1) return { emoji: '🥇', color: '#f59e0b', bg: '#fef3c7' }
    if (rank === 2) return { emoji: '🥈', color: '#94a3b8', bg: '#f1f5f9' }
    if (rank === 3) return { emoji: '🥉', color: '#b45309', bg: '#fef9c3' }
    return { emoji: `#${rank}`, color: '#64748b', bg: '#f1f5f9' }
  }

  if (loading) {
    return (
      <div className="leaderboard-container">
        <div className="leaderboard-loading">Memuat leaderboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="leaderboard-container">
        <div className="leaderboard-error">⚠️ {error}</div>
      </div>
    )
  }

  if (leaderboard.length === 0) {
    return (
      <div className="leaderboard-container">
        <div className="leaderboard-empty">Belum ada data leaderboard. Leaderboard muncul setelah session selesai.</div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

        /* CSS Custom Properties for responsive values */
        :root {
          --lb-container-radius: 16px;
          --lb-header-padding: 16px 20px;
          --lb-title-size: 20px;
          --lb-row-padding: 12px 16px;
          --lb-row-gap: 12px;
          --lb-rank-size: 44px;
          --lb-rank-font: 15px;
          --lb-name-font: 14px;
          --lb-meta-font: 11px;
          --lb-meta-gap: 10px;
          --lb-score-font: 18px;
          --lb-score-min-width: 80px;
          --lb-card-shadow: 0 12px 32px rgba(30,58,138,0.06);
        }

        /* Tablet: 640px - 1024px */
        @media (min-width: 640px) {
          :root {
            --lb-container-radius: 20px;
            --lb-header-padding: 20px 24px;
            --lb-title-size: 22px;
            --lb-row-padding: 14px 20px;
            --lb-row-gap: 14px;
            --lb-rank-size: 48px;
            --lb-rank-font: 16px;
            --lb-name-font: 15px;
            --lb-meta-font: 12px;
            --lb-meta-gap: 12px;
            --lb-score-font: 19px;
            --lb-score-min-width: 90px;
            --lb-card-shadow: 0 16px 40px rgba(30,58,138,0.07);
          }
        }

        /* Desktop: 1024px+ */
        @media (min-width: 1024px) {
          :root {
            --lb-container-radius: 20px;
            --lb-header-padding: 20px 24px;
            --lb-title-size: 22px;
            --lb-row-padding: 16px 24px;
            --lb-row-gap: 16px;
            --lb-rank-size: 50px;
            --lb-rank-font: 16px;
            --lb-name-font: 15px;
            --lb-meta-font: 12px;
            --lb-meta-gap: 16px;
            --lb-score-font: 20px;
            --lb-score-min-width: 100px;
            --lb-card-shadow: 0 18px 50px rgba(30,58,138,0.08);
          }
        }

        .leaderboard-container {
          background: #ffffff;
          border: 2px solid rgba(15,23,82,0.35);
          border-radius: var(--lb-container-radius);
          overflow: hidden;
          box-shadow: var(--lb-card-shadow);
          font-family: 'DM Sans', sans-serif;
        }

        .leaderboard-header {
          background: linear-gradient(135deg, #ecfeff 0%, #d9f99d 30%, #fef3c7 100%);
          padding: var(--lb-header-padding);
          border-bottom: 2px solid rgba(15,23,82,0.35);
        }

        .leaderboard-header-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .leaderboard-title {
          font-family: 'Playfair Display', serif;
          font-size: var(--lb-title-size);
          font-weight: 700;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .distance-filter {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .distance-filter-label {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
        }

        .distance-filter-select {
          background: #ffffff;
          border: 2px solid rgba(15,23,82,0.35);
          border-radius: 8px;
          padding: 6px 12px;
          color: #0f172a;
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          cursor: pointer;
        }

        .leaderboard-loading,
        .leaderboard-error,
        .leaderboard-empty {
          padding: 32px 20px;
          text-align: center;
          color: #64748b;
        }

        .leaderboard-error { color: #f87171; }

        .leaderboard-list { }

        .leaderboard-row {
          display: flex;
          align-items: center;
          gap: var(--lb-row-gap);
          padding: var(--lb-row-padding);
          border-bottom: 1px solid rgba(15,23,82,0.1);
          transition: background 0.15s;
        }

        .leaderboard-row:hover { background: #f8fbff; }
        .leaderboard-row:last-child { border-bottom: none; }

        .leaderboard-rank {
          width: var(--lb-rank-size);
          height: var(--lb-rank-size);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: var(--lb-rank-font);
          color: #fff;
          flex-shrink: 0;
        }

        .leaderboard-info {
          flex: 1;
          min-width: 0;
        }

        .leaderboard-name {
          font-weight: 700;
          font-size: var(--lb-name-font);
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .leaderboard-meta {
          display: flex;
          gap: var(--lb-meta-gap);
          margin-top: 4px;
          font-size: var(--lb-meta-font);
          color: #64748b;
          flex-wrap: wrap;
        }

        .leaderboard-score {
          font-family: 'Playfair Display', serif;
          font-size: var(--lb-score-font);
          font-weight: 700;
          color: #0f172a;
          text-align: right;
          min-width: var(--lb-score-min-width);
          flex-shrink: 0;
        }

        @media (max-width: 480px) {
          .leaderboard-meta { gap: 6px; }
          .leaderboard-meta span { font-size: 10px; }
          .distance-filter { width: 100%; }
          .distance-filter-select { width: 100%; }
        }
      `}</style>

      <div className="leaderboard-container">
        <div className="leaderboard-header">
          <div className="leaderboard-header-content">
            <div className="leaderboard-title">
              🏆 {title}
            </div>
            {showDistanceFilter && (
              <div className="distance-filter">
                <span className="distance-filter-label">Filter Jarak:</span>
                <select
                  className="distance-filter-select"
                  value={selectedDistance}
                  onChange={(e) => setSelectedDistance(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                >
                  <option value="all">Semua Jarak</option>
                  <option value="10">10m</option>
                  <option value="15">15m</option>
                  <option value="20">20m</option>
                  <option value="25">25m</option>
                  <option value="30">30m</option>
                  <option value="35">35m</option>
                  <option value="40">40m</option>
                  <option value="45">45m</option>
                  <option value="50">50m</option>
                  <option value="55">55m</option>
                  <option value="60">60m</option>
                  <option value="65">65m</option>
                  <option value="70">70m</option>
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="leaderboard-list">
          {leaderboard.map((entry) => {
            const medal = getMedal(entry.rank)
            return (
              <div key={entry.participant_id} className="leaderboard-row">
                <div className="leaderboard-rank" style={{
                  background: medal.bg,
                  color: medal.color,
                  boxShadow: entry.rank <= 3 ? `0 4px 12px ${medal.color}40` : 'none'
                }}>
                  {medal.emoji}
                </div>
                <div className="leaderboard-info">
                  <div className="leaderboard-name">{entry.name}</div>
                  <div className="leaderboard-meta">
                    {showSessionName && <span>📋 {entry.session_name}</span>}
                    <span>🏹 {entry.arrows_entered} Arrow</span>
                    <span>🎯 {entry.session_distance}m</span>
                    <span>⭐ Avg: {entry.avg_score}</span>
                  </div>
                </div>
                <div className="leaderboard-score">
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