import { useEffect, useState } from 'react'
import { fetchLatestEntryBundle, runningEntryBundle } from '../utils/appVersion'

const CHECK_EVERY_MS = 5 * 60 * 1000

async function isOutdated(): Promise<boolean> {
  const running = runningEntryBundle()
  if (!running) return false // dev server: no hashed bundle
  try {
    const latest = await fetchLatestEntryBundle()
    return latest !== null && latest !== running
  } catch {
    return false // offline: try again later
  }
}

// An open checkout must never be wiped by an automatic reload.
const isBusy = () => document.querySelector('[data-testid="barber-wizard"]') !== null

/**
 * The app added to the iPhone home screen stays alive in memory for days and keeps
 * running the version it was opened with, so fixes never reached some barbers.
 * When a newer deploy is live: reload by itself on resume if nothing is in
 * progress, otherwise show a banner to update with one tap.
 */
export function AppUpdateNotice() {
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    const check = () => isOutdated().then(outdated => {
      if (outdated) setUpdateReady(true)
      return outdated
    })
    void check()
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return
      if (await check() && !isBusy()) window.location.reload()
    }
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void check()
    }, CHECK_EVERY_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [])

  if (!updateReady) return null
  return (
    <div role="status" data-testid="app-update-notice"
      style={{ position: 'fixed', top: 'calc(8px + env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: '398px', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 12px 10px 16px', background: '#0F172A', color: '#fff', borderRadius: '14px', boxShadow: '0 8px 24px rgba(15,23,42,0.28)', fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', boxSizing: 'border-box' }}>
      <span>Hay una versión nueva de BarberOS</span>
      <button type="button" data-testid="app-update-reload" onClick={() => window.location.reload()}
        style={{ flexShrink: 0, minHeight: '36px', padding: '0 14px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '10px', fontFamily: 'inherit', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
        Actualizar
      </button>
    </div>
  )
}
