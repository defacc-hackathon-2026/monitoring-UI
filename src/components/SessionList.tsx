import type { SessionSummary } from '../api'
import { ago, caseNo, cx } from '../lib/format'
import { IconBroken, IconLink, IconSeal, VerdictBar } from './Marks'

export function SessionList({
  sessions,
  numbers,
  selected,
  onSelect,
  now,
}: {
  sessions: SessionSummary[]
  numbers: Record<string, number>
  selected: string | null
  onSelect: (sid: string) => void
  now: number
}) {
  if (!sessions.length)
    return (
      <p className="px-5 py-6 text-[15px] leading-snug text-ink-2 italic">
        Sin bitácoras todavía. Prueba <code className="font-mono text-xs not-italic">owit monitor --demo --live</code>.
      </p>
    )
  return (
    <ol className="space-y-1 px-2">
      {sessions.map((s) => {
        const fail = s.integrity.status === 'fail'
        const on = selected === s.sid
        return (
          <li key={s.sid}>
            <button
              onClick={() => onSelect(s.sid)}
              title={`${caseNo(numbers[s.sid] ?? 0)} · ${s.sid} · ${s.agent.name ?? '?'} → ${s.upstream.profile ?? '?'}`}
              className={cx(
                'block w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                on ? 'bg-card shadow-[0_0_0_1px_var(--rule)]' : 'hover:bg-paper-2',
                fail && 'shadow-[inset_3px_0_0_var(--alarm)]',
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cx('text-[17px] leading-tight font-medium', fail && 'text-alarm')}>
                  {s.user ?? 'desconocido'}
                </span>
                {!s.ended && <span className="size-1.5 animate-pulse rounded-full bg-user" title="en curso" />}
                <span className="ml-auto flex items-center gap-2">
                  <span className="font-mono text-[10.5px] text-ink-3">{ago(s.last_ts, now)}</span>
                  {fail ? (
                    <IconBroken className="size-4 text-alarm" />
                  ) : s.integrity.status === 'ok' ? (
                    <IconSeal className="size-4 text-user" title="íntegra y sellada" />
                  ) : (
                    <IconLink className="size-4 text-ink-3" />
                  )}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <VerdictBar verdicts={s.verdicts} total={s.counts.tool_calls} className="flex-1" />
                <span className="font-mono text-[10.5px] text-ink-3 tabular-nums">{s.counts.tool_calls}</span>
              </div>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
