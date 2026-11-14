import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { api, type ActionDetail, type ContextItem } from '../api'
import { argNoun, cx, SOURCE, sourceOf, toolName, VERDICT_TONE, VERDICT_WORD } from '../lib/format'
import { Highlight, IconBroken, IconClose, IconSeal, ProvTag, Stamp, VerdictSentence } from './Marks'

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
      <button aria-label="cerrar" onClick={onClose} className="flex-1 cursor-default bg-ink/25 backdrop-blur-[1px]" />
      <section className="flex h-full w-full max-w-[1040px] flex-col border-l border-rule bg-paper shadow-2xl lg:w-[74vw]">
        <div className="flex items-center gap-3 border-b border-rule px-8 py-3">
          <span className="label text-ink-3">
            {caseLabel} · acción #{seq}
            {d && !stale ? ` · ${toolName(d.tool)}` : ''}
          </span>
          <button onClick={onClose} className="ml-auto p-1 text-ink-3 hover:text-ink" aria-label="cerrar">
            <IconClose className="size-5" />
          </button>
        </div>
        {err && <p className="px-8 py-6 text-red">{err}</p>}
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
    // fuentes: lo que pidió el usuario (siempre) + los fragmentos donde aparece algún argumento (sin el modelo)
    const sources = d.context.filter(
      (c) => sourceOf(c.provenance) === 'user' || (c.matches.length > 0 && sourceOf(c.provenance) !== 'model'),
    )
    return { sources, names }
  }, [d])
  const signed = d.context.find((c) => c.provenance === 'user_signed')

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 pt-9 pb-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {v.label === 'TOOL_INJECTED' || v.label === 'UNVERIFIABLE' ? (
            <Stamp size="lg">{VERDICT_WORD[v.label]}</Stamp>
          ) : v.label === 'USER_INSTRUCTED' && v.non_repudiable ? (
            <Stamp size="lg" tone="seal">
              firmado
            </Stamp>
          ) : (
            <span className={cx('label text-sm', VERDICT_TONE[v.label])}>{VERDICT_WORD[v.label]}</span>
          )}
          {v.partial && (
            <span className="label text-red">parcial: acción pedida por el usuario, dato aportado por la herramienta</span>
          )}
        </div>
        <p className="mt-4 max-w-[34ch] text-[34px] leading-[1.15] font-medium tracking-tight md:max-w-[40ch]">
          <VerdictSentence v={v} user={d.user} tool={d.tool} args={d.args} />
        </p>
        <p className="mt-3 font-mono text-[11px] text-ink-3">
          regla {v.rule} · confianza {Math.round(v.confidence * 100)} % · provisional: solo reglas, sin juez LLM, y
          sujeto a la integridad de la cadena hasta #{d.seq}
        </p>
      </div>

      {!d.integrity_ok ? (
        <div className="mx-8 mb-8 border-l-2 border-red pl-4">
          <p className="flex items-center gap-2 text-lg text-red">
            <IconBroken className="size-5" /> No se reconstruye el contexto sobre una cadena rota.
          </p>
          <ul className="mt-2 font-mono text-xs text-red">
            {d.integrity_errors.map((e, i) => (
              <li key={i}>
                comprobación {e.check}: {e.error} en #{e.seq ?? '—'}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <h2 className="label border-t border-rule px-8 pt-5 text-ink-3">de dónde salió cada dato</h2>
          <Diagram d={d} sources={sources} names={names} onJump={onJump} />

          <div className="mx-8 mt-2 mb-6 flex items-start gap-3 border-t border-rule pt-5">
            {signed ? (
              <>
                <IconSeal className="mt-0.5 size-6 shrink-0 text-seal" />
                <p className="text-[16px] leading-snug">
                  <span className="text-seal">El prompt de {d.user} está firmado</span> con su llave (entrada #
                  {signed.seq}) y el gateway le dio un recibo: no puede negar haberlo escrito.
                </p>
              </>
            ) : (
              <p className="text-[16px] leading-snug text-ochre">
                Ningún texto del usuario está firmado: la atribución vale, pero sin no repudio.
              </p>
            )}
          </div>

          <details className="group mx-8 mb-10 border-t border-rule pt-4">
            <summary className="label cursor-pointer text-ink-3 hover:text-ink">
              contexto completo que vio el modelo · {d.context.length} fragmentos
              {d.request_seq !== null ? ` · petición #${d.request_seq}` : ''}
            </summary>
            <ol className="mt-3 space-y-3">
              {d.context.map((c) => (
                <li key={`${c.seq}-${c.kind}`} className="border-l border-rule pl-3">
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
          </details>
        </>
      )}
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
  const argNames = useCallback((k: string) => names[k] ?? [], [names])
  const box = useRef<HTMLDivElement>(null)
  const cards = useRef(new Map<number, HTMLElement>())
  const args = useRef(new Map<string, HTMLElement>())
  const [wires, setWires] = useState<Wire[]>([])
  const v = d.verdict

  const measure = useCallback(() => {
    const root = box.current?.getBoundingClientRect()
    if (!root) return
    const out: Wire[] = []
    for (const k of Object.keys(d.args)) {
      const names = argNames(k)
      const row = args.current.get(k)?.getBoundingClientRect()
      if (!row || !names.length) continue
      const x2 = row.left - root.left
      const y2 = row.top - root.top + Math.min(row.height / 2, 16)
      for (const c of sources) {
        if (!c.matches.some((m) => names.includes(m))) continue
        const card = cards.current.get(c.seq)?.getBoundingClientRect()
        if (!card) continue
        const x1 = card.right - root.left
        const y1 = card.top - root.top + Math.min(card.height / 2, 26)
        const dx = Math.max(40, (x2 - x1) / 2)
        const src = sourceOf(c.provenance)
        out.push({
          x: x2,
          y: y2,
          d: `M${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
          color: src === 'tool' && v.label === 'TOOL_INJECTED' ? 'var(--red)' : SOURCE[src].stroke,
          strong: src === 'tool' && v.label === 'TOOL_INJECTED',
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
    <div ref={box} className="relative grid grid-cols-[minmax(0,1fr)_minmax(64px,120px)_minmax(0,22rem)] px-8 pt-4 pb-6">
      <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
        {wires.map((w, i) => (
          <g key={i}>
            <path d={w.d} fill="none" stroke={w.color} strokeWidth={w.strong ? 2.5 : 1.5} />
            <circle cx={w.x} cy={w.y} r="3.5" fill={w.color} />
          </g>
        ))}
      </svg>

      <ol className="space-y-3">
        {sources.map((c) => {
          const src = SOURCE[sourceOf(c.provenance)]
          return (
            <li
              key={`${c.seq}-${c.kind}`}
              ref={(el) => {
                if (el) cards.current.set(c.seq, el)
                else cards.current.delete(c.seq)
              }}
              className={cx('border-l-[3px] bg-card px-4 py-3', src.border)}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <ProvTag p={c.provenance} />
                {c.resource && <span className="truncate font-mono text-[11px] text-ink-3">{c.resource}</span>}
                <button onClick={() => onJump(c.seq)} className="ml-auto font-mono text-[11px] text-ink-3 hover:text-ink">
                  #{c.seq}
                </button>
              </div>
              {c.fragment !== null ? (
                <p
                  className={cx(
                    'mt-1.5 leading-snug break-words whitespace-pre-wrap',
                    sourceOf(c.provenance) === 'user' ? 'text-[17px]' : 'font-mono text-[12.5px]',
                  )}
                >
                  <Highlight text={c.fragment} needles={needles(c)} />
                </p>
              ) : (
                <p className="mt-1.5 text-sm text-ink-3 italic">contenido oculto (--no-content)</p>
              )}
              {sourceOf(c.provenance) === 'user' && missing.length > 0 && (
                <p className="mt-2 text-sm text-ink-3 italic">
                  no menciona {missing.map(argNoun).join(' ni ')}
                </p>
              )}
            </li>
          )
        })}
        {!sources.length && <li className="text-ink-3 italic">Ningún argumento sensible aparece en el contexto.</li>}
      </ol>

      <div />

      <div className="self-start border border-ink bg-card">
        <div className="border-b border-ink px-4 py-2">
          <span className="label text-ink">la acción</span>
          <div className="font-mono text-sm">{toolName(d.tool)}</div>
        </div>
        <dl>
          {Object.entries(d.args).map(([k, val]) => {
            const names = argNames(k)
            const provs = d.verdict.arg_provenance[k]
            const decisive = d.sensitive.some((s) => argKey(s.name) === k && s.decisive)
            const nowhere = provs !== undefined && provs.length === 0
            return (
              <div
                key={k}
                ref={(el) => {
                  if (el) args.current.set(k, el)
                  else args.current.delete(k)
                }}
                className={cx('border-b border-rule px-4 py-2 last:border-b-0', !names.length && 'opacity-60')}
              >
                <dt className="label flex items-center gap-2 text-ink-3">
                  {k}
                  {decisive && <span className="text-ink">· decide</span>}
                </dt>
                <dd className="mt-0.5 font-mono text-[12.5px] break-all">
                  {String(typeof val === 'string' ? val : JSON.stringify(val)).slice(0, 140)}
                </dd>
                {nowhere && <dd className="mt-0.5 text-sm text-model italic">no aparece en nada que haya visto el modelo</dd>}
              </div>
            )
          })}
        </dl>
      </div>
    </div>
  )
}
