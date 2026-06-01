import type { Source } from '../lib/api'

type Props = {
  source: Source
  index: number
}

export default function SourceCard({ source, index }: Props) {
  const snippet = (source.scraped_content || source.content || '').slice(0, 200)
  const domain = (() => {
    try {
      return new URL(source.url).hostname
    } catch {
      return source.url
    }
  })()

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-600">
          [{index}]
        </span>
        <div className="min-w-0">
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-gray-800 hover:text-indigo-600 line-clamp-1"
          >
            {source.title || domain}
          </a>
          <p className="text-xs text-gray-400 mb-1">{domain}</p>
          {snippet && <p className="text-xs text-gray-600 line-clamp-2">{snippet}…</p>}
        </div>
      </div>
    </div>
  )
}
