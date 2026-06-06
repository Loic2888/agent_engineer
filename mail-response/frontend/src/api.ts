const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Erreur réseau')
  }
  return res.json()
}

export interface EmailInbox {
  email_id: string
  from_address: string
  from_name: string | null
  subject: string
  date: string
  snippet: string
  processed: boolean
  email_type: string | null
}

export interface Draft {
  email_id: string
  original_subject: string
  original_from: string
  original_body: string
  draft_response: string
  tone: string
  intent: string
  email_type: string
  missing_info: string[]
  contact: Record<string, unknown> | null
}

export interface Contact {
  id: string
  email: string
  name: string | null
  company: string | null
  last_seen: string | null
  email_count: number
}

export const api = {
  getInbox: () => req<EmailInbox[]>('/emails/inbox'),
  processEmail: (id: string) => req<Record<string, unknown>>(`/emails/${id}/process`, { method: 'POST' }),
  getDraft: (id: string) => req<Draft>(`/emails/${id}/draft`),
  approveEmail: (id: string, editedResponse?: string) =>
    req<Record<string, unknown>>(`/emails/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ edited_response: editedResponse || null }),
    }),
  regenerateEmail: (id: string, instruction: string) =>
    req<{ draft_response: string }>(`/emails/${id}/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ instruction }),
    }),
  deleteEmail: (id: string) =>
    req<{ success: boolean }>(`/emails/${id}`, { method: 'DELETE' }),
  getContacts: () => req<Contact[]>('/contacts'),
  getContact: (id: string) => req<Record<string, unknown>>(`/contacts/${id}`),
}
