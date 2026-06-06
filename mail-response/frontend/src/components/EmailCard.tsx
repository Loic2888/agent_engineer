import React from 'react'
import type { EmailInbox } from '../api'

interface Props {
  email: EmailInbox
  onProcess: (id: string) => void
  onViewDraft: (id: string) => void
  onDelete: (id: string) => void
  processing: boolean
  deleting: boolean
}

const TYPE_COLORS: Record<string, string> = {
  rdv: '#3b82f6',
  reclamation: '#ef4444',
  info: '#10b981',
  spam: '#9ca3af',
  hors_scope: '#f59e0b',
}

const TYPE_LABELS: Record<string, string> = {
  rdv: 'Rendez-vous',
  reclamation: 'Réclamation',
  info: 'Information',
  spam: 'Spam',
  hors_scope: 'Hors scope',
}

// Types qui produisent un brouillon de réponse (les autres sont court-circuités).
const HAS_DRAFT = new Set(['rdv', 'reclamation', 'info'])

export function EmailCard({ email, onProcess, onViewDraft, onDelete, processing, deleting }: Props) {
  const date = new Date(email.date).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  const type = email.email_type
  const showDraftButton = email.processed && type != null && HAS_DRAFT.has(type)

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      padding: '16px',
      marginBottom: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      opacity: deleting ? 0.5 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>
              {email.from_name || email.from_address}
              {email.from_name && (
                <span style={{ color: '#6b7280', fontWeight: 400, fontSize: 13 }}> &lt;{email.from_address}&gt;</span>
              )}
            </span>
            {type && (
              <span style={{
                background: TYPE_COLORS[type] || '#9ca3af',
                color: '#fff',
                borderRadius: 10,
                padding: '1px 8px',
                fontSize: 11,
                fontWeight: 600,
              }}>
                {TYPE_LABELS[type] || type}
              </span>
            )}
          </div>
          <div style={{ color: '#374151', marginTop: 2 }}>{email.subject}</div>
          <div style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>{email.snippet}</div>
        </div>
        <div style={{ color: '#9ca3af', fontSize: 12, whiteSpace: 'nowrap', marginLeft: 16 }}>{date}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {!email.processed ? (
          <button
            onClick={() => onProcess(email.email_id)}
            disabled={processing}
            style={{
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '6px 14px',
              cursor: processing ? 'wait' : 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {processing ? 'Traitement...' : 'Traiter'}
          </button>
        ) : showDraftButton ? (
          <button
            onClick={() => onViewDraft(email.email_id)}
            style={{
              background: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '6px 14px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Voir le brouillon
          </button>
        ) : null}

        <button
          onClick={() => onDelete(email.email_id)}
          disabled={deleting}
          style={{
            background: '#fff',
            color: '#dc2626',
            border: '1px solid #fecaca',
            borderRadius: 6,
            padding: '6px 14px',
            cursor: deleting ? 'wait' : 'pointer',
            fontSize: 13,
            fontWeight: 500,
            marginLeft: 'auto',
          }}
          title="Déplacer vers la corbeille Gmail"
        >
          {deleting ? 'Suppression...' : 'Supprimer'}
        </button>
      </div>
    </div>
  )
}
