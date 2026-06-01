import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import SourceCard from './SourceCard'
import type { Source } from '../lib/api'

type Props = {
  report: string
  sources: Source[]
}

export default function ReportViewer({ report, sources }: Props) {
  return (
    <div className="w-full space-y-8">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="prose prose-gray max-w-none prose-headings:text-gray-900 prose-a:text-indigo-600">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
        </div>
      </div>

      {sources.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-bold text-gray-700">
            Sources used ({sources.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {sources.map((source, i) => (
              <SourceCard key={source.url} source={source} index={i + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
