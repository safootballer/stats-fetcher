import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getLeagueCategory } from '@/lib/leagueMap'

const COMPETITION_MAP: Record<string, string> = {
  'SANFL':                         'SANFL',
  'SANFLW':                        'SANFLW',
  "Adelaide Footy League (Men's)": 'Amateur',
  "SAWFL Women's":                 "SAWFL Women's",
  'Country Football':              'Country Football',
}

const COUNTRY_LEAGUE_MAP: Record<string, string> = {
  'Adelaide Plains':           'adelaide-plains',
  'Barossa Light & Gawler':    'barossa',
  'Eastern Eyre':              'eastern-eyre',
  'Far North':                 'far-north',
  'Great Flinders':            'great-flinders',
  'Great Southern':            'great-southern',
  'Hills Division 1':          'hills-div1',
  'Hills Country Division':    'hills-country',
  'Kangaroo Island':           'kangaroo-island',
  'Kowree Naracoorte Tatiara': 'knt',
  'Limestone Coast':           'limestone-coast',
  'Murray Valley':             'murray-valley',
  'Mid South Eastern':         'mid-south-eastern',
  'North Eastern':             'north-eastern',
  'Northern Areas':            'northern-areas',
  'Port Lincoln':              'port-lincoln',
  'River Murray':              'river-murray',
  'Riverland':                 'riverland',
  'Southern':                  'southern',
  'Spencer Gulf':              'spencer-gulf',
  'Western Eyre':              'western-eyre',
  'Whyalla':                   'whyalla',
  'Yorke Peninsula':           'yorke-peninsula',
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = process.env.SANITY_PROJECT_ID
  const dataset   = process.env.SANITY_DATASET || 'production'
  const token     = process.env.SANITY_TOKEN

  if (!projectId || !token) {
    return NextResponse.json({ error: 'Sanity env vars not configured' }, { status: 500 })
  }

  const leagues = await prisma.league.findMany({ where: { sync_enabled: 1 } })
  const results: { name: string; success: boolean; message: string }[] = []

  for (const league of leagues) {
    const gradeId = league.grade_id
    try {
      const rows = await prisma.$queryRaw`
        SELECT
          player_id,
          MAX(player_name)   AS player_name,
          MAX(team_name)     AS team_name,
          MAX(goals)::int    AS goals,
          MAX(behinds)::int  AS games
        FROM player_games
        WHERE grade_id = ${gradeId}
        GROUP BY player_id
        ORDER BY goals DESC
        LIMIT 20
      ` as any[]

      if (!rows.length) {
        results.push({ name: league.grade_name ?? gradeId, success: false, message: 'No stats data' })
        continue
      }

      const cat         = getLeagueCategory(gradeId)
      const competition = COMPETITION_MAP[cat.level1] ?? 'Country Football'
      const countryLeague = cat.level1 === 'Country Football'
        ? (COUNTRY_LEAGUE_MAP[cat.level2] ?? '')
        : undefined

      const doc: Record<string, any> = {
        _id:         `goalkickers-${gradeId}`,
        _type:       'goalKickers',
        title:       `${league.grade_name ?? cat.level3} Goal Kickers ${league.season ?? ''}`,
        slug:        { _type: 'slug', current: `goalkickers-${gradeId}` },
        competition,
        gradeName:   cat.level3,
        season:      league.season ?? '2026',
        syncedAt:    new Date().toISOString(),
        players: rows.map((r, i) => ({
          _key:       `player-${r.player_id}-${i}`,
          ranking:    i + 1,
          playerName: r.player_name ?? 'Unknown',
          teamName:   r.team_name ?? '',
          games:      Number(r.games) ?? 0,
          goals:      Number(r.goals) ?? 0,
          bp:         0,
        }))
      }

      if (countryLeague) doc.countryLeague = countryLeague

      const res = await fetch(
        `https://${projectId}.api.sanity.io/v2024-01-01/data/mutate/${dataset}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ mutations: [{ createOrReplace: doc }] }),
        }
      )

      if (!res.ok) {
        const err = await res.text()
        results.push({ name: league.grade_name ?? gradeId, success: false, message: `Sanity error: ${err}` })
      } else {
        results.push({ name: league.grade_name ?? gradeId, success: true, message: 'Published' })
      }
    } catch (e: any) {
      results.push({ name: league.grade_name ?? gradeId, success: false, message: e.message })
    }
  }

  const succeeded = results.filter(r => r.success).length
  const failed    = results.filter(r => !r.success).length

  return NextResponse.json({ success: true, results, summary: { succeeded, failed, total: leagues.length } })
}