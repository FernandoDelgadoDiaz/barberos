import { ReactNode, useState } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  glowColor?: string // hex color for glow effect
  hoverGlow?: boolean // enable gold glow on hover
}

export function GlassCard({ children, className = '', glowColor, hoverGlow = true }: GlassCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const baseShadow = '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)'
  const goldGlow = '0 0 60px rgba(200,169,126,0.25)'
  const customGlow = glowColor ? `0 0 60px ${glowColor}40` : ''

  const shadow = glowColor
    ? `${baseShadow}, ${customGlow}`
    : baseShadow

  const hoverShadow = hoverGlow
    ? `${baseShadow}, ${goldGlow}`
    : baseShadow

  const handleMouseEnter = () => setIsHovered(true)
  const handleMouseLeave = () => setIsHovered(false)

  return (
    <div
      className={`relative rounded-2xl overflow-hidden ${className}`}
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: isHovered ? '1px solid rgba(200,169,126,0.3)' : '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        boxShadow: isHovered ? hoverShadow : shadow,
        position: 'relative',
        transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
        willChange: 'transform, box-shadow',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Top border gradient */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />
      {children}
    </div>
  )
}