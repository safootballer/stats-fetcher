'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

// ─── Simple stats table ───────────────────────────────────────────
function StatsTable({ rows, showAvg = false }: { rows: any[]; showAvg?: boolean }) {
  function copyTable() {
    const headers = showAvg ? ['Player', 'Team', 'Games', 'Goals', 'Avg Goals'] : ['Player', 'Team', 'Games', 'Goals']
    const lines = [headers.join('\t')]
    rows.forEach((r, i) => {
      const cols = [r.player, r.team, r.games, r.goals]
      if (showAvg) cols.push(r.avgGoals ?? '')
      lines.push(cols.join('\t'))
    })
    navigator.clipboard.writeText(lines.join('\n'))
  }

  if (!rows.length) return <p style={{ color: 'rgba(255,255,255,0.4)', padding: '1.5rem', textAlign: 'center' }}>No data yet. Sync leagues from the sidebar.</p>

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.625rem' }}>
        <button onClick={copyTable} className="btn-ghost" style={{ fontSize: '0.78rem' }}>
          📋 Copy Table → Excel/Sheets
        </button>
      </div>
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="stats-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Player</th>
              <th>Team</th>
              <th>Games</th>
              <th>Goals</th>
              {showAvg && <th>Avg Goals</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <span className={`rank-num ${i === 0 ? 'gold' : i === 1 ? 'silver' : ''}`}>{i + 1}</span>
                </td>
                <td style={{ fontWeight: i < 3 ? 600 : 400 }}>{r.player}</td>
                <td style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem' }}>{r.team}</td>
                <td>{r.games}</td>
                <td style={{ fontWeight: 700, color: i === 0 ? '#e6fe00' : '#fff' }}>{r.goals}</td>
                {showAvg && <td style={{ color: 'rgba(255,255,255,0.6)' }}>{r.avgGoals}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─── Season Stats ─────────────────────────────────────────────────
function SeasonStats({ gradeId }: { gradeId: string }) {
  const [data, setData]         = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [team, setTeam]         = useState('All')
  const [sortBy, setSortBy]     = useState<'goals' | 'games'>('goals')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/stats?type=season&gradeId=${gradeId}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [gradeId])

  const teams = ['All', ...Array.from(new Set(data.map(r => r.team))).sort()]
  const filtered = data
    .filter(r => team === 'All' || r.team === team)
    .sort((a, b) => sortBy === 'goals' ? b.goals - a.goals : b.games - a.games)

  const topScorer = data[0]
  const totalPlayers = data.length
  const totalTeams   = new Set(data.map(r => r.team)).size

  if (loading) return <p style={{ color: 'rgba(255,255,255,0.4)' }}>Loading...</p>

  return (
    <div>
      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="metric-card">
          <div className="metric-value">{totalPlayers}</div>
          <div className="metric-label">Players</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{totalTeams}</div>
          <div className="metric-label">Teams</div>
        </div>
        <div className="metric-card">
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e6fe00', lineHeight: 1.2, marginTop: 2 }}>
            {topScorer ? `${topScorer.player} (${topScorer.goals}G)` : '—'}
          </div>
          <div className="metric-label">Top Scorer</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select value={team} onChange={e => setTeam(e.target.value)} className="input-field" style={{ maxWidth: 220 }}>
          {teams.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="input-field" style={{ maxWidth: 160 }}>
          <option value="goals">Sort: Goals</option>
          <option value="games">Sort: Games</option>
        </select>
      </div>

      <StatsTable rows={filtered} />
      <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.625rem' }}>GP = Games Played · G = Goals</p>
    </div>
  )
}

// ─── Round Stats ──────────────────────────────────────────────────
function RoundStats({ gradeId }: { gradeId: string }) {
  const [rounds, setRounds]       = useState<any[]>([])
  const [selectedRound, setSelectedRound] = useState<number | null>(null)
  const [roundData, setRoundData] = useState<any>(null)
  const [loading, setLoading]     = useState(false)
  const [expanded, setExpanded]   = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/stats?type=rounds&gradeId=${gradeId}`)
      .then(r => r.json())
      .then(data => {
        setRounds(data)
        if (data.length > 0) setSelectedRound(data[data.length - 1].round_number)
      })
  }, [gradeId])

  useEffect(() => {
    if (!selectedRound) return
    setLoading(true)
    fetch(`/api/stats?type=round&gradeId=${gradeId}&round=${selectedRound}`)
      .then(r => r.json()).then(setRoundData).finally(() => setLoading(false))
  }, [gradeId, selectedRound])

  function copyTeam(teamName: string, rows: any[]) {
    const lines = [['Player', 'Team', 'Goals'].join('\t')]
    rows.forEach(r => lines.push([r.player, r.team, r.goals].join('\t')))
    navigator.clipboard.writeText(lines.join('\n'))
  }

  function copyAll() {
    if (!roundData?.teams) return
    const lines = [['Player', 'Team', 'Goals'].join('\t')]
    Object.values(roundData.teams as Record<string, any[]>).flat()
      .forEach((r: any) => lines.push([r.player, r.team, r.goals].join('\t')))
    navigator.clipboard.writeText(lines.join('\n'))
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={selectedRound ?? ''}
          onChange={e => setSelectedRound(parseInt(e.target.value))}
          className="input-field" style={{ maxWidth: 200 }}
        >
          {rounds.map(r => <option key={r.round_number} value={r.round_number}>{r.round_name}</option>)}
        </select>
        {roundData && (
          <button onClick={copyAll} className="btn-ghost" style={{ fontSize: '0.78rem' }}>
            📋 Copy Full Round
          </button>
        )}
      </div>

      {loading && <p style={{ color: 'rgba(255,255,255,0.4)' }}>Loading...</p>}

      {!loading && roundData && Object.entries(roundData.teams as Record<string, any[]>).map(([teamName, rows]) => {
        const totalGoals = rows.reduce((s, r) => s + (r.goals ?? 0), 0)
        const isOpen = expanded === teamName
        return (
          <div key={teamName} className="glass-card" style={{ overflow: 'hidden', marginBottom: '0.5rem' }}>
            <div
              onClick={() => setExpanded(isOpen ? null : teamName)}
              style={{ padding: '0.875rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isOpen ? 'rgba(44,163,238,0.06)' : 'transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '1rem' }}>{teamName}</span>
                <span style={{ fontSize: '0.78rem', color: '#e6fe00', fontWeight: 700 }}>{totalGoals} goals</span>
              </div>
              <span style={{ color: '#2ca3ee', fontSize: '0.72rem', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
            </div>
            {isOpen && (
              <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid rgba(44,163,238,0.15)' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.625rem' }}>
                  <button onClick={() => copyTeam(teamName, rows)} className="btn-ghost" style={{ fontSize: '0.75rem' }}>
                    📋 Copy {teamName}
                  </button>
                </div>
                <table className="stats-table">
                  <thead>
                    <tr><th>#</th><th>Player</th><th>Team</th><th>Goals</th></tr>
                  </thead>
                  <tbody>
                    {rows.sort((a, b) => b.goals - a.goals).map((r, i) => (
                      <tr key={i}>
                        <td><span className={`rank-num ${i === 0 && r.goals > 0 ? 'gold' : ''}`}>{i + 1}</span></td>
                        <td>{r.player}</td>
                        <td style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>{r.team}</td>
                        <td style={{ fontWeight: 700, color: r.goals > 0 ? '#e6fe00' : 'rgba(255,255,255,0.4)' }}>{r.goals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}

      {!loading && roundData && Object.keys(roundData.teams ?? {}).length === 0 && (
        <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '1.5rem' }}>No stats for this round.</p>
      )}
    </div>
  )
}

// ─── Leaderboard ──────────────────────────────────────────────────
function Leaderboard({ gradeId }: { gradeId: string }) {
  const [data, setData]     = useState<any>(null)
  const [tab, setTab]       = useState<'goals' | 'bp'>('goals')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/stats?type=leaderboard&gradeId=${gradeId}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [gradeId])

  if (loading) return <p style={{ color: 'rgba(255,255,255,0.4)' }}>Loading...</p>

  return (
    <div>
      <div className="sub-tab-bar">
        <button className={`sub-tab-btn ${tab === 'goals' ? 'active' : ''}`} onClick={() => setTab('goals')}>
          Top Goal Kickers
        </button>
        <button className={`sub-tab-btn ${tab === 'bp' ? 'active' : ''}`} onClick={() => setTab('bp')}>
          Top Best Players
        </button>
      </div>

      {tab === 'goals' && (
        <StatsTable rows={data?.topGoals ?? []} showAvg />
      )}

      {tab === 'bp' && (
        <>
          {data?.topBP?.length > 0 ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.625rem' }}>
                <button onClick={() => {
                  const lines = [['Player', 'Team', 'Games', 'Goals', 'BP'].join('\t')]
                  data.topBP.forEach((r: any) => lines.push([r.player, r.team, r.games, r.goals, r.bp].join('\t')))
                  navigator.clipboard.writeText(lines.join('\n'))
                }} className="btn-ghost" style={{ fontSize: '0.78rem' }}>
                  📋 Copy Table
                </button>
              </div>
              <div className="glass-card" style={{ overflow: 'hidden' }}>
                <table className="stats-table">
                  <thead>
                    <tr><th>#</th><th>Player</th><th>Team</th><th>Games</th><th>Goals</th><th>BP Awards</th></tr>
                  </thead>
                  <tbody>
                    {data.topBP.map((r: any, i: number) => (
                      <tr key={i}>
                        <td><span className={`rank-num ${i === 0 ? 'gold' : i === 1 ? 'silver' : ''}`}>{i + 1}</span></td>
                        <td style={{ fontWeight: i < 3 ? 600 : 400 }}>{r.player}</td>
                        <td style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem' }}>{r.team}</td>
                        <td>{r.games}</td>
                        <td>{r.goals}</td>
                        <td style={{ fontWeight: 700, color: i === 0 ? '#e6fe00' : '#fff' }}>{r.bp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p style={{ color: 'rgba(255,255,255,0.4)', padding: '1.5rem', textAlign: 'center' }}>No best player data yet.</p>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────
export default function DashboardPage() {
  const { data: session } = useSession()
  const [leagues, setLeagues]     = useState<any[]>([])
  const [activeLeague, setActiveLeague] = useState<string | null>(null)
  const [activeView, setActiveView]     = useState<'season' | 'round' | 'leaderboard'>('season')

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
          Welcome back, <strong style={{ color: '#fff' }}>{session?.user?.name}</strong>
        </p>
      </div>

      {leagues.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🏈</div>
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>No leagues configured yet. Add them in the Leagues app first.</p>
        </div>
      ) : (
        <>
          {/* League tabs */}
          <div className="tab-bar">
            {leagues.map(lg => (
              <button key={lg.grade_id} className={`tab-btn ${activeLeague === lg.grade_id ? 'active' : ''}`}
                onClick={() => { setActiveLeague(lg.grade_id); setActiveView('season') }}>
                {lg.grade_name}
              </button>
            ))}
          </div>

          {/* Sub-tabs */}
          <div className="sub-tab-bar">
            {(['season', 'round', 'leaderboard'] as const).map(v => (
              <button key={v} className={`sub-tab-btn ${activeView === v ? 'active' : ''}`} onClick={() => setActiveView(v)}>
                {v === 'season' ? 'Season Stats' : v === 'round' ? 'Round Stats' : 'Leaderboard'}
              </button>
            ))}
          </div>

          {/* Content */}
          {activeLeague && (
            <>
              {activeView === 'season'      && <SeasonStats    gradeId={activeLeague} />}
              {activeView === 'round'       && <RoundStats     gradeId={activeLeague} />}
              {activeView === 'leaderboard' && <Leaderboard    gradeId={activeLeague} />}
            </>
          )}
        </>
      )}
    </div>
  )
}
