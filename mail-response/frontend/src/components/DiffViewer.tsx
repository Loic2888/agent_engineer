import React from 'react'

interface Props {
  original: string
  draft: string
}

export function DiffViewer({ original, draft }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#6b7280',
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Email reçu
        </div>
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 8,
          padding: 16,
          fontSize: 14,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          maxHeight: 400,
          overflowY: 'auto',
          fontFamily: 'monospace',
        }}>
          {original}
        </div>
      </div>

      <div>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#6b7280',
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Réponse générée
        </div>
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 8,
          padding: 16,
          fontSize: 14,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          maxHeight: 400,
          overflowY: 'auto',
          fontFamily: 'monospace',
        }}>
          {draft}
        </div>
      </div>
    </div>
  )
}
