'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

function SeasonStats({ gradeId }: { gradeId: string }) {
  const [data, setData]       = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied]   = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/stats?type=season&gradeId=${gradeId}`)
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [gradeId])

  function copyTable() {
    const lines = [['Player', 'Team', 'Games Played', 'Total Goals', 'Best Player'].join('\t')]
    data.forEach(r => lines.push([r.player, r.team, r.games, r.goals, r.bp].join('\t')))
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <p style={{ color: 'rgba(255,255,255,0.4)', padding: '1rem' }}>Loading...</p>

  if (!data.length) return (
    <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📊</div>
      <p style={{ color: 'rgba(255,255,255,0.4)' }}>No stats yet. Click Sync All Leagues in the sidebar.</p>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
        <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>
          {'Season totals · Top ' + data.length + ' players · Sourced from PlayHQ'}
        </p>
        <button onClick={copyTable} className="btn-ghost" style={{ fontSize: '0.78rem' }}>
          {copied ? 'Copied!' : 'Copy Table'}
        </button>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="stats-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Player</th>
              <th>Team</th>
              <th title="Games Played">GP</th>
              <th title="Total Goals">Goals</th>
              <th title="Best Player Awards">BP</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i}>
                <td>
                  <span className={`rank-num ${i === 0 ? 'gold' : i === 1 ? 'silver' : ''}`}>{i + 1}</span>
                </td>
                <td style={{ fontWeight: i < 3 ? 700 : 400 }}>{r.player}</td>
                <td style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem' }}>{r.team}</td>
                <td>{r.games}</td>
                <td style={{ fontWeight: 700, color: i === 0 ? '#e6fe00' : i < 3 ? '#fff' : 'rgba(255,255,255,0.85)' }}>{r.goals}</td>
                <td style={{ color: r.bp > 0 ? '#2ca3ee' : 'rgba(255,255,255,0.25)', fontWeight: r.bp > 0 ? 700 : 400 }}>
                  {r.bp > 0 ? r.bp : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '0.625rem 1rem', borderTop: '1px solid rgba(44,163,238,0.08)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', display: 'flex', justifyContent: 'space-between' }}>
          <span>GP = Games Played · BP = Best Player Awards</span>
          <span>Copy Table to paste into Excel or Google Sheets</span>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [leagues, setLeagues]           = useState<any[]>([])
  const [activeLeague, setActiveLeague] = useState<string | null>(null)

  const loadLeagues = useCallback(async () => {
    const data = await fetch('/api/stats?type=leagues').then(r => r.json())
    const list = Array.isArray(data) ? data : []
    setLeagues(list)
    if (list.length > 0 && !activeLeague) setActiveLeague(list[0].grade_id)
  }, [activeLeague])

  useEffect(() => { loadLeagues() }, [])

  useEffect(() => {
    window.addEventListener('stats:synced', loadLeagues)
    return () => window.removeEventListener('stats:synced', loadLeagues)
  }, [loadLeagues])

  return (
    <div className="fade-up" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '2.25rem', color: '#2ca3ee', margin: 0 }}>
          Player Statistics
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
          {'Welcome back, '}
          <strong style={{ color: '#fff' }}>{session?.user?.name}</strong>
          {' · Season totals synced daily from PlayHQ'}
        </p>
      </div>

      {leagues.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🏈</div>
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>No leagues configured yet.</p>
        </div>
      ) : (
        <>
          <div className="tab-bar">
            {leagues.map(lg => (
              <button
                key={lg.grade_id}
                className={`tab-btn ${activeLeague === lg.grade_id ? 'active' : ''}`}
                onClick={() => setActiveLeague(lg.grade_id)}
              >
                {lg.grade_name}
              </button>
            ))}
          </div>
          {activeLeague && <SeasonStats gradeId={activeLeague} />}
        </>
      )}
    </div>
  )
}