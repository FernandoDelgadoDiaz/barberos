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
    root.setProperty('--tenant-secondary', tenantSecondary || '#C8A97E')

    // Background uses tenant primary, falls back to luxury dark (#080808)
    const backgroundColor = tenantPrimary || '#1a1a1a'
    root.setProperty('--background', backgroundColor)

    // Surface is fixed luxury dark gray (#111111) for optimal contrast
    // Can be derived from tenant primary if desired, but fixed for now
    root.setProperty('--surface', '#2a2a2a')
    root.setProperty('--card', '#2a2a2a')
    root.setProperty('--border', '#383838')

    // Accent uses tenant secondary if provided, otherwise luxury electric green (#B8FF47)
    const accentColor = tenantSecondary || '#C8A97E'
    root.setProperty('--accent', accentColor)
    root.setProperty('--accent-dark', tenantSecondary ? `${tenantSecondary}cc` : '#A68B5E')

    // Text colors remain luxury defaults (white/gray)
    root.setProperty('--text-primary', '#ffffff')
    root.setProperty('--text-secondary', '#a0a0a0')
    root.setProperty('--text-tertiary', '#707070')

    // Legacy variables for backward compatibility with existing components
    root.setProperty('--primary', tenantPrimary || '#1a1a1a')
    root.setProperty('--secondary', tenantSecondary || '#C8A97E')
  }, [tenant])

  return <>{children}</>
}