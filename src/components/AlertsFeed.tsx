import { useMemo, useState } from 'react'
import type { Alert, Level, SessionSummary } from '../api'
import { ago, cx, LEVEL } from '../lib/format'
import { caseNo } from '../lib/format'

const ORDER: Level[] = ['critical', 'high', 'medium', 'info']

export function AlertsFeed({
  alerts,
  sessions,
  numbers,
  now,
  onOpen,
}: {
  alerts: Alert[]
  sessions: Record<string, SessionSummary>
  numbers: Record<string, number>
  now: number
  onOpen: (a: Alert) => void
}) {
  const [showInfo, setShowInfo] = useState(false)
  const list = useMemo(
    () =>
      alerts
        .filter((a) => showInfo || a.level !== 'info')
        .sort(
          (a, b) =>
            Number(b.level === 'critical') - Number(a.level === 'critical') ||
            (b.ts ?? '').localeCompare(a.ts ?? '') ||
            ORDER.indexOf(a.level) - ORDER.indexOf(b.level),
        ),
    [alerts, showInfo],
  )
  const info = alerts.filter((a) => a.level === 'info').length

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline gap-3 px-6 pt-5 pb-3">
        <h2 className="text-[22px] font-medium tracking-tight">Avisos</h2>
        <span className="label text-ink-3">{list.length}</span>
        <label className="label ml-auto flex cursor-pointer items-center gap-1.5 text-ink-3">
          <input
            type="checkbox"
            checked={showInfo}
            onChange={(e) => setShowInfo(e.target.checked)}
            className="accent-[var(--ink)]"
          />
          info ({info})
        </label>
      </div>
      <ol className="flex-1 overflow-y-auto border-t border-rule">
        {!list.length && <li className="px-6 py-5 text-ink-3 italic">Nada que reportar.</li>}
        {list.map((a) => {
          const s = sessions[a.sid]
          return (
            <li key={a.id} className="border-b border-rule">
              <button
                onClick={() => onOpen(a)}
                className={cx(
                  'block w-full px-6 py-3.5 text-left transition-colors hover:bg-paper-2',
                  a.level === 'critical' && 'bg-red/[0.07]',
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span className={cx('label font-semibold', LEVEL[a.level].tone)}>{LEVEL[a.level].word}</span>
                  <span className="label truncate text-ink-3 normal-case">
                    {caseNo(numbers[a.sid] ?? 0)} · {s?.user ?? '?'}
                    {a.seq !== null ? ` · #${a.seq}` : ''}
                  </span>
                  <span className="label ml-auto shrink-0 text-ink-3 normal-case">{ago(a.ts, now)}</span>
                </div>
                <p className={cx('mt-1 text-[16px] leading-snug break-words', a.level === 'critical' && 'text-red')}>
                  {a.title}
                </p>
                {a.detail && (
                  <p className="mt-1 line-clamp-2 font-mono text-[11px] break-all text-ink-3">{a.detail}</p>
                )}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
