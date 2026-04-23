import { useState } from 'react'
import QueryBox from './QueryBox'
import { fetchMlPrediction, fetchLlmPrediction } from '../services/api'

const EXAMPLES = [
  { label: 'URGENT (obvious)',   query: 'MY INTERNET HAS BEEN DOWN FOR 3 DAYS AND NO ONE IS HELPING!!!', hint: 'Both should catch this' },
  { label: 'Urgent (subtle)',    query: 'I have been waiting for my refund since last month. Still nothing.', hint: 'LLM should catch this better than ML' },
  { label: 'Normal request',    query: 'Hi, could you tell me how to update my billing address?',            hint: 'Both should say normal' },
  { label: 'Polite but urgent', query: 'Hello, I kindly wanted to follow up on my case from two weeks ago. I really need this resolved.', hint: 'ML may miss this — no keywords' },
  { label: 'Angry but normal',  query: 'This is so annoying! Why is your website so slow today??',           hint: 'Frustrated but not truly urgent' },
]

export default function PriorityMode() {
  const [mlData,  setMlData]  = useState(null)
  const [llmData, setLlmData] = useState(null)
  const [loading, setLoading] = useState({ ml: false, llm: false })
  const [error,   setError]   = useState(null)

  const run = async (q) => {
    setError(null)
    setMlData(null)
    setLlmData(null)
    setLoading({ ml: true, llm: true })

    // Run both in parallel, update each as they arrive
    Promise.all([
      fetchMlPrediction(q)
        .then(d => { setMlData(d);  setLoading(l => ({ ...l, ml:  false })) })
        .catch(e => { setError(e.message); setLoading(l => ({ ...l, ml: false })) }),
      fetchLlmPrediction(q)
        .then(d => { setLlmData(d); setLoading(l => ({ ...l, llm: false })) })
        .catch(e => { setError(e.message); setLoading(l => ({ ...l, llm: false })) }),
    ])
  }

  const bothDone = mlData && llmData
  const agree    = bothDone && mlData.label === llmData.label

  return (
    <div>
      <QueryBox onSubmit={run} loading={loading.ml && loading.llm} examples={EXAMPLES} />
      {error && <div style={s.error}>⚠ {error}</div>}

      <div style={s.grid}>
        <PredictorCard
          name="ML Classifier"
          desc="Trained on engineered features"
          color="var(--teal)"
          data={mlData}
          loading={loading.ml}
          stats={[
            { label: 'Latency',    value: mlData ? `${mlData.latency_ms?.toFixed(1)} ms` : '—' },
            { label: 'Cost/call',  value: '$0.000000' },
            { label: 'Cost/10k',   value: '$0.00' },
          ]}
          note="Reproduces labeling rule + minor generalization. Fast and free forever."
        />

        <PredictorCard
          name="LLM Zero-shot"
          desc="GPT reads the text directly"
          color="var(--purple)"
          data={llmData}
          loading={loading.llm}
          stats={[
            { label: 'Latency',    value: llmData ? `${llmData.latency_ms?.toFixed(0)} ms` : '—' },
            { label: 'Cost/call',  value: llmData ? `$${llmData.cost_usd?.toFixed(6)}` : '—' },
            { label: 'Cost/10k',   value: llmData ? `$${(llmData.cost_usd * 10000).toFixed(2)}` : '—' },
          ]}
          note="Real language understanding. Catches nuance the ML model misses."
        />
      </div>

      {bothDone && (
        <div style={{ ...s.verdict, background: agree ? 'var(--green-dim)' : 'var(--amber-dim)', border: `1px solid ${agree ? 'rgba(52,211,153,0.25)' : 'rgba(245,166,35,0.25)'}` }}>
          <div style={{ ...s.verdictTitle, color: agree ? 'var(--green)' : 'var(--amber)' }}>
            {agree ? '✓ Both models agree' : '⚡ Models disagree'}
          </div>
          <div style={s.verdictText}>
            {agree
              ? `Both predict: ${mlData.label.toUpperCase()} — high confidence in this classification.`
              : `ML says ${mlData.label.toUpperCase()} · LLM says ${llmData.label.toUpperCase()}. Disagreement often means the ticket is subtle. The LLM likely understands the nuance better — this is exactly the gap we're measuring.`
            }
          </div>
          <div style={s.speedup}>
            LLM is <strong>{(llmData.latency_ms / Math.max(mlData.latency_ms, 0.1)).toFixed(0)}×</strong> slower than ML
          </div>
        </div>
      )}
    </div>
  )
}

function PredictorCard({ name, desc, color, data, loading, stats, note }) {
  const urgent = data?.label === 'urgent'

  return (
    <div style={{ ...s.card, borderTop: `2px solid ${color}` }}>
      <div style={s.cardName}>{name}</div>
      <div style={s.cardDesc}>{desc}</div>

      {loading && (
        <div style={s.loadRow}>
          <span style={{ ...s.spinner, borderTopColor: color }} />
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>predicting…</span>
        </div>
      )}

      {data && !loading && (
        <>
          <div style={{ ...s.label, background: urgent ? 'var(--red-dim)' : 'var(--green-dim)', color: urgent ? 'var(--red)' : 'var(--green)', border: `1px solid ${urgent ? 'rgba(255,92,92,0.25)' : 'rgba(52,211,153,0.25)'}` }}>
            {urgent ? '● URGENT' : '○ NORMAL'}
          </div>

          <div style={s.confRow}>
            <span style={s.confLabel}>Confidence</span>
            <div style={s.confBar}>
              <div style={{ ...s.confFill, width: `${data.confidence * 100}%`, background: color }} />
            </div>
            <span style={s.confNum}>{(data.confidence * 100).toFixed(0)}%</span>
          </div>

          <div style={s.statsGrid}>
            {stats.map(st => (
              <div key={st.label} style={s.stat}>
                <div style={s.statLabel}>{st.label}</div>
                <div style={s.statValue}>{st.value}</div>
              </div>
            ))}
          </div>

          <div style={s.note}>{note}</div>
        </>
      )}
    </div>
  )
}

const s = {
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px' },
  cardName: { fontWeight: 600, fontSize: 14, marginBottom: 3 },
  cardDesc: { fontSize: 11, color: 'var(--muted)', marginBottom: 16 },
  loadRow:  { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' },
  spinner:  { width: 14, height: 14, border: '2px solid var(--border2)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 },
  label: { borderRadius: 8, padding: '10px 14px', fontSize: 16, fontWeight: 700, textAlign: 'center', marginBottom: 16, fontFamily: 'var(--mono)' },
  confRow:   { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 },
  confLabel: { fontSize: 11, color: 'var(--muted)', width: 70, flexShrink: 0 },
  confBar:   { flex: 1, height: 5, background: 'var(--border2)', borderRadius: 3, overflow: 'hidden' },
  confFill:  { height: '100%', borderRadius: 3, transition: 'width 0.5s ease' },
  confNum:   { fontSize: 12, color: 'var(--muted2)', fontFamily: 'var(--mono)', width: 35, textAlign: 'right' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 },
  stat:      { background: 'var(--surface2)', borderRadius: 7, padding: '8px 10px', textAlign: 'center' },
  statLabel: { fontSize: 10, color: 'var(--muted)', marginBottom: 3 },
  statValue: { fontSize: 12, fontWeight: 600, fontFamily: 'var(--mono)' },
  note:      { fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 10 },
  verdict:   { borderRadius: 10, padding: '16px 20px' },
  verdictTitle: { fontWeight: 700, fontSize: 14, marginBottom: 6 },
  verdictText:  { fontSize: 13, color: 'var(--muted2)', lineHeight: 1.6, marginBottom: 10 },
  speedup:      { fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' },
  error: { background: 'var(--red-dim)', border: '1px solid rgba(255,92,92,0.3)', borderRadius: 8, padding: '12px 16px', color: 'var(--red)', fontSize: 13, marginBottom: 16 },
}
