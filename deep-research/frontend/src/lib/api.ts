export type ResearchEvent = {
  step: string
  data: Record<string, unknown>
}

export type Source = {
  url: string
  title: string
  content: string
  scraped_content?: string
  score: number
}

export type HistoryItem = {
  id: number
  query: string
  created_at: string
}

export type SimilarItem = {
  id: number
  query: string
  created_at: string
  similarity: number
}

export type HistoryDetail = {
  id: number
  query: string
  report: string
  sources: Source[]
  created_at: string
}

export async function streamResearch(
  query: string,
  onStep: (event: ResearchEvent) => void,
  onError: (error: Error) => void,
): Promise<void> {
  let response: Response
  try {
    response = await fetch('/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
  } catch (e) {
    onError(e instanceof Error ? e : new Error(String(e)))
    return
  }

  if (!response.ok) {
    onError(new Error(`Server error: ${response.status}`))
    return
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const event = JSON.parse(line.slice(6)) as ResearchEvent
        onStep(event)
      } catch {
        // skip malformed lines
      }
    }
  }
}

export async function fetchHistory(): Promise<HistoryItem[]> {
  const res = await fetch('/history')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function fetchHistoryItem(id: number): Promise<HistoryDetail> {
  const res = await fetch(`/history/${id}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function deleteHistoryItem(id: number): Promise<void> {
  await fetch(`/history/${id}`, { method: 'DELETE' })
}

export async function checkSimilarResearch(query: string): Promise<SimilarItem[]> {
  try {
    const res = await fetch('/history/similar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}
