import { useMemo, useState } from 'react'
import type { Alert, Level, SessionSummary } from '../api'
import { ago, caseNo, cx, LEVEL, TONE } from '../lib/format'

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
  const count = (l: Level) => alerts.filter((a) => a.level === l).length

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <h2 className="text-[20px] font-medium tracking-tight">Alertas</h2>
        {(['critical', 'high', 'medium'] as Level[]).map((l) =>
          count(l) ? (
            <span
              key={l}
              title={LEVEL[l].word}
              className={cx('rounded-[4px] px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums', TONE[LEVEL[l].tone].soft, TONE[LEVEL[l].tone].text)}
            >
              {count(l)}
            </span>
          ) : null,
        )}
        <button
          onClick={() => setShowInfo((x) => !x)}
          className={cx('label ml-auto rounded-md px-2 py-1', showInfo ? 'bg-ink text-paper' : 'text-ink-3 hover:bg-paper-2')}
        >
          info {count('info')}
        </button>
      </div>
      <ol className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
        {!list.length && <li className="px-3 py-4 text-ink-3 italic">Nada que reportar.</li>}
        {list.map((a) => {
          const s = sessions[a.sid]
          const tone = TONE[LEVEL[a.level].tone]
          return (
            <li key={a.id} className="group relative">
              <button
                onClick={() => onOpen(a)}
                className={cx(
                  'block w-full rounded-lg py-2.5 pr-3 pl-4 text-left transition-colors hover:bg-paper-2',
                  a.level === 'critical' && 'bg-alarm/[0.07]',
                )}
              >
                <span className={cx('absolute top-2.5 bottom-2.5 left-1.5 w-[3px] rounded-full', tone.bg)} />
                <p className={cx('truncate text-[15px] leading-snug', a.level === 'critical' && 'text-alarm')} title={a.detail ? `${a.title}\n${a.detail}` : a.title}>
                  {a.title}
                </p>
                <p className="mt-0.5 font-mono text-[10.5px] text-ink-3">
                  {s?.user ?? '?'} · {caseNo(numbers[a.sid] ?? 0)}
                  {a.seq !== null ? ` · #${a.seq}` : ''} · {ago(a.ts, now)}
                </p>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
