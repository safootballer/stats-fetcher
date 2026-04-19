import { NextRequest, NextResponse } from 'next/server'
import { syncAllStats } from '@/lib/playhq'

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log(`[CRON] Player stats sync started at ${new Date().toISOString()}`)

  // Return immediately — sync runs in background
  const responsePromise = NextResponse.json({ success: true, message: 'Sync started in background' })

  syncAllStats().then(results => {
    const success = results.filter(r => r.success).length
    const failed  = results.filter(r => !r.success).length
    console.log(`[CRON] Done: ${success} succeeded, ${failed} failed`)
    results.forEach(r => console.log(`[CRON] ${r.success ? 'OK' : 'FAIL'} ${r.name}: ${r.message}`))
  }).catch(e => {
    console.error(`[CRON] Fatal: ${e.message}`)
  })

  return responsePromise
}