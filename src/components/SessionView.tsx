import { useEffect, useMemo, useRef, useState } from 'react'
import { api, type Entry, type SessionSummary } from '../api'
import { clock, cx, LEGEND, short, tone } from '../lib/format'
import { IntegrityBadge, ProvChip, VerdictPill } from './Badges'

type Filter = 'all' | 'actions' | 'content'

const KIND_LABEL: Record<string, string> = {
  session_start: 'inicio',
  manifest_decision: 'manifiesto',
  user_prompt: 'prompt firmado',
  user_text_unsigned: 'texto sin firma',
  llm_request: 'petición LLM',
  llm_response: 'respuesta LLM',
  tool_call: 'ACCIÓN',
  tool_check: 'hook',
  tool_result: 'resultado',
  context_reset: 'reinicio',
  anchor: 'ancla',
  session_end: 'fin',
}

function Counter({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex items-baseline gap-1 rounded-md border px-2 py-0.5 text-xs',
        warn && value > 0
          ? 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
          : 'border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400',
      )}
    >
      <span className="font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">{value}</span>
      {label}
    </span>
  )
}

export function SessionHeader({ s, onVerified }: { s: SessionSummary; onVerified: () => void }) {
  const [busy, setBusy] = useState(false)
  const c = s.counts
  return (
    <div className="space-y-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold">{s.user ?? 'desconocido'}</h2>
        <span className="text-sm text-zinc-500">
          {s.agent.name} {s.agent.version} → {s.upstream.profile} ({s.upstream.provider}
          {s.upstream.model_requested ? ` · ${s.upstream.model_requested}` : ''})
        </span>
        <span className="font-mono text-xs text-zinc-500">{s.sid}</span>
        <span className="ml-auto text-xs text-zinc-500">{s.ended ? 'sesión cerrada' : 'sesión abierta'}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <IntegrityBadge b={s.integrity} detailed />
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await api.verify(s.sid)
              onVerified()
            } finally {
              setBusy(false)
            }
          }}
          className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {busy ? 'verificando…' : 'verificar ahora'}
        </button>
        {s.integrity.missing_blobs ? (
          <span className="text-xs text-zinc-500">{s.integrity.missing_blobs} blobs borrados (privacidad)</span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Counter label="prompts firmados" value={c.prompts_signed} />
        <Counter label="texto sin firma" value={c.text_unsigned} warn />
        <Counter label="acciones" value={c.tool_calls} />
        <Counter label="inyectadas" value={s.verdicts.TOOL_INJECTED ?? 0} warn />
        <Counter label="herramientas quitadas" value={c.tools_stripped} warn />
        <Counter label="denegadas por hook" value={c.tools_denied} warn />
        <Counter label="anomalías" value={c.anomalies + c.history_mismatch} warn />
      </div>
    </div>
  )
}

function Row({ e, fresh, onOpen, selected }: { e: Entry; fresh: boolean; onOpen: () => void; selected: boolean }) {
  const t = tone(e.provenance)
  const isAction = e.kind === 'tool_call'
  if (e.kind === 'anchor')
    return (
      <li className="flex items-center gap-2 px-5 py-1 text-[11px] text-zinc-500">
        <span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
        <span>⚓ anclado hasta seq {String(e.meta.head_seq)}</span>
        <span className="font-mono">{short(String(e.meta.head_hash ?? ''), 8)}</span>
        <span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
      </li>
    )
  return (
    <li
      id={`e-${e.seq}`}
      className={cx(
        'group relative flex gap-3 py-2 pr-5 pl-5 transition-colors',
        isAction && 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900',
        selected && 'bg-zinc-100 dark:bg-zinc-900',
        fresh && 'animate-[flash_2s_ease-out]',
      )}
      onClick={isAction ? onOpen : undefined}
    >
      <span className={cx('absolute top-0 bottom-0 left-0 w-1', t.bar)} />
      <span className="w-8 shrink-0 pt-0.5 text-right font-mono text-[11px] text-zinc-400 tabular-nums">{e.seq}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cx(
              'text-[11px] font-semibold tracking-wide uppercase',
              isAction ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500',
            )}
          >
            {KIND_LABEL[e.kind] ?? e.kind}
          </span>
          <ProvChip p={e.provenance} />
          <span className={cx('truncate text-sm', isAction && 'font-medium')}>{e.summary}</span>
          {e.verdict && <VerdictPill v={e.verdict} />}
          {e.blob === 'missing' && <span className="text-[10px] text-zinc-500">blob borrado</span>}
          {e.blob === 'mismatch' && <span className="text-[10px] font-bold text-red-600">blob alterado</span>}
          <span className="ml-auto shrink-0 font-mono text-[11px] text-zinc-400">{clock(e.ts)}</span>
        </div>
        {e.fragment && (
          <p className="mt-0.5 line-clamp-2 font-mono text-xs break-all whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
            {e.fragment}
          </p>
        )}
        {isAction && (
          <span className="text-[11px] text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300">
            ver contexto y atribución →
          </span>
        )}
      </div>
    </li>
  )
}

export function Timeline({
  sid,
  entries,
  fresh,
  now,
  selectedSeq,
  onOpenAction,
}: {
  sid: string
  entries: Entry[] | undefined
  fresh: Record<string, number>
  now: number
  selectedSeq: number | null
  onOpenAction: (seq: number) => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [follow, setFollow] = useState(true)
  const bottom = useRef<HTMLDivElement>(null)

  const shown = useMemo(() => {
    if (!entries) return []
    if (filter === 'actions')
      return entries.filter(
        (e) =>
          e.kind === 'tool_call' ||
          e.kind === 'user_prompt' ||
          e.kind === 'anchor' ||
          (e.kind === 'manifest_decision' && e.meta.decision === 'rejected') ||
          (e.kind === 'tool_check' && e.meta.decision === 'deny'),
      )
    if (filter === 'content')
      return entries.filter((e) => !['llm_request', 'manifest_decision', 'tool_check', 'session_start'].includes(e.kind))
    return entries
  }, [entries, filter])

  useEffect(() => {
    if (follow) bottom.current?.scrollIntoView({ block: 'end' })
  }, [shown.length, follow])

  if (!entries) return <div className="p-6 text-sm text-zinc-500">Cargando la bitácora…</div>
  return (
    <div>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white/90 px-5 py-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        {(
          [
            ['all', 'todo'],
            ['content', 'contenido'],
            ['actions', 'acciones y decisiones'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={cx(
              'rounded-full px-2.5 py-0.5 text-xs',
              filter === k
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
            )}
          >
            {label}
          </button>
        ))}
        <label className="ml-2 flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          <input type="checkbox" checked={follow} onChange={(ev) => setFollow(ev.target.checked)} />
          seguir en vivo
        </label>
        <div className="ml-auto hidden flex-wrap gap-1 xl:flex">
          {LEGEND.map((p) => (
            <ProvChip key={p} p={p.replace('*', 'x')} className="opacity-80" />
          ))}
        </div>
      </div>
      <ol className="pb-6">
        {shown.map((e) => (
          <Row
            key={e.seq}
            e={e}
            selected={selectedSeq === e.seq}
            fresh={now - (fresh[`${sid}:${e.seq}`] ?? 0) < 2500}
            onOpen={() => onOpenAction(e.seq)}
          />
        ))}
      </ol>
      <div ref={bottom} />
    </div>
  )
}
