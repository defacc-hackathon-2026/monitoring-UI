import { useMemo, useState } from 'react'
import type { Alert, Level, SessionSummary } from '../api'
import { ago, cx, LEVEL } from '../lib/format'

const ORDER: Level[] = ['critical', 'high', 'medium', 'info']

export function AlertsFeed({
  alerts,
  sessions,
  now,
  onOpen,
}: {
  alerts: Alert[]
  sessions: Record<string, SessionSummary>
  now: number
  onOpen: (a: Alert) => void
}) {
  const [showInfo, setShowInfo] = useState(false)
  const list = useMemo(
    () =>
      alerts
        .filter((a) => showInfo || a.level !== 'info')
        .sort((a, b) => {
          const byLevel = ORDER.indexOf(a.level) - ORDER.indexOf(b.level)
          if (a.level === 'critical' || b.level === 'critical') return byLevel || (b.ts ?? '').localeCompare(a.ts ?? '')
          return (b.ts ?? '').localeCompare(a.ts ?? '') || byLevel
        }),
    [alerts, showInfo],
  )
  const counts = Object.fromEntries(ORDER.map((l) => [l, alerts.filter((a) => a.level === l).length])) as Record<
    Level,
    number
  >

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h3 className="text-sm font-semibold">Alertas</h3>
        <div className="flex gap-2 text-[11px]">
          {ORDER.slice(0, 3).map((l) => (
            <span key={l} className={cx('tabular-nums', LEVEL[l].cls)}>
              {counts[l]} {LEVEL[l].text}
            </span>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-1 text-[11px] text-zinc-500">
          <input type="checkbox" checked={showInfo} onChange={(e) => setShowInfo(e.target.checked)} />
          info ({counts.info})
        </label>
      </div>
      <ul className="flex-1 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
        {!list.length && <li className="p-4 text-sm text-zinc-500">Sin alertas.</li>}
        {list.map((a) => {
          const s = sessions[a.sid]
          return (
            <li key={a.id}>
              <button
                onClick={() => onOpen(a)}
                className={cx(
                  'w-full px-4 py-2.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900',
                  a.level === 'critical' && 'bg-red-500/10',
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className={cx('size-2 shrink-0 rounded-full', LEVEL[a.level].dot)} />
                  <span className={cx('text-[11px] font-semibold uppercase', LEVEL[a.level].cls)}>
                    {LEVEL[a.level].text}
                  </span>
                  <span className="truncate text-[11px] text-zinc-500">
                    {s?.user ?? '?'} · seq {a.seq ?? '—'}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] text-zinc-400">{ago(a.ts, now)}</span>
                </div>
                <div className="mt-0.5 text-sm font-medium break-all">{a.title}</div>
                {a.detail && <div className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{a.detail}</div>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
