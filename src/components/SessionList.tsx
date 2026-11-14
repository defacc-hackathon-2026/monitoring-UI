import type { SessionSummary } from '../api'
import { ago, cx } from '../lib/format'
import { IntegrityBadge } from './Badges'

export function SessionList({
  sessions,
  selected,
  onSelect,
  now,
}: {
  sessions: SessionSummary[]
  selected: string | null
  onSelect: (sid: string) => void
  now: number
}) {
  if (!sessions.length)
    return (
      <div className="p-6 text-sm text-zinc-500">
        No hay bitácoras en <code className="font-mono">data/ledger/</code> todavía. Arranca una sesión a través del
        gateway, o prueba <code className="font-mono">owit monitor --demo --live</code>.
      </div>
    )
  return (
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {sessions.map((s) => {
        const active = !s.ended
        const injected = s.verdicts.TOOL_INJECTED ?? 0
        const hot = s.alerts.critical + s.alerts.high
        return (
          <li key={s.sid}>
            <button
              onClick={() => onSelect(s.sid)}
              className={cx(
                'w-full px-4 py-3 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900',
                selected === s.sid && 'bg-zinc-100 dark:bg-zinc-900',
                s.integrity.status === 'fail' && 'border-l-4 border-red-600',
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cx(
                    'grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold uppercase',
                    s.user === 'mallory'
                      ? 'bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-100'
                      : 'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100',
                  )}
                >
                  {(s.user ?? '?').slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <span className="truncate">{s.user ?? 'desconocido'}</span>
                    {active && (
                      <span className="relative flex size-2" title="sesión abierta">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                      </span>
                    )}
                    <span className="ml-auto shrink-0 text-xs font-normal text-zinc-500">{ago(s.last_ts, now)}</span>
                  </div>
                  <div className="truncate text-xs text-zinc-500">
                    {s.agent.name ?? '?'} {s.agent.version ?? ''} · {s.upstream.profile ?? '?'} ·{' '}
                    <span className="font-mono">{s.sid.slice(0, 14)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-9">
                <IntegrityBadge b={s.integrity} />
                {injected > 0 && (
                  <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {injected} INYECTADO
                  </span>
                )}
                {hot > 0 && (
                  <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 dark:text-orange-300">
                    {hot} alerta{hot > 1 ? 's' : ''}
                  </span>
                )}
                <span className="text-[11px] text-zinc-500">
                  {s.entries} entradas · {s.counts.tool_calls} acciones
                </span>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
