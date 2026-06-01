import { useState } from 'react'
import SearchBar from './components/SearchBar'
import ProgressSteps from './components/ProgressSteps'
import ReportViewer from './components/ReportViewer'
import { streamResearch } from './lib/api'
import type { Source } from './lib/api'

type AppStatus = 'idle' | 'running' | 'complete' | 'error'

export default function App() {
  const [status, setStatus] = useState<AppStatus>('idle')
  const [currentStep, setCurrentStep] = useState('')
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [report, setReport] = useState('')
  const [sources, setSources] = useState<Source[]>([])
  const [error, setError] = useState('')

  async function handleSubmit(query: string) {
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
    </div>
  )
}
