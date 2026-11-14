import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, type Entry, type SessionSummary } from '../api'
import { clock, cx, LANES, laneOf, short, SOURCE, type Lane } from '../lib/format'
import { IconBroken, IconSeal, IntegrityMark, VerdictLine, VerdictSentence } from './Marks'
import { caseNo } from '../lib/format'

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
  const facts: [string, number, boolean][] = [
    ['prompts firmados', c.prompts_signed, false],
    ['textos sin firma', c.text_unsigned, true],
    ['acciones', c.tool_calls, false],
    ['herramientas quitadas', c.tools_stripped, true],
    ['denegadas por el hook', c.tools_denied, true],
    ['anomalías', c.anomalies + c.history_mismatch, true],
  ]
  return (
    <header className="border-b border-rule px-8 pt-6 pb-5">
      <div className="label flex flex-wrap gap-x-3 text-ink-3">
        <span>{caseNo(number)}</span>
        <span className="normal-case">{s.sid}</span>
        <span className="normal-case">
          {s.agent.name} {s.agent.version} → {s.upstream.profile}
          {s.upstream.model_requested ? ` (${s.upstream.model_requested})` : ''}
        </span>
        <span className={s.ended ? '' : 'text-seal'}>{s.ended ? 'cerrada' : '● en curso'}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[40px] leading-none font-medium tracking-tight">{s.user ?? 'desconocido'}</h1>
          <p className={cx('mt-2 text-[19px] leading-snug italic', s.integrity.status === 'fail' ? 'text-red' : 'text-ink-2')}>
            {headline(s)}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <IntegrityMark b={s.integrity} large />
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
          className="label text-ink-3 underline decoration-rule underline-offset-4 hover:text-ink disabled:opacity-50"
        >
          {busy ? 'verificando…' : 'volver a verificar'}
        </button>
      </div>
      <p className="mt-3 font-mono text-[11px] text-ink-3">
        {facts.map(([label, n, warn], i) => (
          <span key={label}>
            {i > 0 && ' · '}
            <span className={cx(warn && n > 0 && 'text-red')}>
              <span className="text-ink">{n}</span> {label}
            </span>
          </span>
        ))}
      </p>
    </header>
  )
}

// ------------------------------------------------------------------ cadena

const LANE_W = 30
const PAD = 14
const DOT_Y = 17
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
  if (e.kind === 'tool_call') return ''
  if (lane === 'user') return 'size-[11px] rounded-full bg-seal'
  if (lane === 'tools') return 'size-[11px] rounded-full bg-ochre'
  if (lane === 'model') return 'size-[11px] rounded-full bg-model'
  if (lane === 'agent') return 'size-[9px] rounded-full border-[1.5px] border-ink-3 bg-paper'
  return 'size-[7px] bg-ink-3'
}

function Words({ e }: { e: Entry }) {
  // etiqueta + texto de cada clase de entrada, para el "relato"
  const m = e.meta
  let label: string
  let body: ReactNode =<span className="text-ink-2">{e.summary}</span>
  switch (e.kind) {
    case 'session_start':
      label = 'sesión abierta'
      break
    case 'session_end':
      label = 'sesión cerrada'
      body = <span className="text-ink-2">{String(m.reason ?? '')}</span>
      break
    case 'user_prompt':
      label = `prompt firmado · ${String(m.user_id)}`
      body = e.fragment ? <q className="text-[17px] text-ink">{e.fragment}</q> : body
      break
    case 'user_text_unsigned':
      label = laneOf(e) === 'user' ? 'texto del usuario · sin firma' : `texto del agente · ${String(m.reason)}`
      body = e.fragment ? <q className="text-[17px] text-ink">{e.fragment}</q> : body
      break
    case 'tool_result':
      label = `resultado · ${String(m.origin)}`
      body = e.fragment ? (
        <span className="font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink">{e.fragment}</span>
      ) : (
        body
      )
      break
    case 'llm_response':
      label = 'respuesta del modelo'
      body = e.fragment ? <span className="text-ink-2 italic">{e.fragment}</span> : body
      break
    case 'llm_request':
      label = 'petición al modelo'
      break
    case 'manifest_decision':
      label = m.decision === 'rejected' ? 'herramienta quitada' : 'herramienta aceptada'
      body = <span className={m.decision === 'rejected' ? 'text-red' : 'text-ink-2'}>{e.summary}</span>
      break
    case 'tool_check':
      label = m.decision === 'deny' ? 'hook · denegada' : 'hook · permitida'
      body = <span className={m.decision === 'deny' ? 'text-red' : 'text-ink-2'}>{String(m.tool)} — {String(m.reason)}</span>
      break
    case 'context_reset':
      label = 'historial reiniciado'
      break
    default:
      label = e.kind
  }
  return (
    <>
      <span className="label text-ink-3">{label}</span>
      <div className="mt-0.5 line-clamp-3 text-[15px] leading-snug break-words">{body}</div>
    </>
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
  const stroke = broken ? 'var(--red)' : 'var(--ink-3)'
  const isAction = e.kind === 'tool_call'
  const injected = e.verdict?.label === 'TOOL_INJECTED' || e.verdict?.label === 'UNVERIFIABLE'

  const graph = (
    <div className="relative shrink-0" style={{ width: GRAPH_W }}>
      {prev && (
        <svg className="absolute top-0 left-0" width={GRAPH_W} height={DOT_Y} aria-hidden>
          <path
            d={`M${px} 0 C ${px} ${DOT_Y * 0.6}, ${x} ${DOT_Y * 0.4}, ${x} ${DOT_Y}`}
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
            strokeDasharray={broken ? '3 3' : undefined}
          />
        </svg>
      )}
      {!last && (
        <span
          className="absolute bottom-0 w-0"
          style={{
            left: x - 0.75,
            top: DOT_Y,
            borderLeft: `1.5px ${broken ? 'dashed' : 'solid'} ${stroke}`,
          }}
        />
      )}
      <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: DOT_Y }}>
        {firstBroken ? (
          <IconBroken className="size-5 bg-paper text-red" />
        ) : e.kind === 'anchor' ? (
          <IconSeal className="size-5 bg-paper text-seal" />
        ) : isAction ? (
          <span
            className={cx(
              'block size-[13px] rotate-45 border-2',
              injected ? 'border-red bg-red' : 'border-ink bg-paper',
            )}
          />
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
        <div className="flex flex-1 items-center gap-3 py-2.5">
          <span className="h-px flex-1 bg-seal/40" />
          <span className="label text-seal">
            sellado externamente · hasta #{String(e.meta.head_seq)} · {short(String(e.meta.head_hash ?? ''))}
          </span>
          <span className="h-px w-8 bg-seal/40" />
        </div>
      </li>
    )

  return (
    <li
      id={`e-${e.seq}`}
      onClick={isAction ? onOpen : undefined}
      className={cx(
        'group flex pr-8',
        isAction && 'cursor-pointer',
        selected && 'bg-card',
        fresh && 'animate-[arrive_2.5s_ease-out]',
      )}
    >
      {graph}
      <div
        className={cx(
          'min-w-0 flex-1 py-2',
          isAction && 'my-1.5 border-l-2 py-3 pl-4',
          isAction && (injected ? 'border-red' : 'border-ink'),
          isAction && !selected && 'group-hover:bg-paper-2',
        )}
      >
        <div className="flex items-baseline gap-3">
          <span className="w-8 shrink-0 font-mono text-[11px] text-ink-3">#{e.seq}</span>
          <div className="min-w-0 flex-1">
            {isAction ? (
              <>
                <span className="label text-ink">acción · {String(e.meta.tool)}</span>
                <p className="mt-1 text-[21px] leading-snug">
                  {e.verdict && e.args ? (
                    <VerdictSentence v={e.verdict} user={user} tool={String(e.meta.tool)} args={e.args} />
                  ) : (
                    e.summary
                  )}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {e.verdict && <VerdictLine v={e.verdict} />}
                  <span className="label text-ink-3 group-hover:text-ink">de dónde salió cada dato →</span>
                </div>
              </>
            ) : (
              <Words e={e} />
            )}
          </div>
          <span className="shrink-0 text-right font-mono text-[10.5px] leading-tight text-ink-3">
            {clock(e.ts)}
            <br />
            <span title={e.hash}>{short(e.hash)}</span>
          </span>
        </div>
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
    if (view === 'actions') return entries.filter((e) => e.kind === 'tool_call' || e.kind === 'user_prompt' || e.kind === 'anchor')
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
        <nav className="flex flex-1 items-center gap-5 pb-2 pl-11">
          {(
            [
              ['story', 'relato'],
              ['actions', 'acciones'],
              ['all', 'registro completo'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={cx(
                'label border-b-2 pb-0.5',
                view === k ? 'border-ink text-ink' : 'border-transparent text-ink-3 hover:text-ink-2',
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
            seguir en vivo
          </label>
        </nav>
      </div>
      <ol className="pt-2 pb-10">
        {shown.map((e, i) => {
          const broken = firstErrorSeq !== null && e.seq >= firstErrorSeq
          const firstBroken = e.seq === firstBrokenSeq
          const prev = i > 0 ? (shown[i - 1].kind === 'anchor' ? 'gateway' : laneOf(shown[i - 1])) : null
          return (
            <Row
              key={e.seq}
              e={e}
              prev={prev}
              last={i === shown.length - 1}
              broken={broken}
              firstBroken={firstBroken}
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
