type Props = {
  onSubmit: (query: string) => void
  disabled: boolean
}

export default function SearchBar({ onSubmit, disabled }: Props) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const query = (form.elements.namedItem('query') as HTMLInputElement).value.trim()
    if (query) onSubmit(query)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 w-full">
      <input
        name="query"
        type="text"
        placeholder="Ask a research question…"
        disabled={disabled}
        className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled}
        className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
      >
        Research
      </button>
    </form>
  )
}
