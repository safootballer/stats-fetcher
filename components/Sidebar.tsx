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

  useEffect(() => {
    window.addEventListener('stats:synced', loadLeagues)
    return () => window.removeEventListener('stats:synced', loadLeagues)
  }, [])

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

  return (
    <aside style={{
      width: 260, flexShrink: 0,
      background: '#000',
      borderRight: '3px solid #2ca3ee',
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      padding: '1.5rem 1rem',
      gap: '1rem',
      position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
    }}>

      {/* Logo */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
        <img src="/logo3.png" alt="SA Footballer" style={{ width: '100%', maxWidth: 200, height: 'auto' }} onError={e => (e.currentTarget.style.display='none')} />
      </div>

      {/* Brand */}
      <div style={{ textAlign: 'center' }}>
        <span style={{ display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '1.3rem', color: '#2ca3ee' }}>
          Player Stats
        </span>
        <span style={{ display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#e6fe00' }}>
          SA Footballer
        </span>
      </div>

      <hr style={{ borderColor: '#2ca3ee', opacity: 0.35 }} />

      {/* User */}
      <div>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2ca3ee', borderBottom: '2px solid #2ca3ee', paddingBottom: 4, marginBottom: 8 }}>
          User Profile
        </p>
        <p style={{ fontSize: '0.875rem', color: '#fff' }}>
          <span style={{ opacity: 0.6 }}>Name: </span>{user?.name ?? '-'}
        </p>
        <p style={{ fontSize: '0.875rem', color: '#fff', marginTop: 4 }}>
          <span style={{ opacity: 0.6 }}>Role: </span>{(user?.role ?? 'user').toUpperCase()}
        </p>
      </div>

      <hr style={{ borderColor: '#2ca3ee', opacity: 0.35 }} />

      {/* Admin sync */}
      {isAdmin && (
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2ca3ee', borderBottom: '2px solid #2ca3ee', paddingBottom: 4, marginBottom: 8 }}>
            Sync
          </p>
          <button
            onClick={syncAll}
            disabled={syncing !== null}
            style={{
              width: '100%', background: syncing ? 'rgba(44,163,238,0.3)' : 'linear-gradient(135deg,#2ca3ee,#00b8f1)',
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '0.7rem', fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.06em',
              textTransform: 'uppercase', cursor: syncing ? 'not-allowed' : 'pointer',
            }}
          >
            {syncing === 'all' ? 'Syncing...' : 'Sync All Leagues'}
          </button>

          {msg && (
            <div style={{
              marginTop: 8, padding: '0.5rem 0.75rem', borderRadius: 8, fontSize: '0.8rem',
              background: msg.type === 'success' ? 'rgba(5,46,22,0.8)' : 'rgba(45,0,0,0.8)',
              border: `1px solid ${msg.type === 'success' ? '#4ade80' : '#f87171'}`,
              color: msg.type === 'success' ? '#4ade80' : '#f87171',
            }}>
              {msg.text}
            </div>
          )}
        </div>
      )}

      <hr style={{ borderColor: '#2ca3ee', opacity: 0.35 }} />

      {/* Leagues list */}
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2ca3ee', borderBottom: '2px solid #2ca3ee', paddingBottom: 4, marginBottom: 8 }}>
          Leagues ({leagues.length})
        </p>
        {leagues.length === 0 && (
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>No leagues configured</p>
        )}
        {leagues.map(lg => (
          <div key={lg.id} style={{
            padding: '0.5rem 0.75rem', borderRadius: 8, marginBottom: 4,
            background: 'rgba(44,163,238,0.06)', border: '1px solid rgba(44,163,238,0.2)',
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lg.sync_enabled ? '🟢' : '🔴'} {lg.grade_name}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              {lg.season} · {lg.last_synced_at?.slice(0, 10) ?? 'Never synced'}
            </div>
          </div>
        ))}
      </div>

      <hr style={{ borderColor: '#2ca3ee', opacity: 0.35 }} />

      {/* Logout */}
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        style={{
          width: '100%', background: '#e6fe00', color: '#000',
          border: 'none', borderRadius: 10, padding: '0.7rem',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.06em',
          textTransform: 'uppercase', cursor: 'pointer',
        }}
      >
        Logout
      </button>
    </aside>
  )
}