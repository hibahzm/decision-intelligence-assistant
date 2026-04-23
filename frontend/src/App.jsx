import { useState, useEffect } from 'react'
import { checkHealth } from './services/api'
import AnswerMode   from './components/AnswerMode'
import PriorityMode from './components/PriorityMode'
import CompareMode  from './components/CompareMode'

const TABS = [
  { id: 'answer',   label: 'Smart Answer',   icon: '◈', desc: 'Ask anything — RAG finds real past cases to ground the answer' },
  { id: 'priority', label: 'Priority Check', icon: '⬡', desc: 'Is this ticket urgent? ML model (~2ms, free) vs LLM (~800ms, $0.001)' },
  { id: 'compare',  label: 'Full Analysis',  icon: '⊞', desc: 'All 4 outputs side by side — the full comparison for your reviewer' },
]

export default function App() {
  const [tab,     setTab]     = useState('answer')
  const [healthy, setHealthy] = useState(null)

  useEffect(() => {
    checkHealth().then(setHealthy).catch(() => setHealthy(false))
  }, [])

  return (
    <div style={s.page}>
      <div style={s.grid} />

      <header style={s.header}>
        <div style={s.headerInner}>
          <div style={s.logo}>
            <div style={s.logoIcon}>DI</div>
            <div>
              <div style={s.logoTitle}>Decision Intelligence</div>
              <div style={s.logoSub}>Customer Support Assistant</div>
            </div>
          </div>
          <div style={s.status}>
            <span style={{ ...s.dot, background: healthy === null ? '#555' : healthy ? 'var(--teal)' : 'var(--red)' }} />
            <span style={s.statusText}>
              {healthy === null ? 'connecting…' : healthy ? 'backend live' : 'backend offline'}
            </span>
          </div>
        </div>
      </header>

      <div style={s.tabBar}>
        <div style={s.tabInner}>
          {TABS.map(t => (
            <button key={t.id} style={{ ...s.tab, ...(tab === t.id ? s.tabActive : {}) }} onClick={() => setTab(t.id)}>
              <span style={s.tabIcon}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={s.desc}>{TABS.find(t => t.id === tab)?.desc}</div>

      <main style={s.main}>
        {tab === 'answer'   && <AnswerMode />}
        {tab === 'priority' && <PriorityMode />}
        {tab === 'compare'  && <CompareMode />}
      </main>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', position: 'relative' },
  grid: {
    position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
    backgroundImage: `linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px)`,
    backgroundSize: '48px 48px',
  },
  header: { position: 'relative', zIndex: 10, borderBottom: '1px solid var(--border)', background: 'rgba(8,10,15,0.85)', backdropFilter: 'blur(16px)' },
  headerInner: { maxWidth: 1100, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logo: { display: 'flex', alignItems: 'center', gap: 12 },
  logoIcon: { width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,var(--teal),var(--purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: 'var(--mono)' },
  logoTitle: { fontSize: 15, fontWeight: 600 },
  logoSub:   { fontSize: 11, color: 'var(--muted)', marginTop: 1 },
  status: { display: 'flex', alignItems: 'center', gap: 7 },
  dot:    { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  statusText: { fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' },
  tabBar: { position: 'relative', zIndex: 10, borderBottom: '1px solid var(--border)', background: 'rgba(14,17,24,0.9)' },
  tabInner: { maxWidth: 1100, margin: '0 auto', padding: '0 20px', display: 'flex', gap: 2 },
  tab: { display: 'flex', alignItems: 'center', gap: 7, padding: '13px 18px', background: 'none', border: 'none', borderBottom: '2px solid transparent', marginBottom: -1, color: 'var(--muted)', fontSize: 13, fontWeight: 500, transition: 'all 0.15s', whiteSpace: 'nowrap' },
  tabActive: { color: 'var(--text)', borderBottomColor: 'var(--teal)' },
  tabIcon: { fontSize: 13 },
  desc: { maxWidth: 1100, margin: '0 auto', padding: '9px 24px', fontSize: 12, color: 'var(--muted)', position: 'relative', zIndex: 10, borderBottom: '1px solid var(--border)' },
  main: { maxWidth: 1100, margin: '0 auto', padding: '28px 24px 80px', position: 'relative', zIndex: 10 },
}
