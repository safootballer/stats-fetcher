'use client'
import { signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'

export function Sidebar({ user }: { user: any }) {
  const [leagues, setLeagues]   = useState<any[]>([])
  const [syncing, setSyncing]   = useState<string | null>(null)
  const [msg, setMsg]           = useState<{ type: string; text: string } | null>(null)
  const isAdmin = user?.role === 'admin'

  async function loadLeagues() {
    const data = await fetch('/api/stats?type=leagues').then(r => r.json())
    setLeagues(Array.isArray(data) ? data : [])
  }

  useEffect(() => { loadLeagues() }, [])

  async function syncAll() {
    setSyncing('all'); setMsg(null)
    const res  = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const data = await res.json()
    setSyncing(null)
    const ok  = data.results?.filter((r: any) => r.success).length ?? 0
    const bad = data.results?.filter((r: any) => !r.success).length ?? 0
    setMsg({ type: ok > 0 ? 'success' : 'error', text: `${ok} synced${bad > 0 ? `, ${bad} failed` : ''}` })
    window.dispatchEvent(new Event('stats:synced'))
  }

  async function syncOne(gradeId: string, gradeName: string) {
    setSyncing(gradeId); setMsg(null)
    const res  = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gradeId }) })
    const data = await res.json()
    setSyncing(null)
    const r = data.results?.[0]
    setMsg({ type: r?.success ? 'success' : 'error', text: r?.message ?? 'Done' })
    window.dispatchEvent(new Event('stats:synced'))
  }

  return (
    <aside style={{
      width: 250, flexShrink: 0, background: '#000',
      borderRight: '1px solid rgba(44,163,238,0.2)',
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      padding: '1.25rem 1rem', gap: '0.5rem',
      position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
    }}>
      {/* Brand */}
      <div style={{ textAlign: 'center', padding: '0.5rem 0 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.625rem', marginBottom: '0.625rem' }}>
          <img src="/logo2.png" alt="" style={{ height: 32 }} onError={e => (e.currentTarget.style.display='none')} />
          <img src="/logo.png"  alt="" style={{ height: 32 }} onError={e => (e.currentTarget.style.display='none')} />
        </div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '1.2rem', color: '#2ca3ee' }}>Player Stats</div>
        <span className="badge-yellow" style={{ fontSize: '0.58rem', marginTop: 3, display: 'inline-block' }}>SA Footballer</span>
      </div>

      <div style={{ height: 1, background: 'rgba(44,163,238,0.2)' }} />

      {/* User */}
      <div style={{ padding: '0.625rem', borderRadius: 9, background: 'rgba(44,163,238,0.05)', border: '1px solid rgba(44,163,238,0.15)' }}>
        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Signed in</div>
        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user?.name}</div>
        <div style={{ fontSize: '0.72rem', color: '#2ca3ee' }}>{(user?.role ?? 'user').toUpperCase()}</div>
      </div>

      {/* Admin sync */}
      {isAdmin && (
        <>
          <div style={{ height: 1, background: 'rgba(44,163,238,0.15)' }} />
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Sync</p>
            <button onClick={syncAll} disabled={syncing !== null} className="btn-primary" style={{ width: '100%', fontSize: '0.82rem', padding: '0.6rem', marginBottom: '0.5rem' }}>
              {syncing === 'all' ? 'Syncing...' : 'Sync All Leagues'}
            </button>
            {leagues.map(lg => (
              <button key={lg.grade_id} onClick={() => syncOne(lg.grade_id, lg.grade_name)} disabled={syncing !== null}
                className="btn-ghost" style={{ width: '100%', fontSize: '0.72rem', padding: '0.35rem 0.5rem', marginBottom: '0.25rem', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {syncing === lg.grade_id ? '...' : `Sync ${lg.grade_name?.slice(0, 28)}`}
              </button>
            ))}
          </div>
          {msg && (
            <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'} style={{ fontSize: '0.78rem', padding: '0.5rem 0.75rem' }}>
              {msg.text}
            </div>
          )}
        </>
      )}

      <div style={{ height: 1, background: 'rgba(44,163,238,0.15)' }} />

      {/* Leagues list */}
      <div>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem' }}>Leagues</p>
        {leagues.map(lg => (
          <div key={lg.id} style={{ marginBottom: '0.375rem', padding: '0.5rem 0.75rem', borderRadius: 8, background: 'rgba(44,163,238,0.04)', border: '1px solid rgba(44,163,238,0.1)' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lg.grade_name}</div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{lg.season}</div>
          </div>
        ))}
        {!leagues.length && <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)' }}>No leagues configured</p>}
      </div>

      <div style={{ flex: 1 }} />
      <div style={{ height: 1, background: 'rgba(44,163,238,0.2)' }} />
      <button onClick={() => signOut({ callbackUrl: '/login' })} className="btn-yellow" style={{ width: '100%', fontSize: '0.82rem', padding: '0.6rem' }}>
        Logout
      </button>
    </aside>
  )
}
