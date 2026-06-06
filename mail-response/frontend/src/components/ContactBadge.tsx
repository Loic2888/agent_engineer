import React from 'react'

interface Props {
  name?: string | null
  email: string
  isNew?: boolean
  emailCount?: number
}

export function ContactBadge({ name, email, isNew, emailCount }: Props) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      background: isNew ? '#fef3c7' : '#eff6ff',
      border: `1px solid ${isNew ? '#fcd34d' : '#bfdbfe'}`,
      borderRadius: 20,
      padding: '4px 12px',
      fontSize: 13,
    }}>
      <div style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: isNew ? '#f59e0b' : '#3b82f6',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: 12,
      }}>
        {(name || email)[0].toUpperCase()}
      </div>
      <div>
        <div style={{ fontWeight: 600 }}>{name || email}</div>
        {name && <div style={{ color: '#6b7280', fontSize: 11 }}>{email}</div>}
      </div>
      {isNew && (
        <span style={{
          background: '#f59e0b',
          color: '#fff',
          borderRadius: 4,
          padding: '1px 6px',
          fontSize: 11,
          fontWeight: 600,
        }}>NOUVEAU</span>
      )}
      {!isNew && emailCount != null && (
        <span style={{ color: '#6b7280', fontSize: 11 }}>{emailCount} email(s)</span>
      )}
    </div>
  )
}
