import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const deleted = await prisma.playerProfile.deleteMany({
    where: {
      OR: [
        { player_name: null },
        { player_name: { startsWith: '#' } },
      ]
    }
  })

  return NextResponse.json({ deleted: deleted.count })
}