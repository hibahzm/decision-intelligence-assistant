import { useState } from 'react'
import QueryBox from './QueryBox'
import { fetchRagAnswer, fetchNonRagAnswer } from '../services/api'

// Examples designed to show when RAG helps vs doesn't
const EXAMPLES = [
  { label: 'Missing package',   query: 'Customer says their package never arrived — what should I do?',          hint: 'RAG finds real past cases of lost packages' },
  { label: 'Double charge',     query: 'Customer was charged twice for the same order',                          hint: 'RAG finds real resolution approaches' },
  { label: 'App not working',   query: 'Customer says the mobile app keeps crashing on login',                   hint: 'RAG finds specific past tech complaints' },
  { label: 'General (LLM wins)',query: 'What is a good tone to use when responding to an angry customer?',       hint: 'General knowledge — LLM wins, no real cases needed' },
  { label: 'Policy question',   query: 'What is your return policy for damaged items received by the customer?', hint: 'General — LLM answers from training, RAG may not help' },
]

export default function AnswerMode() {
  const [query,    setQuery]    = useState('')
  const [ragData,  setRagData]  = useState(null)
  const [nonRag,   setNonRag]   = useState(null)
  const [loading,  setLoading]  = useState({ rag: false, nonRag: false })
  const [error,    setError]    = useState(null)
  const [showBoth, setShowBoth] = useState(false)
  const [expanded, setExpanded] = useState(null)

  const run = async (q) => {
    setQuery(q)
    setError(null)
    setRagData(null)
    setNonRag(null)
    setShowBoth(false)

    setLoading({ rag: true, nonRag: false })
    try {
      const data = await fetchRagAnswer(q)
      setRagData(data)
    } catch (e) { setError(e.message) }
    setLoading(l => ({ ...l, rag: false }))
  }

  const runNonRag = async () => {
    if (!query) return
    setLoading(l => ({ ...l, nonRag: true }))
    setShowBoth(true)
    try {
      const data = await fetchNonRagAnswer(query)
      setNonRag(data)
    } catch (e) { setError(e.message) }
    setLoading(l => ({ ...l, nonRag: false }))
  }

  return (
    <div>
      <QueryBox onSubmit={run} loading={loading.rag || loading.nonRag} examples={EXAMPLES} />

      {error && <ErrorBox msg={error} />}

      {ragData && (
        <div className="fade-up">
          {/* RAG Answer */}
          <AnswerCard
            label="RAG Answer"
            sublabel="LLM + real past cases"
            color="var(--teal)"
            text={ragData.text}
            latency={ragData.latency_ms}
            cost={ragData.cost_usd}
            badge={ragData.low_similarity_warning
              ? { text: `Low similarity (${ragData.top_similarity?.toFixed(2)}) — sources may be off-topic`, warn: true }
              : { text: `Top match: ${ragData.top_similarity?.toFixed(2)}`, warn: false }
            }
          />

          {/* Sources */}
          {ragData.sources?.length > 0 && (
            <div style={s.sourcesBox}>
              <div style={s.sourcesHeader}>
                <span style={s.sourcesTitle}>Sources used · {ragData.sources.length} past cases</span>
                <span style={s.sourcesHint}>These are the real tweets the LLM read before answering</span>
              </div>
              <div style={s.sourcesList}>
                {ragData.sources.map((src, i) => (
                  <div key={i} style={s.sourceCard}>
                    <div style={s.sourceTop}>
                      <ScoreBar score={src.similarity_score} />
                      <span style={s.scoreNum}>{(src.similarity_score * 100).toFixed(0)}%</span>
                      <PriorityPill label={src.priority_label} />
                    </div>
                    <div style={s.sourceText}>{src.customer_text}</div>
                    {src.company_reply && (
                      <>
                        <button style={s.toggleBtn} onClick={() => setExpanded(expanded === i ? null : i)}>
                          {expanded === i ? '▲ hide' : '▼ show'} company reply
                        </button>
                        {expanded === i && <div style={s.reply}>{src.company_reply}</div>}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compare toggle */}
          {!showBoth && (
            <button style={s.compareBtn} onClick={runNonRag}>
              Compare with Non-RAG answer →
            </button>
          )}

          {/* Non-RAG answer */}
          {showBoth && (
            <div>
              {loading.nonRag
                ? <LoadingCard label="Generating non-RAG answer…" color="var(--purple)" />
                : nonRag && (
                  <AnswerCard
                    label="Non-RAG Answer"
                    sublabel="LLM alone — no context"
                    color="var(--purple)"
                    text={nonRag.text}
                    latency={nonRag.latency_ms}
                    cost={nonRag.cost_usd}
                  />
                )
              }
            </div>
          )}
        </div>
      )}

      {loading.rag && !ragData && (
        <LoadingCard label="Retrieving past cases and generating answer…" color="var(--teal)" />
      )}
    </div>
  )
}
// Inside AnswerMode.jsx, replace the faulty AnswerCard with this:

function AnswerCard({ label, sublabel, color, text, latency, cost, badge }) {
  const [collapsed, setCollapsed] = useState(false)

  const blocks = text?.split(/\n\s*\n/).flatMap(block => 
    block.split('\n').map(line => line.trim()).filter(l => l)
  ) || []

  return (
    <div style={{ ...s.card, borderTop: `2px solid ${color}`, marginBottom: 14 }}>
      {/* Header with label, sublabel, and meta chips */}
      <div style={s.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 4, height: 28, background: color, borderRadius: 2 }} />
          <div>
            <div style={{ ...s.cardLabel, color }}>
              {label === 'RAG Answer' ? '📚 ' : '🧠 '}{label}
            </div>
            <div style={s.cardSub}>{sublabel}</div>
          </div>
        </div>
        <div style={s.cardMeta}>
          <MetaChip value={`${latency?.toFixed(0)} ms`} />
          <MetaChip value={cost === 0 ? '$0' : `$${cost?.toFixed(5)}`} />
          <button style={s.collapseBtn} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? 'expand' : 'collapse'}
          </button>
        </div>
      </div>

      {/* Optional badge */}
      {badge && (
        <div style={{ ...s.badge, background: badge.warn ? 'var(--amber-dim)' : 'var(--teal-dim)', color: badge.warn ? 'var(--amber)' : 'var(--teal)', border: `1px solid ${badge.warn ? 'rgba(245,166,35,0.3)' : 'rgba(0,212,170,0.3)'}` }}>
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


function LoadingCard({ label, color }) {
  return (
    <div style={{ ...s.card, borderTop: `2px solid ${color}`, marginBottom: 14 }}>
      <div style={s.loadingRow}>
        <span style={{ ...s.spinner, borderTopColor: color }} />
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>{label}</span>
      </div>
    </div>
  )
}

function ScoreBar({ score }) {
  const pct = Math.round(score * 100)
  const color = score >= 0.7 ? 'var(--teal)' : score >= 0.5 ? 'var(--amber)' : 'var(--red)'
  return (
    <div style={s.barOuter}>
      <div style={{ ...s.barInner, width: `${pct}%`, background: color }} />
    </div>
  )
}

function PriorityPill({ label }) {
  const urgent = label === 'urgent'
  return (
    <span style={{ ...s.pill, background: urgent ? 'var(--red-dim)' : 'var(--green-dim)', color: urgent ? 'var(--red)' : 'var(--green)', border: `1px solid ${urgent ? 'rgba(255,92,92,0.25)' : 'rgba(52,211,153,0.25)'}` }}>
      {urgent ? '● urgent' : '○ normal'}
    </span>
  )
}

function MetaChip({ value }) {
  return <span style={s.chip}>{value}</span>
}

function ErrorBox({ msg }) {
  return <div style={s.error}>⚠ {msg}</div>
}

const s = {
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', marginBottom: 14 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardLabel: { fontWeight: 600, fontSize: 14 },
  cardSub:   { fontSize: 11, color: 'var(--muted)', marginTop: 2 },
  cardMeta:  { display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 },
  cardBody:  { display: 'flex', flexDirection: 'column', gap: 6 },
  badge: { borderRadius: 6, padding: '6px 10px', fontSize: 12, marginBottom: 12 },
  line:  { fontSize: 14, lineHeight: 1.65, color: 'var(--text)' },
  bullet:{ display: 'flex', gap: 8, paddingLeft: 4 },
  bulletDot: { color: 'var(--teal)', flexShrink: 0, marginTop: 2 },
  chip:  { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 9px', fontSize: 11, color: 'var(--muted2)', fontFamily: 'var(--mono)' },
  collapseBtn: { background: 'none', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--muted)', fontSize: 11, padding: '3px 9px' },
  sourcesBox:  { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 14 },
  sourcesHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sourcesTitle:  { fontSize: 13, fontWeight: 600, color: 'var(--muted2)' },
  sourcesHint:   { fontSize: 11, color: 'var(--muted)' },
  sourcesList:   { display: 'flex', flexDirection: 'column', gap: 10 },
  sourceCard:    { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' },
  sourceTop:     { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  scoreNum:      { fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' },
  sourceText:    { fontSize: 13, color: 'var(--text)', lineHeight: 1.6 },
  barOuter:      { width: 64, height: 4, background: 'var(--border2)', borderRadius: 2, overflow: 'hidden' },
  barInner:      { height: '100%', borderRadius: 2, transition: 'width 0.3s' },
  pill:          { borderRadius: 4, padding: '2px 8px', fontSize: 11, fontFamily: 'var(--mono)' },
  toggleBtn:     { background: 'none', border: 'none', color: 'var(--muted)', fontSize: 11, padding: '6px 0 0', cursor: 'pointer' },
  reply:         { marginTop: 8, padding: '10px 12px', background: 'var(--bg2)', borderRadius: 6, fontSize: 12, color: 'var(--muted2)', lineHeight: 1.6, borderLeft: '2px solid var(--teal)' },
  compareBtn:    { background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--muted2)', fontSize: 13, padding: '11px 18px', marginBottom: 14, transition: 'all 0.15s', fontFamily: 'inherit' },
  loadingRow:    { display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' },
  spinner:       { width: 16, height: 16, border: '2px solid var(--border2)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 },
  error:         { background: 'var(--red-dim)', border: '1px solid rgba(255,92,92,0.3)', borderRadius: 8, padding: '12px 16px', color: 'var(--red)', fontSize: 13, marginBottom: 16 },
}
