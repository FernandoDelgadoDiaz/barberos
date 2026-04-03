import { useEffect } from 'react'
import { useTenantStore } from '../stores/tenantStore'

interface TenantThemeProps {
  children: React.ReactNode
}

export function TenantTheme({ children }: TenantThemeProps) {
  const { tenant } = useTenantStore()

  useEffect(() => {
    const root = document.documentElement.style

    // Tenant colors from Supabase
    const tenantPrimary = tenant?.primary_color
    const tenantSecondary = tenant?.secondary_color

    // Set tenant variables (will override :root defaults)
    root.setProperty('--tenant-primary', tenantPrimary || '#1a1a1a')
    root.setProperty('--tenant-secondary', tenantSecondary || '#f59e0b')

    // Background uses tenant primary, falls back to luxury dark (#080808)
    const backgroundColor = tenantPrimary || '#080808'
    root.setProperty('--background', backgroundColor)

    // Surface is fixed luxury dark gray (#111111) for optimal contrast
    // Can be derived from tenant primary if desired, but fixed for now
    root.setProperty('--surface', '#111111')
    root.setProperty('--card', '#1a1a1a')
    root.setProperty('--border', '#2a2a2a')

    // Accent uses tenant secondary if provided, otherwise luxury electric green (#B8FF47)
    const accentColor = tenantSecondary || '#B8FF47'
    root.setProperty('--accent', accentColor)
    root.setProperty('--accent-dark', tenantSecondary ? `${tenantSecondary}cc` : '#8cc63f')

    // Text colors remain luxury defaults (white/gray)
    root.setProperty('--text-primary', '#ffffff')
    root.setProperty('--text-secondary', '#a0a0a0')
    root.setProperty('--text-tertiary', '#707070')

    // Legacy variables for backward compatibility with existing components
    root.setProperty('--primary', tenantPrimary || '#1a1a1a')
    root.setProperty('--secondary', tenantSecondary || '#f59e0b')
  }, [tenant])

  return <>{children}</>
}