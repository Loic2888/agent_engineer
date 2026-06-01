import { useEffect, useState } from 'react'
import { fetchHistory, fetchHistoryItem, deleteHistoryItem } from '../lib/api'
import type { HistoryItem, HistoryDetail } from '../lib/api'

type Props = {
  refreshTrigger: number
  onSelect: (item: HistoryDetail) => void
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr + 'Z').getTime()) / 1000)
  if (diff < 60) return 'à l\'instant'
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
  return `il y a ${Math.floor(diff / 86400)} j`
}

export default function HistoryPanel({ refreshTrigger, onSelect }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    try {
      const data = await fetchHistory()
      setItems(data)
    } catch {
      // silently ignore — backend may not be ready yet
    }
  }

  useEffect(() => { load() }, [refreshTrigger])

  async function handleSelect(item: HistoryItem) {
    if (activeId === item.id) return
    setLoading(true)
    try {
      const detail = await fetchHistoryItem(item.id)
      setActiveId(item.id)
      onSelect(detail)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(e: React.MouseEvent, id: number) {
    e.stopPropagation()
    await deleteHistoryItem(id)
    if (activeId === id) setActiveId(null)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  return (
    <aside className="w-72 shrink-0 flex flex-col bg-white border-r border-gray-200 h-screen sticky top-0 overflow-hidden">
      <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Historique</h2>
        <button
          onClick={load}
          title="Rafraîchir"
          className="text-gray-400 hover:text-gray-600 transition-colors text-xs"
        >
          ↻
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-xs text-gray-400 text-center">
            Aucune recherche pour l'instant
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {items.map((item) => (
              <li
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`group relative px-4 py-3 cursor-pointer transition-colors ${
                  activeId === item.id
                    ? 'bg-indigo-50 border-l-2 border-indigo-500'
                    : 'hover:bg-gray-50 border-l-2 border-transparent'
                } ${loading ? 'pointer-events-none opacity-60' : ''}`}
              >
                <p className="text-sm text-gray-800 line-clamp-2 pr-5 leading-snug">
                  {item.query}
                </p>
                <p className="text-xs text-gray-400 mt-1">{timeAgo(item.created_at)}</p>

                <button
                  onClick={(e) => handleDelete(e, item.id)}
                  title="Supprimer"
                  className="absolute right-3 top-3 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-sm leading-none"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
