const BASE = '/api'

async function post(endpoint, body) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const fetchRagAnswer    = (query)          => post('/rag-answer', { query })
export const fetchNonRagAnswer = (query)          => post('/non-rag-answer', { query })
export const fetchMlPrediction = (query)          => post('/predict/ml', { query })
export const fetchLlmPrediction= (query)          => post('/predict/llm', { query })
export const fetchSources      = (query, top_k=5) => post('/retrieve', { query, top_k })
export const fetchFullComparison=(query)          => post('/query', { query })

export const fetchAnswerComparison = async (query) => {
  const [rag, nonRag] = await Promise.all([fetchRagAnswer(query), fetchNonRagAnswer(query)])
  return { rag, nonRag }
}

export const fetchPriorityComparison = async (query) => {
  const [ml, llm] = await Promise.all([fetchMlPrediction(query), fetchLlmPrediction(query)])
  return { ml, llm }
}

export const checkHealth = async () => {
  try { return (await fetch('/health')).ok } catch { return false }
}
