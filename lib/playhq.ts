const PLAYHQ_URL = 'https://api.playhq.com/graphql'
const HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Content-Type': 'application/json',
  Origin: 'https://www.playhq.com',
  Referer: 'https://www.playhq.com/',
  tenant: 'afl',
}

const GRADE_STATS_QUERY = `
query GradePlayerStats($gradeID: ID!) {
  gradePlayerStatistics(gradeID: $gradeID) {
    meta {
      page
      totalPages
      totalRecords
    }
    results {
      ranking
      profile {
        id
        firstName
        lastName
      }
      team {
        name
      }
      statistics {
        count
        details {
          value
        }
      }
    }
  }
}
`

async function safePost(payload: object): Promise<any> {
  try {
    const res = await fetch(PLAYHQ_URL, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(payload),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.data ?? null
  } catch { return null }
}

export async function syncGradeStats(
  gradeId: string,
  gradeName: string,
  season: string,
): Promise<{ success: boolean; added: number; updated: number; message: string }> {
  const { prisma } = await import('@/lib/prisma')
  const syncedAt = new Date().toISOString()
  let added = 0, updated = 0

  try {
    const data = await safePost({
      query: GRADE_STATS_QUERY,
      variables: { gradeID: gradeId },
    })

    if (!data?.gradePlayerStatistics) {
      return { success: false, added: 0, updated: 0, message: 'No data returned' }
    }

    // Top 20 only
    const results = (data.gradePlayerStatistics.results ?? []).slice(0, 20)

    for (const r of results) {
      const profile = r.profile
      if (!profile?.id) continue

      const playerId   = profile.id
      const playerName = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || 'Unknown'
      const teamName   = r.team?.name ?? ''

      // Parse all three stats from PlayHQ
      let goals = 0, games = 0, bp = 0
      for (const stat of r.statistics ?? []) {
        const val = stat.details?.value
        if (val === 'GOAL_COUNT')  goals = stat.count  // Total goals this season
        if (val === 'APPEARANCE')  games = stat.count  // Games played this season
        if (val === 'BEST_PLAYER') bp    = stat.count  // BP awards this season
      }

      const gameId = `${gradeId}-season`

      const vals = {
        grade_id:         gradeId,
        grade_name:       gradeName,
        season,
        round_number:     0,
        round_name:       'Season',
        game_id:          gameId,
        game_date:        syncedAt,
        team_id:          teamName,
        team_name:        teamName,
        opponent_name:    '',
        player_name:      playerName,
        player_number:    String(r.ranking ?? ''),
        goals,
        behinds:          games,   // Store APPEARANCE (games played) in behinds column
        best_player_rank: bp,      // Store BP award count
        synced_at:        syncedAt,
      }

      try {
        const existing = await prisma.playerGame.findFirst({
          where: { game_id: gameId, player_id: playerId },
        })
        if (existing) {
          await prisma.playerGame.update({ where: { id: existing.id }, data: vals })
          updated++
        } else {
          await prisma.playerGame.create({
            data: { player_id: playerId, ...vals },
          })
          added++
        }

        await prisma.playerProfile.upsert({
          where:  { player_id: playerId },
          update: { player_name: playerName, fetched_at: syncedAt },
          create: { player_id: playerId, player_name: playerName, fetched_at: syncedAt },
        })
      } catch { /* skip on error */ }
    }

    return { success: true, added, updated, message: `${added} added, ${updated} updated` }
  } catch (e: any) {
    return { success: false, added, updated, message: e.message }
  }
}

export async function syncAllStats(): Promise<{ name: string; success: boolean; message: string }[]> {
  const { prisma } = await import('@/lib/prisma')
  const leagues = await prisma.league.findMany({ where: { sync_enabled: 1 } })
  const results = []
  for (const lg of leagues) {
    console.log(`[SYNC] Starting: ${lg.grade_name}`)
    const res = await syncGradeStats(lg.grade_id, lg.grade_name ?? '', lg.season ?? '')
    console.log(`[SYNC] ${res.success ? 'OK' : 'FAIL'} ${lg.grade_name}: ${res.message}`)
    results.push({ name: lg.grade_name ?? lg.grade_id, success: res.success, message: res.message })
  }
  return results
}