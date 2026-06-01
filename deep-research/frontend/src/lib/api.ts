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
