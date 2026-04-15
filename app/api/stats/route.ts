import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type    = searchParams.get('type')    // 'season' | 'round' | 'leaderboard' | 'rounds' | 'leagues'
  const gradeId = searchParams.get('gradeId')
  const roundNum = searchParams.get('round')

  if (type === 'leagues') {
    const leagues = await prisma.league.findMany({
      where: { sync_enabled: 1 },
      orderBy: { grade_name: 'asc' },
    })
    return NextResponse.json(leagues)
  }

  if (!gradeId) return NextResponse.json({ error: 'gradeId required' }, { status: 400 })

  if (type === 'rounds') {
    const rounds = await prisma.playerGame.findMany({
      where: { grade_id: gradeId },
      select: { round_number: true, round_name: true },
      distinct: ['round_number', 'round_name'],
      orderBy: { round_number: 'asc' },
    })
    return NextResponse.json(rounds)
  }

  if (type === 'season') {
    // Aggregate season stats per player — Player, Team, Games, Goals only
    const raw = await prisma.$queryRaw`
      SELECT
        player_id,
        MAX(player_name) AS player_name,
        MAX(team_name)   AS team_name,
        COUNT(DISTINCT game_id)::int AS games,
        COALESCE(SUM(goals), 0)::int AS goals
      FROM player_games
      WHERE grade_id = ${gradeId}
      GROUP BY player_id
      ORDER BY goals DESC, games DESC
    ` as any[]

    return NextResponse.json(raw.map(r => ({
      player: r.player_name ?? r.player_id,
      team:   r.team_name ?? '',
      games:  r.games,
      goals:  r.goals,
    })))
  }

  if (type === 'round') {
    if (!roundNum) return NextResponse.json({ error: 'round required' }, { status: 400 })

    const raw = await prisma.playerGame.findMany({
      where: { grade_id: gradeId, round_number: parseInt(roundNum) },
      orderBy: [{ team_name: 'asc' }, { goals: 'desc' }],
    })

    // Group by team
    const teams: Record<string, any[]> = {}
    for (const r of raw) {
      const t = r.team_name ?? 'Unknown'
      if (!teams[t]) teams[t] = []
      teams[t].push({
        player: r.player_name ?? r.player_id,
        team:   r.team_name ?? '',
        games:  1,
        goals:  r.goals ?? 0,
        vs:     r.opponent_name ?? '',
      })
    }

    return NextResponse.json({ teams, total: raw.length })
  }

  if (type === 'leaderboard') {
    const raw = await prisma.$queryRaw`
      SELECT
        player_id,
        MAX(player_name) AS player_name,
        MAX(team_name)   AS team_name,
        COUNT(DISTINCT game_id)::int AS games,
        COALESCE(SUM(goals), 0)::int AS goals,
        COUNT(CASE WHEN best_player_rank > 0 THEN 1 END)::int AS bp
      FROM player_games
      WHERE grade_id = ${gradeId}
      GROUP BY player_id
    ` as any[]

    const topGoals = [...raw]
      .sort((a, b) => b.goals - a.goals || b.games - a.games)
      .slice(0, 15)
      .map(r => ({
        player: r.player_name ?? r.player_id,
        team:   r.team_name ?? '',
        games:  r.games,
        goals:  r.goals,
        avgGoals: r.games > 0 ? (r.goals / r.games).toFixed(2) : '0.00',
      }))

    const topBP = [...raw]
      .filter(r => r.bp > 0)
      .sort((a, b) => b.bp - a.bp)
      .slice(0, 15)
      .map(r => ({
        player: r.player_name ?? r.player_id,
        team:   r.team_name ?? '',
        games:  r.games,
        goals:  r.goals,
        bp:     r.bp,
      }))

    return NextResponse.json({ topGoals, topBP })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
