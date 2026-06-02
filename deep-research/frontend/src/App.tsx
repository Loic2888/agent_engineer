import { useState } from 'react'
import SearchBar from './components/SearchBar'
import ProgressSteps from './components/ProgressSteps'
import ReportViewer from './components/ReportViewer'
<<<<<<< HEAD
import { streamResearch } from './lib/api'
import type { Source } from './lib/api'

type AppStatus = 'idle' | 'running' | 'complete' | 'error'

=======
import HistoryPanel from './components/HistoryPanel'
import SimilarityModal from './components/SimilarityModal'
import { streamResearch, checkSimilarResearch, fetchHistoryItem } from './lib/api'
import type { Source, HistoryDetail, SimilarItem } from './lib/api'

type AppStatus = 'idle' | 'running' | 'complete' | 'error'

const ALL_STEPS = ['planner', 'researcher', 'synthesizer', 'writer_outline', 'editor', 'writer_final']

>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d
export default function App() {
  const [status, setStatus] = useState<AppStatus>('idle')
  const [currentStep, setCurrentStep] = useState('')
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [report, setReport] = useState('')
  const [sources, setSources] = useState<Source[]>([])
  const [error, setError] = useState('')
<<<<<<< HEAD

  async function handleSubmit(query: string) {
=======
  const [historyRefresh, setHistoryRefresh] = useState(0)

  // Similarity modal state
  const [pendingQuery, setPendingQuery] = useState('')
  const [similarMatches, setSimilarMatches] = useState<SimilarItem[]>([])
  const [showModal, setShowModal] = useState(false)

  async function runResearch(query: string) {
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d
    setStatus('running')
    setCurrentStep('planner')
    setCompletedSteps([])
    setReport('')
    setSources([])
    setError('')

    await streamResearch(
      query,
      (event) => {
        if (event.step === 'error') {
          setError(String(event.data.error ?? 'Unknown error'))
          setStatus('error')
          return
        }
<<<<<<< HEAD
=======
        if (event.step === 'saved') {
          setHistoryRefresh((k) => k + 1)
          return
        }
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d

        setCurrentStep(event.step)
        setCompletedSteps((prev) => (prev.includes(event.step) ? prev : [...prev, event.step]))

        if (event.step === 'synthesizer' && Array.isArray(event.data.ranked_sources)) {
          setSources(event.data.ranked_sources as Source[])
        }
<<<<<<< HEAD

=======
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d
        if (event.step === 'writer_final' && typeof event.data.report === 'string') {
          setReport(event.data.report)
          setStatus('complete')
        }
      },
      (err) => {
        setError(err.message)
        setStatus('error')
      },
    )
  }

<<<<<<< HEAD
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-12 space-y-10">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
            Deep Research Agent
          </h1>
          <p className="text-gray-500 text-lg">
            Multi-agent pipeline · LangGraph · Claude · Tavily
          </p>
        </div>

        {/* Search */}
        <SearchBar onSubmit={handleSubmit} disabled={status === 'running'} />

        {/* Progress */}
        {(status === 'running' || status === 'complete') && (
          <ProgressSteps currentStep={currentStep} completedSteps={completedSteps} />
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Report */}
        {status === 'complete' && report && (
          <ReportViewer report={report} sources={sources} />
        )}
      </div>
=======
  async function handleSubmit(query: string) {
    const trimmed = query.trim()
    if (!trimmed) return

    const matches = await checkSimilarResearch(trimmed)
    if (matches.length > 0) {
      setPendingQuery(trimmed)
      setSimilarMatches(matches)
      setShowModal(true)
      return
    }

    runResearch(trimmed)
  }

  async function handleViewExisting(id: number) {
    setShowModal(false)
    try {
      const detail = await fetchHistoryItem(id)
      handleLoadHistory(detail)
    } catch {
      setError('Impossible de charger cette recherche.')
      setStatus('error')
    }
  }

  function handleRunNew() {
    setShowModal(false)
    runResearch(pendingQuery)
  }

  function handleLoadHistory(item: HistoryDetail) {
    setReport(item.report)
    setSources(item.sources)
    setStatus('complete')
    setCurrentStep('writer_final')
    setCompletedSteps(ALL_STEPS)
    setError('')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar historique */}
      <HistoryPanel refreshTrigger={historyRefresh} onSelect={handleLoadHistory} />

      {/* Contenu principal */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-12 space-y-10">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
              Deep Research Agent
            </h1>
            <p className="text-gray-500 text-lg">
              Multi-agent pipeline · LangGraph · Gemini · Tavily
            </p>
          </div>

          {/* Search */}
          <SearchBar onSubmit={handleSubmit} disabled={status === 'running'} />

          {/* Progress */}
          {(status === 'running' || status === 'complete') && (
            <ProgressSteps currentStep={currentStep} completedSteps={completedSteps} />
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-red-700">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Report */}
          {status === 'complete' && report && (
            <ReportViewer report={report} sources={sources} />
          )}
        </div>
      </main>

      {/* Similarity modal */}
      {showModal && (
        <SimilarityModal
          query={pendingQuery}
          matches={similarMatches}
          onViewExisting={handleViewExisting}
          onRunNew={handleRunNew}
          onClose={() => setShowModal(false)}
        />
      )}
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d
    </div>
  )
}
