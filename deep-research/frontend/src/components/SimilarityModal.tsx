import type { SimilarItem } from '../lib/api'

type Props = {
  query: string
  matches: SimilarItem[]
  onViewExisting: (id: number) => void
  onRunNew: () => void
  onClose: () => void
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr + 'Z').getTime()) / 1000)
  if (diff < 60) return "à l'instant"
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
  return `il y a ${Math.floor(diff / 86400)} j`
}

function SimilarityBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color =
    pct >= 90 ? 'bg-red-100 text-red-700' :
    pct >= 70 ? 'bg-orange-100 text-orange-700' :
                'bg-yellow-100 text-yellow-700'
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {pct === 100 ? 'Identique' : `${pct}% similaire`}
    </span>
  )
}

export default function SimilarityModal({ query, matches, onViewExisting, onRunNew, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Recherche similaire trouvée
              </h2>
              <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                « {query} »
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none mt-0.5"
            >
              ×
            </button>
          </div>
        </div>

        {/* Match list */}
        <ul className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
          {matches.map((item) => (
            <li key={item.id} className="px-6 py-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{item.query}</p>
                <p className="text-xs text-gray-400 mt-0.5">{timeAgo(item.created_at)}</p>
              </div>
              <SimilarityBadge score={item.similarity} />
              <button
                onClick={() => onViewExisting(item.id)}
                className="shrink-0 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Voir →
              </button>
            </li>
          ))}
        </ul>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onRunNew}
            className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
          >
            Nouvelle recherche à jour
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 text-sm font-semibold px-4 py-2.5 transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
