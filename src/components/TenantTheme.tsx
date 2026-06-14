import { useEffect } from 'react'

interface TenantThemeProps {
  children: React.ReactNode
}

// Unified fixed theme for all tenants.
// Per-tenant color customization was removed; every tenant shares the same
// visual scheme. The DB columns primary_color/secondary_color remain unused.
export function TenantTheme({ children }: TenantThemeProps) {
  useEffect(() => {
    const root = document.documentElement.style

    // Fixed brand colors (same for every tenant)
    const primary = '#1a1a1a'
    const secondary = '#C8A97E'

    root.setProperty('--tenant-primary', primary)
    root.setProperty('--tenant-secondary', secondary)

    // Background and surfaces
    root.setProperty('--background', primary)
    root.setProperty('--surface', '#2a2a2a')
    root.setProperty('--card', '#2a2a2a')
    root.setProperty('--border', '#383838')

    // Accent
    root.setProperty('--accent', secondary)
    root.setProperty('--accent-dark', '#A68B5E')

    // Text colors
    root.setProperty('--text-primary', '#ffffff')
    root.setProperty('--text-secondary', '#a0a0a0')
    root.setProperty('--text-tertiary', '#707070')

    // Legacy variables for backward compatibility with existing components
    root.setProperty('--primary', primary)
    root.setProperty('--secondary', secondary)
  }, [])

  return <>{children}</>
}
