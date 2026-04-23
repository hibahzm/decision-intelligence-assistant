import { useState } from 'react'

export default function QueryBox({ onSubmit, loading, examples }) {
  const [query, setQuery] = useState('')

  const submit = (q) => {
    const text = (q || query).trim()
    if (!text || loading) return
    onSubmit(text)
  }

  return (
    <div style={s.wrap}>
      <div style={s.inputRow}>
        <textarea
          style={s.textarea}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), submit())}
          placeholder="Type a support query or select an example below…"
          rows={3}
          disabled={loading}
        />
        <button
          style={{ ...s.btn, opacity: loading || !query.trim() ? 0.45 : 1 }}
          onClick={() => submit()}
          disabled={loading || !query.trim()}
        >
          {loading
            ? <><Spinner /> Thinking…</>
            : <><span>▶</span> Run</>
          }
        </button>
      </div>

      {examples && (
        <div style={s.examples}>
          <span style={s.exLabel}>Try:</span>
          {examples.map((ex, i) => (
            <button
              key={i}
              style={s.exBtn}
              onClick={() => { setQuery(ex.query); submit(ex.query) }}
              disabled={loading}
              title={ex.hint}
            >
              {ex.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return <span style={{ display:'inline-block', width:12, height:12, border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin 0.7s linear infinite', marginRight:6 }} />
}

const s = {
  wrap: { marginBottom: 24 },
  inputRow: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  textarea: {
    flex: 1, background: 'var(--surface)', border: '1px solid var(--border2)',
    borderRadius: 10, color: 'var(--text)', fontSize: 14, padding: '13px 16px',
    resize: 'none', fontFamily: 'inherit', outline: 'none', lineHeight: 1.6,
    transition: 'border-color 0.15s',
  },
  btn: {
    background: 'var(--teal)', color: '#080a0f', border: 'none', borderRadius: 10,
    padding: '13px 22px', fontWeight: 700, fontSize: 14, display: 'flex',
    alignItems: 'center', gap: 6, whiteSpace: 'nowrap', transition: 'opacity 0.15s',
    fontFamily: 'inherit',
  },
  examples: { marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  exLabel:  { fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' },
  exBtn: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 6, color: 'var(--muted2)', fontSize: 12, padding: '5px 11px',
    transition: 'all 0.15s', fontFamily: 'inherit',
  },
}
