import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Alert } from './api'
import { ActionPanel } from './components/ActionPanel'
import { AlertsFeed } from './components/AlertsFeed'
import { SessionHeader, Timeline } from './components/SessionView'
import { SessionList } from './components/SessionList'
import { cx } from './lib/format'
import { useMonitor, type Conn } from './store'

// Ruta en el hash para poder compartir un enlace a una acción: #/s/<sid>/a/<seq>
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

const CONN: Record<Conn, { text: string; cls: string }> = {
  connecting: { text: 'conectando', cls: 'bg-zinc-400' },
  live: { text: 'en vivo', cls: 'bg-emerald-500' },
  reconnecting: { text: 'reconectando', cls: 'bg-amber-500 animate-pulse' },
  error: { text: 'sin conexión con owit monitor', cls: 'bg-red-600' },
}

export default function App() {
  const { state, openSession, reloadAll } = useMonitor()
  const { sid, seq, go } = useRoute()
  const now = useNow()

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

  // sin selección: abre la sesión más reciente
  useEffect(() => {
    if (!sid && sessions.length) go(sessions[0].sid)
  }, [sid, sessions, go])

  const current = sid ? state.sessions[sid] : undefined
  const entries = sid ? state.entries[sid] : undefined
  const actionVersion = JSON.stringify(entries?.find((e) => e.seq === seq)?.verdict ?? null)
  const failing = sessions.filter((s) => s.integrity.status === 'fail').length

  const openAlert = (a: Alert) => {
    const isAction = entries !== undefined && a.sid === sid
    go(a.sid, a.type === 'tool_injected' || (isAction && a.type === 'anomaly') ? a.seq : null)
  }

  const jump = (target: number) => {
    document.getElementById(`e-${target}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  return (
    <div className="flex h-dvh flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-bold tracking-tight">Open Witness</span>
          <span className="text-sm text-zinc-500">monitor</span>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          <span className={cx('size-2 rounded-full', CONN[state.conn].cls)} />
          {CONN[state.conn].text}
        </span>
        <span className="text-xs text-zinc-500">
          {sessions.length} sesiones
          {failing > 0 && <span className="ml-1 font-semibold text-red-600">· {failing} con la bitácora en FALLA</span>}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
          {state.health?.no_content && (
            <span className="rounded bg-zinc-200 px-1.5 py-0.5 font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              sin contenido
            </span>
          )}
          {state.health && (
            <span title={state.health.data}>
              solo lectura · llave del gateway: {state.health.pubkey_source}
            </span>
          )}
        </div>
      </header>
      {state.error && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs text-red-700 dark:text-red-300">
          {state.error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)_21rem] 2xl:grid-cols-[19rem_minmax(0,1fr)_26rem]">
        <nav className="min-h-0 overflow-y-auto border-r border-zinc-200 dark:border-zinc-800">
          <div className="px-4 pt-3 pb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">Sesiones</div>
          <SessionList sessions={sessions} selected={sid} onSelect={(s) => go(s)} now={now} />
        </nav>

        <main className="flex min-h-0 flex-col">
          {current ? (
            <>
              <SessionHeader s={current} onVerified={reloadAll} />
              <div className="min-h-0 flex-1 overflow-y-auto">
                <Timeline
                  sid={current.sid}
                  entries={entries}
                  fresh={state.fresh}
                  now={now}
                  selectedSeq={seq}
                  onOpenAction={(n) => go(current.sid, n)}
                />
              </div>
            </>
          ) : (
            <div className="grid h-full place-items-center p-8 text-sm text-zinc-500">
              {state.conn === 'error'
                ? 'No se pudo conectar. ¿Está corriendo `owit monitor`?'
                : 'Elige una sesión para ver su línea de tiempo.'}
            </div>
          )}
        </main>

        <div className="min-h-0 border-l border-zinc-200 dark:border-zinc-800">
          {sid && seq !== null ? (
            <ActionPanel sid={sid} seq={seq} version={actionVersion} onClose={() => go(sid)} onJump={jump} />
          ) : (
            <AlertsFeed alerts={alerts} sessions={state.sessions} now={now} onOpen={openAlert} />
          )}
        </div>
      </div>
    </div>
  )
}
