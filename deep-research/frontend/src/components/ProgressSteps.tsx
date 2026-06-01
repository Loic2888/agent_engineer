const STEPS = [
  { id: 'planner', label: 'Planner', description: 'Decomposing question into sub-questions' },
  { id: 'researcher', label: 'Researcher', description: 'Collecting and scraping sources' },
  { id: 'synthesizer', label: 'Synthesizer', description: 'Ranking and deduplicating sources' },
  { id: 'writer_outline', label: 'Writer — Outline', description: 'Building report structure' },
  { id: 'editor', label: 'Editor', description: 'Reviewing coverage and coherence' },
  { id: 'writer_final', label: 'Writer — Final', description: 'Writing the full report' },
]

type Props = {
  currentStep: string
  completedSteps: string[]
}

export default function ProgressSteps({ currentStep, completedSteps }: Props) {
  return (
    <div className="w-full space-y-2">
      {STEPS.map((step) => {
        const isComplete = completedSteps.includes(step.id)
        const isActive = currentStep === step.id

        return (
          <div
            key={step.id}
            className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
              isActive
                ? 'bg-indigo-50 border border-indigo-200'
                : isComplete
                ? 'bg-green-50 border border-green-200'
                : 'bg-gray-50 border border-gray-100'
            }`}
          >
            <div
              className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                isActive
                  ? 'bg-indigo-500 text-white animate-pulse'
                  : isComplete
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-300 text-gray-500'
              }`}
            >
              {isComplete ? '✓' : isActive ? '…' : '·'}
            </div>
            <div>
              <p
                className={`text-sm font-semibold ${
                  isActive ? 'text-indigo-700' : isComplete ? 'text-green-700' : 'text-gray-400'
                }`}
              >
                {step.label}
              </p>
              {(isActive || isComplete) && (
                <p className="text-xs text-gray-500">{step.description}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
