import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type    = searchParams.get('type')
  const gradeId = searchParams.get('gradeId')

  if (type === 'leagues') {
    const leagues = await prisma.league.findMany({
      orderBy: { grade_name: 'asc' },
    })
    return NextResponse.json(leagues)
  }

  if (!gradeId) return NextResponse.json({ error: 'gradeId required' }, { status: 400 })

  if (type === 'season') {
    // player_number = PlayHQ ranking (1,2,3...)
    // goals         = GOAL_COUNT from PlayHQ
    // behinds       = APPEARANCE (games played) from PlayHQ
    // best_player_rank = BEST_PLAYER count from PlayHQ
    // Sort by PlayHQ ranking to match their leaderboard exactly
    const raw = await prisma.$queryRaw`
      SELECT
        player_id,
        MAX(player_name)              AS player_name,
        MAX(team_name)                AS team_name,
        MAX(goals)::int               AS goals,
        MAX(best_player_rank)::int    AS bp,
        MAX(behinds)::int             AS games,
        MAX(player_number::integer)   AS ranking
      FROM player_games
      WHERE grade_id = ${gradeId}
      GROUP BY player_id
      ORDER BY ranking ASC
    ` as any[]

    return NextResponse.json(raw.map(r => ({
      player:  r.player_name ?? r.player_id,
      team:    r.team_name ?? '',
      games:   r.games ?? 0,
      goals:   r.goals ?? 0,
      bp:      r.bp ?? 0,
      ranking: r.ranking ?? 0,
    })))
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}