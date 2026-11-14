import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Alert } from './api'
import { ActionView } from './components/ActionView'
import { AlertsFeed } from './components/AlertsFeed'
import { IconMoon, IconSun } from './components/Marks'
import { SessionList } from './components/SessionList'
import { SessionHeader, Timeline } from './components/SessionView'
import { caseNo, cx } from './lib/format'
import { useMonitor, type Conn } from './store'

// Ruta en el hash para compartir un enlace a una acción: #/s/<sid>/a/<seq>
function parseHash(): { sid: string | null; seq: number | null } {
  const m = location.hash.match(/^#\/s\/([^/]+)(?:\/a\/(\d+))?/)
  return { sid: m?.[1] ?? null, seq: m?.[2] ? Number(m[2]) : null }
}

function useRoute() {
  const [r, setR] = useState(parseHash)
  useEffect(() => {
    const f = () => setR(parseHash())
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  const go = useCallback((sid: string | null, seq: number | null = null) => {
    location.hash = sid ? `#/s/${sid}${seq !== null ? `/a/${seq}` : ''}` : ''
  }, [])
  return { ...r, go }
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'light')
  const toggle = useCallback(() => {
    const t = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = t
    try {
      localStorage.setItem('owit-theme', t)
    } catch {
      /* sin almacenamiento: el tema dura lo que la pestaña */
    }
    setTheme(t)
  }, [theme])
  return { theme, toggle }
}

const CONN: Record<Conn, { text: string; tone: string }> = {
  connecting: { text: 'conectando', tone: 'text-ink-3' },
  live: { text: '● en vivo', tone: 'text-seal' },
  reconnecting: { text: '○ reconectando', tone: 'text-ochre animate-pulse' },
  error: { text: '○ sin conexión con owit monitor', tone: 'text-red' },
}

export default function App() {
  const { state, openSession, reloadAll } = useMonitor()
  const { sid, seq, go } = useRoute()
  const now = useNow()
  const { theme, toggle } = useTheme()

  // número de expediente estable: orden de llegada
  const numbers = useMemo(() => {
    const byStart = Object.values(state.sessions).sort((a, b) =>
      (a.first_ts ?? '').localeCompare(b.first_ts ?? '') || a.sid.localeCompare(b.sid),
    )
    return Object.fromEntries(byStart.map((s, i) => [s.sid, i + 1]))
  }, [state.sessions])

  const sessions = useMemo(
    () =>
      Object.values(state.sessions).sort(
        (a, b) =>
          Number(b.integrity.status === 'fail') - Number(a.integrity.status === 'fail') ||
          (b.last_ts ?? '').localeCompare(a.last_ts ?? ''),
      ),
    [state.sessions],
  )
  const alerts = useMemo(() => Object.values(state.alerts), [state.alerts])

  useEffect(() => {
    if (sid && !state.entries[sid]) void openSession(sid)
  }, [sid, state.entries, openSession])

  useEffect(() => {
    if (!sid && sessions.length) go(sessions[0].sid)
  }, [sid, sessions, go])

  const current = sid ? state.sessions[sid] : undefined
  const entries = sid ? state.entries[sid] : undefined
  const actionVersion = JSON.stringify(entries?.find((e) => e.seq === seq)?.verdict ?? null)
  const failing = sessions.filter((s) => s.integrity.status === 'fail').length
  const injected = sessions.reduce((n, s) => n + (s.verdicts.TOOL_INJECTED ?? 0), 0)

  const openAlert = (a: Alert) => {
    const isAction = a.type === 'tool_injected' || a.type === 'anomaly'
    go(a.sid, isAction ? a.seq : null)
  }

  const jump = (target: number) => {
    if (sid) go(sid)
    setTimeout(() => document.getElementById(`e-${target}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60)
  }

  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <header className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-ink px-6 pt-4 pb-3">
        <div className="flex items-baseline gap-3">
          <span className="text-[26px] leading-none font-semibold tracking-tight">Open Witness</span>
          <span className="label text-ink-3">monitor · solo lectura</span>
        </div>
        <span className={cx('label', CONN[state.conn].tone)}>{CONN[state.conn].text}</span>
        <span className="font-mono text-[11px] text-ink-3">
          {sessions.length} expedientes
          {injected > 0 && <span className="text-red"> · {injected} acciones inyectadas</span>}
          {failing > 0 && <span className="font-semibold text-red"> · {failing} bitácora{failing > 1 ? 's' : ''} alterada{failing > 1 ? 's' : ''}</span>}
        </span>
        <div className="ml-auto flex items-center gap-4">
          {state.health?.no_content && <span className="label text-ochre">sin contenido</span>}
          {state.health && (
            <span className="label hidden text-ink-3 normal-case xl:inline" title={state.health.data}>
              llave del gateway: {state.health.pubkey_source}
            </span>
          )}
          <button
            onClick={toggle}
            className="p-1 text-ink-3 hover:text-ink"
            title={theme === 'dark' ? 'papel' : 'carbón'}
            aria-label="cambiar tema"
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
        </div>
      </header>
      {state.error && (
        <div className="border-b border-red/40 bg-red/10 px-6 py-1.5 font-mono text-xs text-red">{state.error}</div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[17rem_minmax(0,1fr)_21rem] 2xl:grid-cols-[19rem_minmax(0,1fr)_25rem]">
        <nav className="min-h-0 overflow-y-auto border-r border-rule">
          <h2 className="label px-5 pt-5 pb-2 text-ink-3">expedientes</h2>
          <SessionList sessions={sessions} numbers={numbers} selected={sid} onSelect={(s) => go(s)} now={now} />
        </nav>

        <main className="flex min-h-0 flex-col">
          {current ? (
            <>
              <SessionHeader s={current} number={numbers[current.sid] ?? 0} onVerified={reloadAll} />
              <div className="min-h-0 flex-1 overflow-y-auto">
                <Timeline
                  sid={current.sid}
                  user={current.user}
                  entries={entries}
                  firstErrorSeq={current.integrity.status === 'fail' ? (current.integrity.first_error_seq ?? 0) : null}
                  fresh={state.fresh}
                  now={now}
                  selectedSeq={seq}
                  onOpenAction={(n) => go(current.sid, n)}
                />
              </div>
            </>
          ) : (
            <div className="grid h-full place-items-center p-8 text-lg text-ink-3 italic">
              {state.conn === 'error' ? '¿Está corriendo owit monitor?' : 'Elige un expediente.'}
            </div>
          )}
        </main>

        <aside className="min-h-0 border-l border-rule">
          <AlertsFeed alerts={alerts} sessions={state.sessions} numbers={numbers} now={now} onOpen={openAlert} />
        </aside>
      </div>

      {sid && seq !== null && (
        <ActionView
          sid={sid}
          seq={seq}
          caseLabel={caseNo(numbers[sid] ?? 0)}
          version={actionVersion}
          onClose={() => go(sid)}
          onJump={jump}
        />
      )}
    </div>
  )
}
