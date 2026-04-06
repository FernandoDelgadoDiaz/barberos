import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { GlassCard } from './GlassCard'

export interface Column<T> {
  key: keyof T | string
  label: string
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (value: any, row: T, index: number) => ReactNode
}

interface GlassTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: keyof T | ((row: T, index: number) => string)
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T, index: number) => void
}

export function GlassTable<T extends Record<string, any>>({
  columns,
  data,
  rowKey,
  loading = false,
  emptyMessage = 'No hay datos disponibles',
  onRowClick,
}: GlassTableProps<T>) {
  const getRowKey = (row: T, index: number): string => {
    if (typeof rowKey === 'function') return rowKey(row, index)
    return String(row[rowKey])
  }

  const renderCell = (column: Column<T>, row: T, rowIndex: number, _cellIndex: number) => {
    if (column.render) {
      return column.render(row[column.key as keyof T] ?? null, row, rowIndex)
    }

    const value = row[column.key as keyof T]

    // Special rendering for boolean status
    if (column.key === 'is_active' && typeof value === 'boolean') {
      return (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '6px 12px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 500,
            backgroundColor: value ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: value ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)',
            border: `1px solid ${value ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}
        >
          {value ? 'Activo' : 'Inactivo'}
        </div>
      )
    }

    // Default rendering
    return (
      <div
        style={{
          color: '#ffffff',
          fontFamily: "'Inter', sans-serif",
          fontSize: '14px',
        }}
      >
        {value != null ? String(value) : '-'}
      </div>
    )
  }

  if (loading) {
    return (
      <GlassCard className="p-12">
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-block',
              width: '40px',
              height: '40px',
              border: '3px solid rgba(255,255,255,0.1)',
              borderTopColor: '#C8A97E',
              borderRadius: '9999px',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p
            style={{
              marginTop: '16px',
              color: 'rgba(255,255,255,0.5)',
              fontFamily: "'Inter', sans-serif",
              fontSize: '14px',
            }}
          >
            Cargando...
          </p>
        </div>
      </GlassCard>
    )
  }

  if (data.length === 0) {
    return (
      <GlassCard className="p-12">
        <p
          style={{
            textAlign: 'center',
            color: 'rgba(255,255,255,0.4)',
            fontFamily: "'Inter', sans-serif",
            fontSize: '14px',
          }}
        >
          {emptyMessage}
        </p>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="overflow-hidden">
      {/* Table header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: columns.map(col => col.width || '1fr').join(' '),
          background: 'rgba(255,255,255,0.05)',
          padding: '12px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {columns.map((col, _idx) => (
          <div
            key={String(col.key)}
            style={{
              textAlign: col.align || 'left',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {col.label}
          </div>
        ))}
      </div>

      {/* Table rows */}
      <div>
        {data.map((row, rowIndex) => (
          <motion.div
            key={getRowKey(row, rowIndex)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: rowIndex * 0.05 }}
            style={{
              display: 'grid',
              gridTemplateColumns: columns.map(col => col.width || '1fr').join(' '),
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              cursor: onRowClick ? 'pointer' : 'default',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
            onClick={() => onRowClick?.(row, rowIndex)}
          >
            {columns.map((col, colIndex) => (
              <div
                key={String(col.key)}
                style={{
                  textAlign: col.align || 'left',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {renderCell(col, row, rowIndex, colIndex)}
              </div>
            ))}
          </motion.div>
        ))}
      </div>
    </GlassCard>
  )
}