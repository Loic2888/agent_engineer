import { useState } from 'react'
import SearchBar from './components/SearchBar'
import ProgressSteps from './components/ProgressSteps'
import ReportViewer from './components/ReportViewer'
import HistoryPanel from './components/HistoryPanel'
import SimilarityModal from './components/SimilarityModal'
import { streamResearch, checkSimilarResearch, fetchHistoryItem } from './lib/api'
import type { Source, HistoryDetail, SimilarItem } from './lib/api'

type AppStatus = 'idle' | 'running' | 'complete' | 'error'

const ALL_STEPS = ['planner', 'researcher', 'synthesizer', 'writer_outline', 'editor', 'writer_final']

export default function App() {
  const [status, setStatus] = useState<AppStatus>('idle')
  const [currentStep, setCurrentStep] = useState('')
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [report, setReport] = useState('')
  const [sources, setSources] = useState<Source[]>([])
  const [error, setError] = useState('')
  const [historyRefresh, setHistoryRefresh] = useState(0)

  // Similarity modal state
  const [pendingQuery, setPendingQuery] = useState('')
  const [similarMatches, setSimilarMatches] = useState<SimilarItem[]>([])
  const [showModal, setShowModal] = useState(false)

  async function runResearch(query: string) {
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
        if (event.step === 'saved') {
          setHistoryRefresh((k) => k + 1)
          return
        }

        setCurrentStep(event.step)
        setCompletedSteps((prev) => (prev.includes(event.step) ? prev : [...prev, event.step]))

        if (event.step === 'synthesizer' && Array.isArray(event.data.ranked_sources)) {
          setSources(event.data.ranked_sources as Source[])
        }
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
    </div>
  )
}
