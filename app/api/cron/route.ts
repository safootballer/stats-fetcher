import { NextRequest, NextResponse } from 'next/server'
import { syncAllStats } from '@/lib/playhq'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log(`[CRON] Player stats sync started at ${new Date().toISOString()}`)

  try {
    const results = await syncAllStats()
    const success = results.filter(r => r.success).length
    const failed  = results.filter(r => !r.success).length
    console.log(`[CRON] Done: ${success} succeeded, ${failed} failed`)
    return NextResponse.json({ success: true, results, summary: { success, failed } })
  } catch (e: any) {
    console.error(`[CRON] Fatal: ${e.message}`)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
