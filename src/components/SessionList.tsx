import type { SessionSummary } from '../api'
import { ago, caseNo, cx } from '../lib/format'
import { IconLink, IconSeal, Stamp } from './Marks'

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
        Todavía no hay bitácoras. Pasa una sesión por el gateway, o arranca{' '}
        <code className="font-mono text-xs not-italic">owit monitor --demo --live</code>.
      </p>
    )
  return (
    <ol>
      {sessions.map((s) => {
        const injected = s.verdicts.TOOL_INJECTED ?? 0
        const fail = s.integrity.status === 'fail'
        const on = selected === s.sid
        return (
          <li key={s.sid} className="border-b border-rule">
            <button
              onClick={() => onSelect(s.sid)}
              className={cx(
                'relative block w-full px-5 py-3.5 text-left transition-colors',
                on ? 'bg-card' : 'hover:bg-paper-2',
              )}
            >
              {on && <span className="absolute inset-y-0 left-0 w-[3px] bg-ink" />}
              <div className="flex items-baseline gap-2">
                <span className="label text-ink-3">{caseNo(numbers[s.sid] ?? 0)}</span>
                {!s.ended && <span className="label text-seal">● en curso</span>}
                <span className="label ml-auto text-ink-3 normal-case">{ago(s.last_ts, now)}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-[19px] leading-tight font-medium">{s.user ?? 'desconocido'}</span>
                {fail ? (
                  <Stamp size="sm" className="ml-auto">
                    alterada
                  </Stamp>
                ) : s.integrity.status === 'ok' ? (
                  <IconSeal className="ml-auto size-4 text-seal" title="cadena íntegra y sellada" />
                ) : (
                  <IconLink className="ml-auto size-4 text-ink-3" />
                )}
              </div>
              <div className="mt-1 font-mono text-[11px] text-ink-3">
                {s.counts.tool_calls} acci{s.counts.tool_calls === 1 ? 'ón' : 'ones'}
                {injected > 0 && <span className="text-red"> · {injected} inyectada{injected > 1 ? 's' : ''}</span>}
                {s.counts.text_unsigned > 0 && <span className="text-ochre"> · sin firma</span>}
                {' · '}
                {s.agent.name ?? '?'}
              </div>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
