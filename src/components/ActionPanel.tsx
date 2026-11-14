import { useEffect, useState } from 'react'
import { api, type ActionDetail, type VerdictLite } from '../api'
import { cx } from '../lib/format'
import { Highlight, ProvChip, VerdictPill } from './Badges'

function explain(v: VerdictLite, user: string | null, tool: string): string {
  switch (v.label) {
    case 'USER_INSTRUCTED':
      return v.non_repudiable
        ? `${v.source ?? user} pidió esta acción en un prompt firmado: no puede negarlo.`
        : `El texto del usuario pide esta acción, pero sin firma: no hay no repudio (L8).`
    case 'TOOL_INJECTED':
      return v.partial
        ? `El usuario pidió la acción, pero un argumento sensible salió solo de ${v.source} (regla R2b).`
        : `La orden de ejecutar ${tool} vino del resultado de ${v.source}, no del usuario.`
    case 'AMBIGUOUS':
      return 'La evidencia no alcanza para decidir quién la originó (R3). Un juez LLM opcional podría revisarla.'
    case 'MODEL_INITIATIVE':
      return 'Los argumentos sensibles no aparecen en el contexto: candidata a iniciativa del modelo (R4).'
    case 'UNVERIFIABLE':
      return 'La bitácora no verifica en alguna entrada anterior a esta acción: no se atribuye sobre evidencia corrupta.'
  }
}

export function ActionPanel({
  sid,
  seq,
  version,
  onClose,
  onJump,
}: {
  sid: string
  seq: number
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

  const needlesFor = (names: string[]) =>
    d?.sensitive.filter((a) => names.includes(a.name) && a.value).map((a) => a.value as string) ?? []

  return (
    <aside className="flex h-full flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h3 className="text-sm font-semibold">Acción seq {seq}</h3>
        {d && <span className="truncate font-mono text-xs text-zinc-500">{d.tool}</span>}
        <button
          onClick={onClose}
          className="ml-auto rounded px-2 py-0.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="cerrar"
        >
          ✕
        </button>
      </div>
      {err && <p className="p-4 text-sm text-red-600">{err}</p>}
      {!d && !err && <p className="p-4 text-sm text-zinc-500">Reconstruyendo el contexto…</p>}
      {d && (
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <section className="space-y-2">
            <VerdictPill v={d.verdict} big />
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{explain(d.verdict, d.user, d.tool)}</p>
            <p className="text-[11px] text-zinc-500">
              Regla {d.verdict.rule} · confianza {Math.round(d.verdict.confidence * 100)} % · provisional: solo reglas,
              nunca el juez, y depende de la integridad hasta seq {seq}.
            </p>
          </section>

          <section>
            <h4 className="mb-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              ¿De dónde salió cada argumento?
            </h4>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {Object.entries(d.args).map(([k, val]) => {
                  const sens = d.sensitive.filter((a) => a.name === k || a.name.startsWith(`${k}.`))
                  const provs = d.verdict.arg_provenance[k]
                  return (
                    <tr key={k} className="align-top">
                      <td className="py-1.5 pr-2 font-mono text-xs text-zinc-500">{k}</td>
                      <td className="py-1.5 pr-2 font-mono text-xs break-all">
                        {String(typeof val === 'string' ? val : JSON.stringify(val)).slice(0, 160)}
                      </td>
                      <td className="py-1.5">
                        <div className="flex flex-wrap justify-end gap-1">
                          {provs === undefined && !sens.length && (
                            <span className="text-[11px] text-zinc-400">no sensible</span>
                          )}
                          {provs !== undefined && provs.length === 0 && (
                            <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[11px] text-sky-700 dark:text-sky-300">
                              no aparece en el contexto
                            </span>
                          )}
                          {provs?.map((p) => <ProvChip key={p} p={p} />)}
                          {sens.some((a) => a.decisive) && (
                            <span className="text-[10px] font-semibold text-zinc-500" title="decide la regla">
                              decisivo
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          {!d.integrity_ok && (
            <section className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
              La verificación falla antes de esta acción:
              <ul className="mt-1 list-disc pl-4">
                {d.integrity_errors.map((e, i) => (
                  <li key={i}>
                    comprobación {e.check}: {e.error} en seq {e.seq ?? '—'}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h4 className="mb-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              Contexto exacto que vio el modelo{d.request_seq !== null ? ` (llm_request seq ${d.request_seq})` : ''}
            </h4>
            {!d.context.length && (
              <p className="text-xs text-zinc-500">
                {d.integrity_ok
                  ? 'No hay contexto registrado para esta acción.'
                  : 'No se reconstruye: la evidencia anterior a esta acción no es íntegra.'}
              </p>
            )}
            <ol className="space-y-2">
              {d.context.map((c) => (
                <li
                  key={`${c.seq}-${c.kind}`}
                  className={cx(
                    'rounded-md border p-2',
                    c.matches.length
                      ? 'border-yellow-400 bg-yellow-50 dark:border-yellow-500/60 dark:bg-yellow-500/5'
                      : 'border-zinc-200 dark:border-zinc-800',
                  )}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => onJump(c.seq)}
                      className="font-mono text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                      title="ir a la entrada en la línea de tiempo"
                    >
                      #{c.seq}
                    </button>
                    <ProvChip p={c.provenance} />
                    <span className="text-[11px] text-zinc-500">{c.kind}</span>
                    {c.resource && <span className="truncate font-mono text-[11px] text-zinc-500">{c.resource}</span>}
                    {c.matches.length > 0 && (
                      <span className="ml-auto text-[11px] font-semibold text-yellow-700 dark:text-yellow-400">
                        contiene: {c.matches.join(', ')}
                      </span>
                    )}
                  </div>
                  {c.fragment !== null ? (
                    <p className="font-mono text-xs break-words whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                      <Highlight text={c.fragment} needles={needlesFor(c.matches)} />
                    </p>
                  ) : (
                    <p className="text-[11px] text-zinc-400 italic">contenido oculto (--no-content)</p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </aside>
  )
}
