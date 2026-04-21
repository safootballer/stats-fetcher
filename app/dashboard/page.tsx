'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { getLeagueCategory, LEVEL1_ORDER, LEVEL2_ORDER } from '@/lib/leagueMap'

function SeasonStats({ gradeId }: { gradeId: string }) {
  const [data, setData]       = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied]   = useState(false)
  const [publishing, setPublishing]   = useState(false)
  const [publishMsg, setPublishMsg]   = useState<{ type: string; text: string } | null>(null)

  useEffect(() => {
    setLoading(true)
    setPublishMsg(null)
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

  async function publishToWebsite() {
    setPublishing(true)
    setPublishMsg(null)
    try {
      const res  = await fetch('/api/publish-goal-kickers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gradeId }),
      })
      const data = await res.json()
      if (data.success) {
        setPublishMsg({ type: 'success', text: `✅ Published to website: ${data.title}` })
      } else {
        setPublishMsg({ type: 'error', text: `❌ ${data.error ?? 'Publish failed'}` })
      }
    } catch (e: any) {
      setPublishMsg({ type: 'error', text: `❌ ${e.message}` })
    }
    setPublishing(false)
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
      {/* Action buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>
          {'Season totals · Top ' + data.length + ' players · Sourced from PlayHQ'}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={copyTable} className="btn-ghost" style={{ fontSize: '0.78rem' }}>
            {copied ? '✅ Copied!' : '📋 Copy Table'}
          </button>
          <button
            onClick={publishToWebsite}
            disabled={publishing}
            style={{
              background: publishing ? 'rgba(230,254,0,0.3)' : '#e6fe00',
              color: '#000', border: 'none', borderRadius: 8,
              padding: '0.45rem 1rem', fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.06em',
              textTransform: 'uppercase', cursor: publishing ? 'not-allowed' : 'pointer',
            }}
          >
            {publishing ? 'Publishing...' : '🌐 Publish to Website'}
          </button>
        </div>
      </div>

      {/* Publish message */}
      {publishMsg && (
        <div style={{
          marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 8, fontSize: '0.85rem',
          background: publishMsg.type === 'success' ? 'rgba(5,46,22,0.8)' : 'rgba(45,0,0,0.8)',
          border: `1px solid ${publishMsg.type === 'success' ? '#4ade80' : '#f87171'}`,
          color: publishMsg.type === 'success' ? '#4ade80' : '#f87171',
        }}>
          {publishMsg.text}
        </div>
      )}

      {/* Stats table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="stats-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Player</th><th>Team</th>
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
                <td style={{ fontWeight: 700, color: i === 0 ? '#e6fe00' : 'rgba(255,255,255,0.85)' }}>{r.goals}</td>
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
  const [leagues, setLeagues]             = useState<any[]>([])
  const [level1, setLevel1]               = useState<string>('SANFL')
  const [level2, setLevel2]               = useState<string | null>(null)
  const [activeGradeId, setActiveGradeId] = useState<string | null>(null)

  const loadLeagues = useCallback(async () => {
    const data = await fetch('/api/stats?type=leagues').then(r => r.json())
    setLeagues(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => { loadLeagues() }, [])
  useEffect(() => {
    window.addEventListener('stats:synced', loadLeagues)
    return () => window.removeEventListener('stats:synced', loadLeagues)
  }, [loadLeagues])

  useEffect(() => {
    const l2options = getLevel2Options(level1)
    setLevel2(l2options[0] ?? null)
    setActiveGradeId(null)
  }, [level1, leagues])

  useEffect(() => {
    if (!level2) return
    const grades = getGradesForLevel2(level1, level2)
    if (grades.length > 0) setActiveGradeId(grades[0].grade_id)
  }, [level2])

  function getLevel2Options(l1: string): string[] {
    const order = LEVEL2_ORDER[l1] ?? []
    const available = new Set(
      leagues
        .filter(lg => getLeagueCategory(lg.grade_id).level1 === l1)
        .map(lg => getLeagueCategory(lg.grade_id).level2)
    )
    return order.filter(l2 => available.has(l2))
  }

  function getGradesForLevel2(l1: string, l2: string) {
    return leagues
      .filter(lg => {
        const cat = getLeagueCategory(lg.grade_id)
        return cat.level1 === l1 && cat.level2 === l2
      })
      .sort((a, b) => getLeagueCategory(a.grade_id).sortOrder - getLeagueCategory(b.grade_id).sortOrder)
  }

  const level2Options = getLevel2Options(level1)
  const gradeOptions  = level2 ? getGradesForLevel2(level1, level2) : []

  const tabStyle = (active: boolean, color = '#2ca3ee') => ({
    padding: '0.5rem 1.125rem', borderRadius: 8,
    fontSize: '0.82rem', fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    border: active ? `1.5px solid ${color}` : '1.5px solid rgba(44,163,238,0.2)',
    background: active ? 'rgba(44,163,238,0.15)' : 'transparent',
    color: active ? color : 'rgba(255,255,255,0.55)',
    transition: 'all 0.15s',
    fontFamily: "'Barlow Condensed', sans-serif",
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap' as const,
  })

  return (
    <div className="fade-up" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '2.25rem', color: '#2ca3ee', margin: 0 }}>
          Player Statistics
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
          {'Welcome back, '}<strong style={{ color: '#fff' }}>{session?.user?.name}</strong>
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
          {/* Level 1 */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {LEVEL1_ORDER.filter(l1 => getLevel2Options(l1).length > 0).map(l1 => (
              <button key={l1} onClick={() => setLevel1(l1)} style={tabStyle(level1 === l1, '#2ca3ee')}>
                {l1}
              </button>
            ))}
          </div>

          {/* Level 2 */}
          {level2Options.length > 0 && (
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '1rem', paddingLeft: '0.5rem', borderLeft: '3px solid rgba(44,163,238,0.3)' }}>
              {level2Options.map(l2 => (
                <button key={l2} onClick={() => setLevel2(l2)} style={tabStyle(level2 === l2, '#e6fe00')}>
                  {l2}
                </button>
              ))}
            </div>
          )}

          {/* Level 3 */}
          {gradeOptions.length > 0 && (
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '1.5rem', paddingLeft: '1rem', borderLeft: '3px solid rgba(230,254,0,0.2)' }}>
              {gradeOptions.map(lg => {
                const cat = getLeagueCategory(lg.grade_id)
                return (
                  <button key={lg.grade_id} onClick={() => setActiveGradeId(lg.grade_id)}
                    style={tabStyle(activeGradeId === lg.grade_id, '#4ade80')}>
                    {cat.level3}
                  </button>
                )
              })}
            </div>
          )}

          {activeGradeId && <SeasonStats gradeId={activeGradeId} />}
        </>
      )}
    </div>
  )
}