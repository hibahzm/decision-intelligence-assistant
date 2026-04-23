import { useState } from 'react'
import QueryBox from './QueryBox'
import { fetchFullComparison } from '../services/api'

const EXAMPLES = [
  { label: 'Lost package',   query: 'Customer says their order never arrived, tracking shows delivered',     hint: 'Good for RAG — real cases exist' },
  { label: 'Double charge',  query: 'I was charged twice and want an immediate refund',                      hint: 'Urgent + RAG shows past resolutions' },
  { label: 'App crash',      query: 'Your app crashes every single time I try to open it on iPhone',         hint: 'Specific complaint — RAG helps with context' },
  { label: 'General tone',   query: 'How should I respond to a very angry customer who is shouting at me?',  hint: 'General — LLM may win over RAG here' },
]

export default function CompareMode() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const run = async (q) => {
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetchFullComparison(q)
      setData(res)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  return (
    <div>
      <QueryBox onSubmit={run} loading={loading} examples={EXAMPLES} />
      {error && <div style={s.error}>⚠ {error}</div>}

      {loading && (
        <div style={s.loadBox}>
          <span style={s.spinner} />
          <div>
            <div style={s.loadTitle}>Running all 4 models in parallel…</div>
            <div style={s.loadSub}>RAG retrieval · Non-RAG generation · ML prediction · LLM zero-shot</div>
          </div>
        </div>
      )}

      {data && !loading && (
        <div className="fade-up">
          <SectionTitle>Answer Quality — RAG vs Non-RAG</SectionTitle>
          <div style={s.answerGrid}>
            <AnswerCard
              label="RAG Answer"
              sublabel="LLM + past cases"
              color="var(--teal)"
              text={data.rag_answer?.text}
              latency={data.rag_answer?.latency_ms}
              cost={data.rag_answer?.cost_usd ?? 0}
              badge={data.rag_answer?.low_similarity_warning
                ? { text: `Low similarity (${data.rag_answer?.top_similarity?.toFixed(2)}) — sources may be off-topic`, warn: true }
                : { text: `Top match: ${data.rag_answer?.top_similarity?.toFixed(2)}`, warn: false }
              }
            />
            <AnswerCard
              label="Non-RAG Answer"
              sublabel="LLM alone — no context"
              color="var(--purple)"
              text={data.non_rag_answer?.text}
              latency={data.non_rag_answer?.latency_ms}
              cost={data.non_rag_answer?.cost_usd}
            />
          </div>

          {/* Sources */}
          {data.rag_answer?.sources?.length > 0 && (
            <SourcesMini sources={data.rag_answer.sources} />
          )}

          {/* Priority comparison */}
          <SectionTitle style={{ marginTop: 24 }}>Priority Prediction — ML vs LLM</SectionTitle>
          <div style={s.priorityGrid}>
            <PriorityCard
              name="ML Classifier"
              color="var(--teal)"
              label={data.ml_prediction?.label}
              confidence={data.ml_prediction?.confidence}
              latency={data.ml_prediction?.latency_ms}
              cost={0}
            />
            <PriorityCard
              name="LLM Zero-shot"
              color="var(--purple)"
              label={data.llm_prediction?.label}
              confidence={data.llm_prediction?.confidence}
              latency={data.llm_prediction?.latency_ms}
              cost={data.llm_prediction?.cost_usd}
            />
            <ScaleCard data={data} />
          </div>

          <Recommendation data={data} />
        </div>
      )}
    </div>
  )
}

// ---------- Shared Components ----------

function SectionTitle({ children, style }) {
  return <div style={{ ...s.sectionTitle, ...style }}>{children}</div>
}

function AnswerCard({ label, sublabel, color, text, latency, cost, badge }) {
  const [collapsed, setCollapsed] = useState(false)

  // Split text into paragraphs and lines
  const blocks = text?.split(/\n\s*\n/).flatMap(block => 
    block.split('\n').map(line => line.trim()).filter(l => l)
  ) || []

  return (
    <div style={{ ...s.card, borderTop: `2px solid ${color}` }}>
      {/* Header with label, sublabel, meta chips */}
      <div style={s.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 4, height: 28, background: color, borderRadius: 2 }} />
          <div>
            <div style={{ ...s.cardLabel, color }}>
              {label === 'RAG Answer' ? '📚 ' : '🤖 '}{label}
            </div>
            {sublabel && <div style={s.cardSub}>{sublabel}</div>}
          </div>
        </div>
        <div style={s.cardMeta}>
          <Chip>{latency?.toFixed(0) || '—'} ms</Chip>
          <Chip>{cost === 0 ? '$0' : `$${cost?.toFixed(5)}`}</Chip>
          <button style={s.collapseBtn} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? 'expand' : 'collapse'}
          </button>
        </div>
      </div>

      {/* Badge (similarity warning / info) */}
      {badge && (
        <div style={{ ...s.badge, background: badge.warn ? 'var(--amber-dim)' : 'var(--teal-dim)', color: badge.warn ? 'var(--amber)' : 'var(--teal)' }}>
          {badge.warn ? '⚠' : '✓'} {badge.text}
        </div>
      )}

      {/* Answer body (collapsible) */}
      {!collapsed && (
        <div style={s.cardBody}>
          {blocks.map((block, idx) => {
            const isBullet = /^[-•*]\s/.test(block)
            const isCommand = /^\$\s|^> /.test(block)
            return (
              <div key={idx} style={{ marginBottom: 8 }}>
                {isCommand ? (
                  <code style={s.command}>{block.slice(2)}</code>
                ) : isBullet ? (
                  <div style={s.bullet}>
                    <span style={s.bulletDot}>•</span>
                    <span>{block.replace(/^[-•*]\s+/, '')}</span>
                  </div>
                ) : (
                  <p style={s.paragraph}>{block}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PriorityCard({ name, color, label, confidence, latency, cost }) {
  const urgent = label === 'urgent'
  return (
    <div style={{ ...s.card, borderTop: `2px solid ${color}` }}>
      <div style={{ ...s.cardLabel, color, marginBottom: 12 }}>{name}</div>
      <div style={{ ...s.bigLabel, color: urgent ? 'var(--red)' : 'var(--green)', background: urgent ? 'var(--red-dim)' : 'var(--green-dim)' }}>
        {urgent ? '● URGENT' : '○ NORMAL'}
      </div>
      <div style={s.confRow}>
        <div style={s.confBar}><div style={{ ...s.confFill, width: `${(confidence||0)*100}%`, background: color }} /></div>
        <span style={s.confNum}>{((confidence||0)*100).toFixed(0)}%</span>
      </div>
      <div style={s.metaRow}>
        <Chip>{latency?.toFixed(1)} ms</Chip>
        <Chip>{cost === 0 ? '$0 / call' : `$${cost?.toFixed(6)} / call`}</Chip>
      </div>
    </div>
  )
}

function ScaleCard({ data }) {
  const ml  = data.ml_prediction
  const llm = data.llm_prediction
  const ratio = llm?.latency_ms && ml?.latency_ms
    ? (llm.latency_ms / Math.max(ml.latency_ms, 0.1)).toFixed(0)
    : '—'
  const llmCostHour = llm?.cost_usd ? (llm.cost_usd * 10000).toFixed(2) : '—'

  return (
    <div style={{ ...s.card, borderTop: '2px solid var(--amber)' }}>
      <div style={{ ...s.cardLabel, color: 'var(--amber)', marginBottom: 12 }}>At 10,000 tickets / hour</div>
      <div style={s.scaleRows}>
        <ScaleRow label="ML cost"     value="$0.00"          sub="free forever"        good />
        <ScaleRow label="LLM cost"    value={`$${llmCostHour}/hr`} sub={`≈ $${(Number(llmCostHour) * 720).toFixed(0)}/mo`} good={false} />
        <ScaleRow label="Speed ratio" value={`${ratio}×`}    sub="ML is faster"        good />
      </div>
    </div>
  )
}

function ScaleRow({ label, value, sub, good }) {
  return (
    <div style={s.scaleRow}>
      <div style={s.scaleLabel}>{label}</div>
      <div>
        <div style={{ ...s.scaleVal, color: good ? 'var(--green)' : 'var(--amber)' }}>{value}</div>
        <div style={s.scaleSub}>{sub}</div>
      </div>
    </div>
  )
}

function SourcesMini({ sources }) {
  return (
    <div style={s.sources}>
      <div style={s.sourcesTitle}>Sources used by RAG ({sources.length})</div>
      <div style={s.sourcesList}>
        {sources.map((src, i) => (
          <div key={i} style={s.source}>
            <span style={{ ...s.sourceScore, color: src.similarity_score >= 0.7 ? 'var(--teal)' : src.similarity_score >= 0.5 ? 'var(--amber)' : 'var(--red)' }}>
              {(src.similarity_score * 100).toFixed(0)}%
            </span>
            <span style={s.sourceText}>{src.customer_text?.slice(0, 100)}…</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Recommendation({ data }) {
  const ml  = data.ml_prediction
  const llm = data.llm_prediction
  const agree = ml?.label === llm?.label
  const ratio = llm?.latency_ms && ml?.latency_ms
    ? Math.round(llm.latency_ms / Math.max(ml.latency_ms, 0.1))
    : '?'

  return (
    <div style={s.rec}>
      <div style={s.recTitle}>⊞ Engineering Recommendation</div>
      <p style={s.recText}>
        The LLM wins on accuracy — it genuinely understands language and catches nuanced urgency.
        The ML classifier wins on cost ($0) and speed ({ratio}× faster).
        {agree
          ? ` Both agree on "${ml?.label}" for this query, suggesting it's a clear-cut case.`
          : ` They disagree here — a sign the ticket is borderline and worth human review.`
        }
      </p>
      <p style={s.recText}>
        <strong style={{ color: 'var(--text)' }}>Recommended deployment:</strong> Use the ML model for real-time triage at scale.
        Reserve LLM for a second pass only when ML confidence is below 70%. This hybrid approach
        captures hard cases without paying full LLM cost on every ticket.
      </p>
    </div>
  )
}

function Chip({ children }) {
  return <span style={s.chip}>{children}</span>
}

// ---------- Styles ----------
const s = {
  error: { background: 'var(--red-dim)', border: '1px solid rgba(255,92,92,0.3)', borderRadius: 8, padding: '12px 16px', color: 'var(--red)', fontSize: 13, marginBottom: 16 },
  loadBox: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px', display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 },
  spinner: { width: 24, height: 24, border: '2px solid var(--border2)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 },
  loadTitle: { fontWeight: 600, marginBottom: 3 },
  loadSub:   { fontSize: 12, color: 'var(--muted)' },
  sectionTitle: { fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 },
  answerGrid:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 },
  priorityGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 },

  // Card styles
  card:    { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardLabel: { fontWeight: 700, fontSize: 15, marginBottom: 2 },
  cardSub:   { fontSize: 11, color: 'var(--muted)' },
  cardMeta:  { display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 },
  cardBody:  { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 },
  collapseBtn: { background: 'none', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--muted)', fontSize: 11, padding: '3px 9px', cursor: 'pointer' },

  badge: { borderRadius: 5, padding: '5px 9px', fontSize: 11, marginBottom: 10 },
  bullet: { display: 'flex', gap: 8, paddingLeft: 4 },
  bulletDot: { color: 'var(--teal)', flexShrink: 0, marginTop: 2 },
  command: { background: 'var(--surface2)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--teal)' },
  paragraph: { margin: 0, lineHeight: 1.6 },

  chip:  { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', fontSize: 10, color: 'var(--muted2)', fontFamily: 'var(--mono)' },

  bigLabel: { borderRadius: 7, padding: '10px', fontSize: 15, fontWeight: 700, textAlign: 'center', marginBottom: 12, fontFamily: 'var(--mono)' },
  confRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  confBar: { flex: 1, height: 4, background: 'var(--border2)', borderRadius: 2, overflow: 'hidden' },
  confFill:{ height: '100%', borderRadius: 2, transition: 'width 0.5s' },
  confNum: { fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted2)', width: 30, textAlign: 'right' },
  metaRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  scaleRows: { display: 'flex', flexDirection: 'column', gap: 10 },
  scaleRow:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 8 },
  scaleLabel:{ fontSize: 12, color: 'var(--muted)' },
  scaleVal:  { fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', textAlign: 'right' },
  scaleSub:  { fontSize: 10, color: 'var(--muted)', textAlign: 'right' },
  sources:      { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 12 },
  sourcesTitle: { fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 8 },
  sourcesList:  { display: 'flex', flexDirection: 'column', gap: 6 },
  source:       { display: 'flex', gap: 10, alignItems: 'flex-start' },
  sourceScore:  { fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 600, flexShrink: 0, marginTop: 1 },
  sourceText:   { fontSize: 12, color: 'var(--muted2)', lineHeight: 1.5 },
  rec:      { background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '18px 20px' },
  recTitle: { fontWeight: 700, fontSize: 14, color: 'var(--purple)', marginBottom: 10 },
  recText:  { fontSize: 13, color: 'var(--muted2)', lineHeight: 1.7, marginBottom: 8 },
}