const PLAYHQ_URL = 'https://api.playhq.com/graphql'
const HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Content-Type': 'application/json',
  Origin: 'https://www.playhq.com',
  Referer: 'https://www.playhq.com/',
  tenant: 'afl',
}

const STATS_QUERY = `
query($gradeID: ID!) {
  discoverGrade(gradeID: $gradeID) {
    rounds {
      id name number
      games {
        id date
        status { value }
        home { ... on DiscoverTeam { id name } }
        away { ... on DiscoverTeam { id name } }
        statistics {
          home {
            players {
              playerNumber
              player {
                ... on DiscoverParticipant { id }
                ... on DiscoverAnonymousParticipant { id name }
                ... on DiscoverRegularFillInPlayer { id name }
                ... on DiscoverGamePermitFillInPlayer { id }
                ... on DiscoverParticipantFillInPlayer { id }
              }
              statistics { count type { value label } }
            }
            bestPlayers {
              ranking
              participant {
                ... on DiscoverParticipant { id }
                ... on DiscoverAnonymousParticipant { id name }
              }
            }
          }
          away {
            players {
              playerNumber
              player {
                ... on DiscoverParticipant { id }
                ... on DiscoverAnonymousParticipant { id name }
                ... on DiscoverRegularFillInPlayer { id name }
                ... on DiscoverGamePermitFillInPlayer { id }
                ... on DiscoverParticipantFillInPlayer { id }
              }
              statistics { count type { value label } }
            }
            bestPlayers {
              ranking
              participant {
                ... on DiscoverParticipant { id }
                ... on DiscoverAnonymousParticipant { id name }
              }
            }
          }
        }
      }
    }
  }
}
`

const PROFILE_QUERY = `
query($participantID: ID!) {
  discoverParticipant(participantID: $participantID) {
    profile { firstName lastName }
  }
}
`

async function safePost(payload: object): Promise<any> {
  try {
    const res = await fetch(PLAYHQ_URL, {
      method: 'POST', headers: HEADERS, body: JSON.stringify(payload),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.data ?? null
  } catch { return null }
}

async function resolvePlayerName(playerId: string, nameDirect: string | null): Promise<string> {
  const { prisma } = await import('@/lib/prisma')

  // If we have name directly (anonymous/fill-in player), cache and return it
  if (nameDirect) {
    const existing = await prisma.playerProfile.findUnique({ where: { player_id: playerId } })
    if (!existing) {
      await prisma.playerProfile.create({
        data: { player_id: playerId, player_name: nameDirect, fetched_at: new Date().toISOString() },
      })
    }
    return nameDirect
  }

  // Check cache first
  const cached = await prisma.playerProfile.findUnique({ where: { player_id: playerId } })
  if (cached?.player_name) return cached.player_name

  // Fetch from PlayHQ profile API
  const data = await safePost({ query: PROFILE_QUERY, variables: { participantID: playerId } })
  let name: string | null = null
  if (data?.discoverParticipant?.profile) {
    const { firstName, lastName } = data.discoverParticipant.profile
    name = `${firstName ?? ''} ${lastName ?? ''}`.trim() || null
  }

  // Cache the result
  if (cached) {
    await prisma.playerProfile.update({ where: { player_id: playerId }, data: { player_name: name, fetched_at: new Date().toISOString() } })
  } else {
    await prisma.playerProfile.create({ data: { player_id: playerId, player_name: name, fetched_at: new Date().toISOString() } })
  }

  return name ?? `#${playerId.slice(0, 6)}`
}

export async function syncGradeStats(
  gradeId: string,
  gradeName: string,
  season: string,
): Promise<{ success: boolean; added: number; updated: number; message: string }> {
  const { prisma } = await import('@/lib/prisma')
  const syncedAt = new Date().toISOString()

  const data = await safePost({ query: STATS_QUERY, variables: { gradeID: gradeId } })
  if (!data) return { success: false, added: 0, updated: 0, message: 'Failed to fetch from PlayHQ' }

  const rounds = data?.discoverGrade?.rounds ?? []
  let added = 0, updated = 0

  try {
    for (const rnd of rounds) {
      const roundName   = rnd.name
      const roundNumber = rnd.number ?? 0

      for (const game of rnd.games ?? []) {
        const gameId   = game.id
        const gameDate = game.date ?? ''
        const status   = game.status?.value

        // Only process completed games
        if (!['FINAL', 'FORFEIT'].includes(status)) continue

        const home  = game.home ?? {}
        const away  = game.away ?? {}
        const stats = game.statistics ?? {}

        for (const [side, teamId, teamName, opponentName] of [
          ['home', home.id ?? '', home.name ?? '', away.name ?? ''],
          ['away', away.id ?? '', away.name ?? '', home.name ?? ''],
        ] as [string, string, string, string][]) {
          const sideData    = stats[side] ?? {}
          const players     = sideData.players ?? []
          const bestPlayers = sideData.bestPlayers ?? []

          // Build best player map
          const bpMap: Record<string, number> = {}
          for (const bp of bestPlayers) {
            const pid = bp.participant?.id
            if (pid) bpMap[pid] = bp.ranking ?? 1
          }

          for (const pe of players) {
            const playerObj  = pe.player ?? {}
            const playerId   = playerObj.id ?? ''
            const nameDirect = playerObj.name ?? null
            const playerNum  = pe.playerNumber ?? ''

            if (!playerId) continue

            // Resolve real name
            const playerName = await resolvePlayerName(playerId, nameDirect)

            // Parse stats
            let goals = 0, behinds = 0
            for (const stat of pe.statistics ?? []) {
              if (stat.type.value === '6_POINT_SCORE') goals   = stat.count
              if (stat.type.value === '1_POINT_SCORE') behinds = stat.count
            }

            const bpRank = bpMap[playerId] ?? 0

            const vals = {
              grade_id: gradeId, grade_name: gradeName, season,
              round_number: roundNumber, round_name: roundName,
              game_date: gameDate, team_id: teamId, team_name: teamName,
              opponent_name: opponentName, player_name: playerName,
              player_number: playerNum, goals, behinds,
              best_player_rank: bpRank, synced_at: syncedAt,
            }

            const existing = await prisma.playerGame.findFirst({
              where: { game_id: gameId, player_id: playerId, team_id: teamId },
            })

            if (existing) {
              await prisma.playerGame.update({ where: { id: existing.id }, data: vals })
              updated++
            } else {
              await prisma.playerGame.create({ data: { player_id: playerId, game_id: gameId, ...vals } })
              added++
            }
          }
        }
      }
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
    const res = await syncGradeStats(lg.grade_id, lg.grade_name ?? '', lg.season ?? '')
    results.push({ name: lg.grade_name ?? lg.grade_id, success: res.success, message: res.message })
  }
  return results
}
