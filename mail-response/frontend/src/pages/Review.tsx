import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../api'
import { DiffViewer } from '../components/DiffViewer'
import { ContactBadge } from '../components/ContactBadge'

interface Props {
  emailId: string
  onBack: () => void
  onSent: () => void
}

const TYPE_LABELS: Record<string, string> = {
  rdv: 'Rendez-vous',
  reclamation: 'Réclamation',
  info: 'Information',
  spam: 'Spam',
  hors_scope: 'Hors scope',
}

export function Review({ emailId, onBack, onSent }: Props) {
  const [edited, setEdited] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [showRegen, setShowRegen] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const { data: draft, isLoading, refetch } = useQuery({
    queryKey: ['draft', emailId],
    queryFn: () => api.getDraft(emailId),
  })

  const approveMutation = useMutation({
    mutationFn: () => api.approveEmail(emailId, edited ?? undefined),
    onSuccess: () => {
      setSuccessMsg('Email envoyé avec succès !')
      setTimeout(onSent, 2000)
    },
    onError: (err: Error) => setErrorMsg(err.message),
  })

  const regenMutation = useMutation({
    mutationFn: () => api.regenerateEmail(emailId, instruction),
    onSuccess: (data) => {
      setEdited(data.draft_response)
      setInstruction('')
      setShowRegen(false)
      refetch()
    },
    onError: (err: Error) => setErrorMsg(err.message),
  })

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
        Chargement du brouillon...
      </div>
    )
  }

  if (!draft) return null

  const currentDraft = edited ?? draft.draft_response
  const contact = draft.contact as Record<string, unknown> | null

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', marginBottom: 20, fontSize: 14 }}
      >
        ← Retour à la boîte de réception
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{draft.original_subject}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {contact && (
              <ContactBadge
                email={contact.email as string}
                name={contact.name as string | null}
                isNew={false}
                emailCount={contact.email_count as number}
              />
            )}
            {draft.email_type && (
              <span style={{
                background: '#eff6ff',
                color: '#1d4ed8',
                borderRadius: 12,
                padding: '2px 10px',
                fontSize: 12,
                fontWeight: 600,
              }}>
                {TYPE_LABELS[draft.email_type] || draft.email_type}
              </span>
            )}
            {draft.tone && (
              <span style={{
                background: '#f3f4f6',
                color: '#374151',
                borderRadius: 12,
                padding: '2px 10px',
                fontSize: 12,
              }}>
                Ton : {draft.tone}
              </span>
            )}
          </div>
          {draft.intent && (
            <div style={{ color: '#6b7280', fontSize: 13, marginTop: 8 }}>
              <strong>Intention :</strong> {draft.intent}
            </div>
          )}
          {draft.missing_info?.length > 0 && (
            <div style={{
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: 6,
              padding: '8px 12px',
              marginTop: 8,
              fontSize: 13,
              color: '#92400e',
            }}>
              <strong>Infos manquantes :</strong> {draft.missing_info.join(', ')}
            </div>
          )}
        </div>
      </div>

      {successMsg && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, marginBottom: 16, color: '#166534' }}>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, marginBottom: 16, color: '#dc2626' }}>
          {errorMsg}
          <button onClick={() => setErrorMsg(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>✕</button>
        </div>
      )}

      <DiffViewer original={draft.original_body} draft={currentDraft} />

      <div style={{ marginTop: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Éditer la réponse</div>
        {editMode ? (
          <textarea
            value={currentDraft}
            onChange={(e) => setEdited(e.target.value)}
            style={{
              width: '100%',
              minHeight: 200,
              border: '1px solid #d1d5db',
              borderRadius: 8,
              padding: 12,
              fontSize: 14,
              lineHeight: 1.6,
              fontFamily: 'monospace',
              resize: 'vertical',
            }}
          />
        ) : (
          <button
            onClick={() => setEditMode(true)}
            style={{
              background: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              padding: '6px 14px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Modifier manuellement
          </button>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        {!showRegen ? (
          <button
            onClick={() => setShowRegen(true)}
            style={{
              background: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              padding: '6px 14px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Régénérer avec instruction
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Ex: Rends le ton plus formel, ajoute une formule de politesse..."
              style={{
                flex: 1,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 13,
              }}
            />
            <button
              onClick={() => regenMutation.mutate()}
              disabled={!instruction || regenMutation.isPending}
              style={{
                background: '#7c3aed',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {regenMutation.isPending ? 'Génération...' : 'Régénérer'}
            </button>
            <button
              onClick={() => setShowRegen(false)}
              style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 13 }}
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button
          onClick={() => approveMutation.mutate()}
          disabled={approveMutation.isPending}
          style={{
            background: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 24px',
            cursor: approveMutation.isPending ? 'wait' : 'pointer',
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          {approveMutation.isPending ? 'Envoi...' : 'Approuver et envoyer'}
        </button>
        <button
          onClick={onBack}
          style={{
            background: '#fff',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            padding: '10px 24px',
            cursor: 'pointer',
            fontSize: 15,
          }}
        >
          Abandonner
        </button>
      </div>
    </div>
  )
}
