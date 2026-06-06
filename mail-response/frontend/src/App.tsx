import React, { useState } from 'react'
import { Inbox } from './pages/Inbox'
import { Review } from './pages/Review'

type View = { page: 'inbox' } | { page: 'review'; emailId: string }

export default function App() {
  const [view, setView] = useState<View>({ page: 'inbox' })

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <header style={{
        background: '#1e293b',
        color: '#fff',
        padding: '0 24px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <button
          onClick={() => setView({ page: 'inbox' })}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}
        >
          Email Agent
        </button>
        <span style={{ color: '#64748b', fontSize: 13 }}>|</span>
        <span style={{ color: '#94a3b8', fontSize: 13 }}>
          {view.page === 'inbox' ? 'Boîte de réception' : 'Révision du brouillon'}
        </span>
      </header>

      <main>
        {view.page === 'inbox' && (
          <Inbox
            onViewDraft={(id) => setView({ page: 'review', emailId: id })}
          />
        )}
        {view.page === 'review' && (
          <Review
            emailId={view.emailId}
            onBack={() => setView({ page: 'inbox' })}
            onSent={() => setView({ page: 'inbox' })}
          />
        )}
      </main>
    </div>
  )
}
