import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { GlassCard } from './GlassCard'

interface GlassStatCardProps {
  icon: ReactNode
  value: string | number
  label: string
  sublabel?: string
  color?: string // hex color
  delay?: number // animation delay in seconds
}

export function GlassStatCard({
  icon,
  value,
  label,
  sublabel,
  color = '#C8A97E',
  delay = 0,
}: GlassStatCardProps) {
  const rgbaColor = (opacity: number) => {
    // Convert hex to rgb
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${opacity})`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <GlassCard
        className="p-6"
        glowColor={color}
        hoverGlow={false}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
          {/* Icon container */}
          <div
            style={{
              flexShrink: 0,
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: rgbaColor(0.15),
              boxShadow: `0 0 20px ${rgbaColor(0.3)}`,
              border: `1px solid ${rgbaColor(0.3)}`,
            }}
          >
            {icon}
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '36px',
                fontWeight: 800,
                color: '#ffffff',
                lineHeight: '1.2',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {value}
            </div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.5)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginTop: '4px',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {label}
            </div>
            {sublabel && (
              <div
                style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.35)',
                  marginTop: '2px',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {sublabel}
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  )
}