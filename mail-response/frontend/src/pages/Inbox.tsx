import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { EmailCard } from '../components/EmailCard'

interface Props {
  onViewDraft: (id: string) => void
}

export function Inbox({ onViewDraft }: Props) {
  const qc = useQueryClient()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [autoRunning, setAutoRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Emails déjà pris en charge dans cette session (traités ou en cours),
  // pour éviter de relancer le pipeline à chaque rafraîchissement.
  const handledRef = useRef<Set<string>>(new Set())
  // Verrou : une seule boucle d'auto-traitement active à la fois.
  const loopRef = useRef(false)

  const { data: emails, isLoading, isError } = useQuery({
    queryKey: ['inbox'],
    queryFn: api.getInbox,
    refetchInterval: 60_000,
  })

  // Traitement automatique séquentiel des emails non traités, dès qu'ils
  // apparaissent (au chargement initial et à chaque nouvel email détecté).
  useEffect(() => {
    if (!emails || loopRef.current) return
    const pending = emails.filter(
      (e) => !e.processed && !handledRef.current.has(e.email_id),
    )
    if (pending.length === 0) return

    loopRef.current = true
    setAutoRunning(true)
    void (async () => {
      for (const email of pending) {
        handledRef.current.add(email.email_id)
        setProcessingId(email.email_id)
        try {
          await api.processEmail(email.email_id)
        } catch (err) {
          setError((err as Error).message)
        }
        await qc.invalidateQueries({ queryKey: ['inbox'] })
      }
      setProcessingId(null)
      setAutoRunning(false)
      loopRef.current = false
    })()
  }, [emails, qc])

  // Suppression : déplace l'email vers la corbeille Gmail et le retire de la liste.
  const handleDelete = useCallback(
    async (id: string) => {
      handledRef.current.add(id)
      setDeletingId(id)
      try {
        await api.deleteEmail(id)
        await qc.invalidateQueries({ queryKey: ['inbox'] })
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setDeletingId(null)
      }
    },
    [qc],
  )

  // Clic manuel sur « Traiter » : traite puis ouvre le brouillon.
  const handleManualProcess = useCallback(
    async (id: string) => {
      handledRef.current.add(id)
      setProcessingId(id)
      try {
        await api.processEmail(id)
        await qc.invalidateQueries({ queryKey: ['inbox'] })
        onViewDraft(id)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setProcessingId(null)
      }
    },
    [qc, onViewDraft],
  )

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Boîte de réception</h1>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['inbox'] })}
          style={{
            background: '#f3f4f6',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            padding: '6px 14px',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Actualiser
        </button>
      </div>

      {autoRunning && (
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          color: '#1d4ed8',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{
            width: 14,
            height: 14,
            border: '2px solid #bfdbfe',
            borderTopColor: '#1d4ed8',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'spin 0.8s linear infinite',
          }} />
          Traitement automatique des emails en cours…
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          color: '#dc2626',
          fontSize: 14,
        }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>✕</button>
        </div>
      )}

      {isLoading && (
        <div style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>
          Chargement des emails...
        </div>
      )}

      {isError && (
        <div style={{ textAlign: 'center', color: '#ef4444', padding: 40 }}>
          Impossible de charger la boîte de réception. Vérifiez la connexion à l'API.
        </div>
      )}

      {emails && emails.length === 0 && (
        <div style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>
          Aucun email non lu.
        </div>
      )}

      {emails?.map((email) => (
        <EmailCard
          key={email.email_id}
          email={email}
          onProcess={handleManualProcess}
          onViewDraft={onViewDraft}
          onDelete={handleDelete}
          processing={processingId === email.email_id}
          deleting={deletingId === email.email_id}
        />
      ))}
    </div>
  )
}
