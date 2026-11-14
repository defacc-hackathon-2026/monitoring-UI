import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { api, type ActionDetail, type ContextItem } from '../api'
import { argNoun, cx, SOURCE, sourceOf, TONE, toolName } from '../lib/format'
import {
  Disclosure,
  Highlight,
  IconBroken,
  IconClose,
  IconSeal,
  ProvTag,
  VerdictBadge,
  VerdictSentence,
} from './Marks'

interface Wire {
  x: number
  y: number
  d: string
  color: string
  strong: boolean
}

function argKey(name: string): string {
  return name.split(/[.[#]/)[0]
}

export function ActionView({
  sid,
  seq,
  caseLabel,
  version,
  onClose,
  onJump,
}: {
  sid: string
  seq: number
  caseLabel: string
  version: string // cambia cuando llega un veredicto nuevo para esta acción → se vuelve a pedir
  onClose: () => void
  onJump: (seq: number) => void
}) {
  const [d, setD] = useState<ActionDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    api
      .action(sid, seq)
      .then((x) => {
        if (!live) return
        setD(x)
        setErr(null)
      })
      .catch((e: unknown) => live && setErr(e instanceof Error ? e.message : String(e)))
    return () => {
      live = false
    }
  }, [sid, seq, version])

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const stale = d && (d.sid !== sid || d.seq !== seq)

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <button aria-label="cerrar" onClick={onClose} className="flex-1 cursor-default bg-ink/30" />
      <section className="flex h-full w-full max-w-[1040px] flex-col bg-paper shadow-2xl lg:w-[74vw]">
        <div className="flex items-center gap-3 px-8 pt-4">
          <span className="label text-ink-3">
            {caseLabel} · acción #{seq}
          </span>
          <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-ink-3 hover:bg-paper-2 hover:text-ink" aria-label="cerrar">
            <IconClose className="size-5" />
          </button>
        </div>
        {err && <p className="px-8 py-6 text-alarm">{err}</p>}
        {(!d || stale) && !err && <p className="px-8 py-6 text-ink-3 italic">Reconstruyendo lo que vio el modelo…</p>}
        {d && !stale && <Body d={d} onJump={onJump} />}
      </section>
    </div>
  )
}

function Body({ d, onJump }: { d: ActionDetail; onJump: (seq: number) => void }) {
  const v = d.verdict
  // memorizado: el diagrama mide el DOM cada vez que cambian, así que deben ser estables entre renders
  const { sources, names } = useMemo(() => {
    const names: Record<string, string[]> = {}
    for (const s of d.sensitive) (names[argKey(s.name)] ??= []).push(s.name)
    const sources = d.context.filter(
      (c) => sourceOf(c.provenance) === 'user' || (c.matches.length > 0 && sourceOf(c.provenance) !== 'model'),
    )
    return { sources, names }
  }, [d])
  const signed = d.context.find((c) => c.provenance === 'user_signed')

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 pt-3 pb-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[15px] font-semibold">{toolName(d.tool)}</span>
          <VerdictBadge v={v} size="lg" />
        </div>
        <p className="mt-4 max-w-[46ch] text-[28px] leading-[1.2] font-medium tracking-tight">
          <VerdictSentence v={v} user={d.user} tool={d.tool} args={d.args} />
        </p>
      </div>

      {!d.integrity_ok ? (
        <div className="mx-8 mb-6 rounded-lg bg-alarm/[0.07] p-5">
          <p className="flex items-center gap-2 text-lg text-alarm">
            <IconBroken className="size-5" /> La cadena está rota: no se reconstruye el contexto.
          </p>
          <Disclosure summary={`qué falló · ${d.integrity_errors.length}`} className="mt-3">
            <ul className="font-mono text-xs text-alarm">
              {d.integrity_errors.map((e, i) => (
                <li key={i}>
                  comprobación {e.check}: {e.error} en #{e.seq ?? '—'}
                </li>
              ))}
            </ul>
          </Disclosure>
        </div>
      ) : (
        <Diagram d={d} sources={sources} names={names} onJump={onJump} />
      )}

      <div className="mx-8 mt-2 mb-10 space-y-3 border-t border-rule pt-4">
        {d.integrity_ok && (
          <Disclosure
            summary={
              signed ? (
                <span className="inline-flex items-center gap-1.5 text-user">
                  <IconSeal className="size-3.5" /> firma del usuario
                </span>
              ) : (
                <span className="text-warn">sin firma del usuario</span>
              )
            }
          >
            <p className="text-[15px] leading-snug text-ink-2">
              {signed
                ? `El prompt de ${d.user} está firmado con su llave (entrada #${signed.seq}) y el gateway le devolvió un recibo: no puede negar haberlo escrito.`
                : 'Ningún texto del usuario está firmado: la atribución vale, pero sin no repudio.'}
            </p>
          </Disclosure>
        )}
        <Disclosure summary={`cómo se decidió · regla ${v.rule}`}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[11.5px] text-ink-2">
            <dt className="text-ink-3">regla</dt>
            <dd>{v.rule}</dd>
            <dt className="text-ink-3">confianza</dt>
            <dd>{Math.round(v.confidence * 100)} %</dd>
            <dt className="text-ink-3">método</dt>
            <dd>{v.method} · provisional (sin juez LLM; depende de la integridad hasta #{d.seq})</dd>
            {Object.entries(v.detail).map(([k, val]) => (
              <div key={k} className="contents">
                <dt className="text-ink-3">{k}</dt>
                <dd className="break-all">{typeof val === 'string' ? val : JSON.stringify(val)}</dd>
              </div>
            ))}
          </dl>
        </Disclosure>
        <Disclosure summary={`contexto completo · ${d.context.length} fragmentos`}>
          <ol className="space-y-2.5">
            {d.context.map((c) => (
              <li key={`${c.seq}-${c.kind}`} className={cx('border-l-2 pl-3', SOURCE[sourceOf(c.provenance)].border)}>
                <div className="flex flex-wrap items-baseline gap-3">
                  <button onClick={() => onJump(c.seq)} className="font-mono text-[11px] text-ink-3 hover:text-ink">
                    #{c.seq}
                  </button>
                  <ProvTag p={c.provenance} />
                  <span className="label text-ink-3">{c.kind}</span>
                </div>
                <p className="mt-1 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink-2">
                  {c.fragment ?? '— contenido oculto (--no-content) —'}
                </p>
              </li>
            ))}
          </ol>
        </Disclosure>
      </div>
    </div>
  )
}

function Diagram({
  d,
  sources,
  names,
  onJump,
}: {
  d: ActionDetail
  sources: ContextItem[]
  names: Record<string, string[]>
  onJump: (seq: number) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const cards = useRef(new Map<number, HTMLElement>())
  const args = useRef(new Map<string, HTMLElement>())
  const [wires, setWires] = useState<Wire[]>([])
  const v = d.verdict
  const argNames = useCallback((k: string) => names[k] ?? [], [names])

  const measure = useCallback(() => {
    const root = box.current?.getBoundingClientRect()
    if (!root) return
    const out: Wire[] = []
    for (const k of Object.keys(d.args)) {
      const ns = argNames(k)
      const row = args.current.get(k)?.getBoundingClientRect()
      if (!row || !ns.length) continue
      const x2 = row.left - root.left
      const y2 = row.top - root.top + Math.min(row.height / 2, 18)
      for (const c of sources) {
        if (!c.matches.some((m) => ns.includes(m))) continue
        const card = cards.current.get(c.seq)?.getBoundingClientRect()
        if (!card) continue
        const x1 = card.right - root.left
        const y1 = card.top - root.top + Math.min(card.height / 2, 28)
        const dx = Math.max(40, (x2 - x1) / 2)
        const src = sourceOf(c.provenance)
        const bad = src === 'tool' && v.label === 'TOOL_INJECTED'
        out.push({
          x: x2,
          y: y2,
          d: `M${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
          color: bad ? 'var(--alarm)' : SOURCE[src].stroke,
          strong: bad,
        })
      }
    }
    setWires(out)
  }, [d, sources, argNames, v.label])

  useLayoutEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (box.current) ro.observe(box.current)
    return () => ro.disconnect()
  }, [measure])

  const needles = (c: ContextItem) =>
    d.sensitive.filter((s) => c.matches.includes(s.name) && s.value).map((s) => s.value as string)
  // argumentos decisivos que ningún texto del usuario menciona (lo que el usuario NO pidió)
  const userMatched = new Set(sources.filter((c) => sourceOf(c.provenance) === 'user').flatMap((c) => c.matches))
  const missing = [...new Set(d.sensitive.filter((s) => s.decisive && !userMatched.has(s.name)).map((s) => argKey(s.name)))]

  return (
    <div className="mx-8 rounded-xl bg-paper-2 p-6">
      <div ref={box} className="relative grid grid-cols-[minmax(0,1fr)_minmax(56px,110px)_minmax(0,19rem)]">
        <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
          {wires.map((w, i) => (
            <g key={i}>
              <path d={w.d} fill="none" stroke={w.color} strokeWidth={w.strong ? 3 : 2} strokeLinecap="round" />
              <circle cx={w.x} cy={w.y} r="4" fill={w.color} />
            </g>
          ))}
        </svg>

        <ol className="space-y-3">
          {sources.map((c) => {
            const src = sourceOf(c.provenance)
            const long = (c.fragment?.length ?? 0) > 180
            return (
              <li
                key={`${c.seq}-${c.kind}`}
                ref={(el) => {
                  if (el) cards.current.set(c.seq, el)
                  else cards.current.delete(c.seq)
                }}
                className={cx('rounded-lg border-l-4 bg-card px-4 py-3 shadow-[0_1px_0_var(--rule)]', SOURCE[src].border)}
              >
                <div className="flex items-center gap-2">
                  <ProvTag p={c.provenance} />
                  {c.provenance === 'user_signed' && <IconSeal className="size-3.5 text-user" title="firmado" />}
                  <button
                    onClick={() => onJump(c.seq)}
                    className="ml-auto font-mono text-[10.5px] text-ink-3 hover:text-ink"
                    title={c.resource ?? undefined}
                  >
                    #{c.seq}
                  </button>
                </div>
                {c.fragment !== null ? (
                  <p
                    className={cx(
                      'mt-1.5 leading-snug break-words whitespace-pre-wrap',
                      long && 'line-clamp-4',
                      src === 'user' ? 'text-[16px]' : 'font-mono text-[12px]',
                    )}
                    title={long ? c.fragment : undefined}
                  >
                    <Highlight text={c.fragment} needles={needles(c)} />
                  </p>
                ) : (
                  <p className="mt-1.5 text-sm text-ink-3 italic">contenido oculto</p>
                )}
                {src === 'user' && missing.length > 0 && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded bg-alarm/10 px-1.5 py-0.5 font-mono text-[11px] text-alarm">
                    no menciona {missing.map(argNoun).join(' ni ')}
                  </p>
                )}
              </li>
            )
          })}
          {!sources.length && <li className="text-ink-3 italic">Ningún argumento sensible aparece en el contexto.</li>}
        </ol>

        <div />

        <div className="self-start overflow-hidden rounded-lg bg-card shadow-[0_0_0_1.5px_var(--ink)]">
          <div className="bg-ink px-4 py-2 font-mono text-[13px] font-semibold text-paper">{toolName(d.tool)}</div>
          <dl>
            {Object.entries(d.args).map(([k, val]) => {
              const ns = argNames(k)
              const provs = d.verdict.arg_provenance[k]
              const nowhere = provs !== undefined && provs.length === 0
              const tainted = (provs ?? []).length > 0 && provs!.every((p) => sourceOf(p) === 'tool')
              return (
                <div
                  key={k}
                  ref={(el) => {
                    if (el) args.current.set(k, el)
                    else args.current.delete(k)
                  }}
                  className={cx('border-b border-rule px-4 py-2 last:border-b-0', !ns.length && 'opacity-50')}
                >
                  <dt className="label text-ink-3">{k}</dt>
                  <dd
                    className={cx(
                      'mt-0.5 truncate font-mono text-[12.5px]',
                      tainted && v.label === 'TOOL_INJECTED' && TONE.alarm.text,
                    )}
                    title={typeof val === 'string' ? val : JSON.stringify(val)}
                  >
                    {String(typeof val === 'string' ? val : JSON.stringify(val))}
                  </dd>
                  {nowhere && <dd className="mt-0.5 text-[13px] text-model italic">no aparece en el contexto</dd>}
                </div>
              )
            })}
          </dl>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10.5px] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-user" /> del usuario
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-tool" /> de una herramienta
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-alarm" /> inyectado
        </span>
      </div>
    </div>
  )
}
