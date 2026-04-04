import { useEffect } from 'react'
import { supabase } from '../config/supabase'
import type { ServiceLog } from '../types'

export function useServiceLogsRealtime(
  tenantId: string,
  onNewLog: (log: ServiceLog) => void
) {
  useEffect(() => {
    if (!tenantId) return

    const channel = supabase
      .channel('service_logs_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'service_logs',
          filter: `tenant_id=eq.${tenantId}`
        },
        (payload) => {
          onNewLog(payload.new as ServiceLog)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Realtime subscription established for tenant:', tenantId)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId, onNewLog])
}

// Optional: hook for subscribing to updates as well
export function useServiceLogsUpdatesRealtime(
  tenantId: string,
  onUpdateLog: (log: ServiceLog) => void
) {
  useEffect(() => {
    if (!tenantId) return

    const channel = supabase
      .channel('service_logs_updates_realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'service_logs',
          filter: `tenant_id=eq.${tenantId}`
        },
        (payload) => {
          onUpdateLog(payload.new as ServiceLog)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId, onUpdateLog])
}