import { useEffect, useMemo, useRef, useState } from 'react'
import { api, type Entry, type SessionSummary } from '../api'
import { caseNo, clock, cx, LANES, laneOf, short, SOURCE, TONE, type Lane, type Tone } from '../lib/format'
import {
  ArgFlow,
  Disclosure,
  IconArrow,
  IconBroken,
  IconRefresh,
  IconSeal,
  IntegrityBadge,
  VerdictBadge,
  VerdictBar,
  VerdictSentence,
} from './Marks'

// ------------------------------------------------------------------ cabecera del expediente

function headline(s: SessionSummary): string {
  const n = s.counts.tool_calls
  const inj = s.verdicts.TOOL_INJECTED ?? 0
  if (s.integrity.status === 'fail') return 'Alguien modificó esta bitácora después de escribirla.'
  if (n === 0) return s.ended ? 'La sesión terminó sin acciones.' : 'Todavía no hay acciones.'
  if (inj > 0) return `${inj} de ${n} acci${n === 1 ? 'ón vino' : 'ones vinieron'} de una herramienta, no del usuario.`
  if ((s.verdicts.USER_INSTRUCTED ?? 0) === n)
    return n === 1 ? 'Su única acción sale de su propio prompt.' : `Sus ${n} acciones salen de sus propios prompts.`
  return `${n} acciones registradas.`
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: Tone }) {
  return (
    <div className="min-w-[5.5rem]">
      <div className={cx('text-[30px] leading-none font-medium tabular-nums', tone && n > 0 ? TONE[tone].text : 'text-ink')}>
        {n}
      </div>
      <div className="label mt-1 text-ink-3">{label}</div>
    </div>
  )
}

export function SessionHeader({
  s,
  number,
  onVerified,
}: {
  s: SessionSummary
  number: number
  onVerified: () => void
}) {
  const [busy, setBusy] = useState(false)
  const c = s.counts
  const b = s.integrity
  return (
    <header className="border-b border-rule px-8 pt-5 pb-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="label text-ink-3">{caseNo(number)}</span>
        <h1 className="text-[34px] leading-none font-medium tracking-tight">{s.user ?? 'desconocido'}</h1>
        <IntegrityBadge b={b} size="lg" />
        {!s.ended && <span className="label text-user">● en curso</span>}
        <button
          disabled={busy}
          title="volver a verificar la cadena"
          onClick={async () => {
            setBusy(true)
            try {
              await api.verify(s.sid)
              onVerified()
            } finally {
              setBusy(false)
            }
          }}
          className="ml-auto rounded-md p-1.5 text-ink-3 hover:bg-paper-2 hover:text-ink disabled:opacity-40"
        >
          <IconRefresh className={cx('size-4', busy && 'animate-spin')} />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
        <Stat n={c.tool_calls} label="acciones" />
        <Stat n={s.verdicts.TOOL_INJECTED ?? 0} label="inyectadas" tone="alarm" />
        <Stat n={c.prompts_signed} label="firmados" />
        <Stat n={c.tools_stripped + c.tools_denied} label="bloqueadas" tone="warn" />
        <Stat n={s.alerts.critical + s.alerts.high} label="alertas" tone="alarm" />
        <div className="min-w-48 flex-1 pb-1.5">
          <VerdictBar verdicts={s.verdicts} total={c.tool_calls} className="h-2" />
        </div>
      </div>

      <Disclosure summary="detalles del expediente" className="mt-4">
        <div className="space-y-1.5 text-[15px] leading-snug">
          <p className={cx('italic', b.status === 'fail' ? 'text-alarm' : 'text-ink-2')}>{headline(s)}</p>
          <p className="font-mono text-[11.5px] text-ink-2">
            {s.sid} · {s.agent.name} {s.agent.version} → {s.upstream.profile}
            {s.upstream.model_requested ? ` (${s.upstream.model_requested})` : ''} · {s.ended ? 'cerrada' : 'en curso'}
          </p>
          <p className={cx('font-mono text-[11.5px]', b.status === 'fail' ? 'text-alarm' : 'text-ink-2')}>
            {b.status === 'fail'
              ? `cadena rota en #${b.first_error_seq} · comprobación ${b.failed_check}: ${b.failed_check_name} · ${b.error_count} errores`
              : b.status === 'pending_anchor'
                ? `íntegra hasta #${b.ok_up_to} · ${b.unanchored_tail} entradas sin sellar todavía`
                : `íntegra hasta #${b.ok_up_to} · sellada externamente hasta #${b.last_anchored_seq}`}
            {b.verify_ms !== undefined ? ` · verificada en ${b.verify_ms} ms` : ''}
          </p>
          <p className="font-mono text-[11.5px] text-ink-3">
            {c.text_unsigned} textos sin firma · {c.tools_stripped} herramientas quitadas · {c.tools_denied} denegadas por
            el hook · {c.anomalies} anomalías · {c.history_mismatch} historiales que no coinciden
          </p>
          {b.status === 'fail' && b.errors && (
            <ul className="font-mono text-[11px] text-alarm">
              {b.errors.map((e, i) => (
                <li key={i}>
                  [{e.check}] #{e.seq ?? '—'} {e.error} {e.detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Disclosure>
    </header>
  )
}

// ------------------------------------------------------------------ cadena

const LANE_W = 28
const PAD = 14
const DOT_Y = 19
const GRAPH_W = PAD * 2 + LANE_W * (LANES.length - 1)
const laneX = (l: Lane) => PAD + LANE_W * LANES.findIndex((x) => x.id === l)

type View = 'story' | 'actions' | 'all'

function inStory(e: Entry): boolean {
  switch (e.kind) {
    case 'llm_request':
      return false
    case 'manifest_decision':
      return e.meta.decision === 'rejected'
    case 'tool_check':
      return e.meta.decision === 'deny'
    case 'user_text_unsigned':
      return laneOf(e) === 'user'
    case 'llm_response':
      return e.meta.stop_reason !== 'tool_use'
    default:
      return true
  }
}

function dotClass(e: Entry): string {
  const lane = laneOf(e)
  if (lane === 'user') return 'size-[11px] rounded-full bg-user'
  if (lane === 'tools') return 'size-[11px] rounded-full bg-tool'
  if (lane === 'model') return 'size-[11px] rounded-full bg-model'
  if (lane === 'agent') return 'size-[9px] rounded-full border-[1.5px] border-ink-3 bg-paper'
  return 'size-[7px] rounded-[1px] bg-ink-3'
}

function describe(e: Entry): { label: string; tone?: Tone; text: string | null; mono: boolean } {
  const m = e.meta
  switch (e.kind) {
    case 'session_start':
      return { label: 'sesión abierta', text: e.summary, mono: false }
    case 'session_end':
      return { label: 'sesión cerrada', text: null, mono: false }
    case 'user_prompt':
      return { label: `prompt firmado · ${String(m.user_id)}`, tone: 'user', text: e.fragment, mono: false }
    case 'user_text_unsigned':
      return laneOf(e) === 'user'
        ? { label: 'usuario · sin firma', tone: 'warn', text: e.fragment, mono: false }
        : { label: `agente · ${String(m.reason)}`, text: e.fragment, mono: true }
    case 'tool_result':
      return { label: `resultado · ${String(m.origin)}`, tone: 'tool', text: e.fragment, mono: true }
    case 'llm_response':
      return { label: 'respuesta del modelo', text: e.fragment, mono: false }
    case 'llm_request':
      return { label: 'petición al modelo', text: e.summary, mono: true }
    case 'manifest_decision':
      return m.decision === 'rejected'
        ? { label: 'herramienta quitada', tone: 'alarm', text: e.summary, mono: true }
        : { label: 'herramienta aceptada', text: e.summary, mono: true }
    case 'tool_check':
      return m.decision === 'deny'
        ? { label: 'hook · denegada', tone: 'alarm', text: `${String(m.tool)} — ${String(m.reason)}`, mono: true }
        : { label: 'hook · permitida', text: `${String(m.tool)} — ${String(m.reason)}`, mono: true }
    case 'context_reset':
      return { label: 'historial reiniciado', tone: 'warn', text: e.summary, mono: true }
    default:
      return { label: e.kind, text: e.summary, mono: true }
  }
}

function Meta({ e }: { e: Entry }) {
  return (
    <span className="shrink-0 font-mono text-[10.5px] text-ink-3" title={`${e.hash}\n${e.ts}`}>
      {clock(e.ts)} · {short(e.hash)}
    </span>
  )
}

function Row({
  e,
  prev,
  last,
  broken,
  firstBroken,
  fresh,
  selected,
  user,
  onOpen,
}: {
  e: Entry
  prev: Lane | null
  last: boolean
  broken: boolean
  firstBroken: boolean
  fresh: boolean
  selected: boolean
  user: string | null
  onOpen: () => void
}) {
  const lane: Lane = e.kind === 'anchor' ? 'gateway' : laneOf(e)
  const x = laneX(lane)
  const px = prev ? laneX(prev) : x
  const stroke = broken ? 'var(--alarm)' : 'var(--rule)'
  const isAction = e.kind === 'tool_call'
  const bad = e.verdict?.label === 'TOOL_INJECTED' || e.verdict?.label === 'UNVERIFIABLE'

  const graph = (
    <div className="relative shrink-0" style={{ width: GRAPH_W }}>
      {prev && (
        <svg className="absolute top-0 left-0" width={GRAPH_W} height={DOT_Y} aria-hidden>
          <path
            d={`M${px} 0 C ${px} ${DOT_Y * 0.6}, ${x} ${DOT_Y * 0.4}, ${x} ${DOT_Y}`}
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            strokeDasharray={broken ? '3 3' : undefined}
          />
        </svg>
      )}
      {!last && (
        <span
          className="absolute bottom-0 w-0"
          style={{ left: x - 1, top: DOT_Y, borderLeft: `2px ${broken ? 'dashed' : 'solid'} ${stroke}` }}
        />
      )}
      <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: DOT_Y }}>
        {firstBroken ? (
          <span className="grid size-6 place-items-center rounded-full bg-alarm text-paper">
            <IconBroken className="size-4" />
          </span>
        ) : e.kind === 'anchor' ? (
          <IconSeal className="size-5 rounded-full bg-paper text-user" />
        ) : isAction ? (
          <span className={cx('block size-[13px] rotate-45 rounded-[2px]', bad ? 'bg-alarm' : 'bg-ink')} />
        ) : (
          <span className={cx('block', dotClass(e))} />
        )}
      </span>
    </div>
  )

  if (e.kind === 'anchor')
    return (
      <li id={`e-${e.seq}`} className="flex pr-8">
        {graph}
        <div className="flex flex-1 items-center gap-2 py-2.5" title={`sellado externamente hasta #${String(e.meta.head_seq)}`}>
          <span className="h-px flex-1 bg-user/30" />
          <span className="label text-user">sellado · #{String(e.meta.head_seq)}</span>
        </div>
      </li>
    )

  if (isAction)
    return (
      <li
        id={`e-${e.seq}`}
        className={cx('flex pr-8', fresh && 'animate-[arrive_2.5s_ease-out]')}
      >
        {graph}
        <div
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(k) => k.key === 'Enter' && onOpen()}
          className={cx(
            'group my-1.5 min-w-0 flex-1 cursor-pointer rounded-lg border px-4 py-3 transition-colors',
            bad ? 'border-alarm/50 bg-alarm/[0.05]' : 'border-rule bg-card',
            selected ? 'ring-2 ring-ink/20' : 'hover:border-ink-3',
          )}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="font-mono text-[11px] text-ink-3">#{e.seq}</span>
            <span className="font-mono text-[14px] font-semibold">{String(e.meta.tool).split('__').pop()}</span>
            {e.verdict && <VerdictBadge v={e.verdict} />}
            <span className="ml-auto flex items-center gap-1 text-ink-3 group-hover:text-ink">
              <span className="label">procedencia</span>
              <IconArrow />
            </span>
          </div>
          {e.verdict && (
            <div className="mt-2">
              <ArgFlow v={e.verdict} />
            </div>
          )}
          {e.verdict && e.args && (
            <Disclosure summary="en palabras" className="mt-2">
              <p className="text-[16px] leading-snug">
                <VerdictSentence v={e.verdict} user={user} tool={String(e.meta.tool)} args={e.args} />
              </p>
            </Disclosure>
          )}
        </div>
      </li>
    )

  const d = describe(e)
  const tone = d.tone ? TONE[d.tone].text : 'text-ink-3'
  const head = (
    <div className="flex min-w-0 items-baseline gap-3">
      <span className="w-7 shrink-0 font-mono text-[11px] text-ink-3">#{e.seq}</span>
      <span className={cx('label shrink-0', tone)}>{d.label}</span>
      {d.text && (
        <span className={cx('min-w-0 flex-1 truncate text-ink-2', d.mono ? 'font-mono text-[12px]' : 'text-[15px]')}>
          {d.text}
        </span>
      )}
      <span className="ml-auto">
        <Meta e={e} />
      </span>
    </div>
  )
  return (
    <li id={`e-${e.seq}`} className={cx('flex pr-8', fresh && 'animate-[arrive_2.5s_ease-out]')}>
      {graph}
      <div className="min-w-0 flex-1 py-2">
        {d.text && d.text.length > 60 ? (
          <details className="group/r">
            <summary className="cursor-pointer rounded hover:bg-paper-2 [&::-webkit-details-marker]:hidden">{head}</summary>
            <p
              className={cx(
                'mt-1.5 mb-1 ml-10 border-l-2 pl-3 leading-relaxed whitespace-pre-wrap',
                d.mono ? 'font-mono text-[12.5px]' : 'text-[16px]',
                d.tone ? TONE[d.tone].border : 'border-rule',
              )}
            >
              {d.text}
            </p>
          </details>
        ) : (
          head
        )}
      </div>
    </li>
  )
}

export function Timeline({
  sid,
  user,
  entries,
  firstErrorSeq,
  fresh,
  now,
  selectedSeq,
  onOpenAction,
}: {
  sid: string
  user: string | null
  entries: Entry[] | undefined
  firstErrorSeq: number | null
  fresh: Record<string, number>
  now: number
  selectedSeq: number | null
  onOpenAction: (seq: number) => void
}) {
  const [view, setView] = useState<View>('story')
  const [follow, setFollow] = useState(true)
  const bottom = useRef<HTMLDivElement>(null)

  const shown = useMemo(() => {
    if (!entries) return []
    if (view === 'actions')
      return entries.filter((e) => e.kind === 'tool_call' || e.kind === 'user_prompt' || e.kind === 'anchor')
    if (view === 'story') return entries.filter(inStory)
    return entries
  }, [entries, view])

  useEffect(() => {
    if (follow) bottom.current?.scrollIntoView({ block: 'end' })
  }, [shown.length, follow])

  if (!entries) return <p className="px-8 py-6 text-ink-3 italic">Leyendo la bitácora…</p>
  const firstBrokenSeq = firstErrorSeq === null ? null : (shown.find((e) => e.seq >= firstErrorSeq)?.seq ?? null)
  return (
    <div>
      <div className="sticky top-0 z-10 flex items-end border-b border-rule bg-paper/95 pr-8 backdrop-blur">
        <div className="relative h-9 shrink-0" style={{ width: GRAPH_W }}>
          {LANES.map((l) => (
            <span
              key={l.id}
              title={l.label}
              className={cx(
                'label absolute bottom-2 -translate-x-1/2 text-[9px]',
                SOURCE[l.id === 'user' ? 'user' : l.id === 'tools' ? 'tool' : l.id === 'model' ? 'model' : 'other'].text,
              )}
              style={{ left: laneX(l.id) }}
            >
              {l.short}
            </span>
          ))}
        </div>
        <nav className="flex flex-1 items-center gap-1 pb-1.5 pl-2">
          {(
            [
              ['story', 'relato'],
              ['actions', 'acciones'],
              ['all', 'todo'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={cx(
                'label rounded-md px-2.5 py-1',
                view === k ? 'bg-ink text-paper' : 'text-ink-3 hover:bg-paper-2 hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
          <label className="label ml-auto flex cursor-pointer items-center gap-1.5 text-ink-3">
            <input
              type="checkbox"
              checked={follow}
              onChange={(ev) => setFollow(ev.target.checked)}
              className="accent-[var(--ink)]"
            />
            en vivo
          </label>
        </nav>
      </div>
      <ol className="pt-2 pb-10">
        {shown.map((e, i) => {
          const broken = firstErrorSeq !== null && e.seq >= firstErrorSeq
          const prev = i > 0 ? (shown[i - 1].kind === 'anchor' ? 'gateway' : laneOf(shown[i - 1])) : null
          return (
            <Row
              key={e.seq}
              e={e}
              prev={prev}
              last={i === shown.length - 1}
              broken={broken}
              firstBroken={e.seq === firstBrokenSeq}
              user={user}
              selected={selectedSeq === e.seq}
              fresh={now - (fresh[`${sid}:${e.seq}`] ?? 0) < 2500}
              onOpen={() => onOpenAction(e.seq)}
            />
          )
        })}
      </ol>
      <div ref={bottom} />
    </div>
  )
}
