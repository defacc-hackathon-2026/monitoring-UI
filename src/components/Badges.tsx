import type { IntegrityBadge as Badge, VerdictLite } from '../api'
import { cx, provLabel, tone, VERDICT } from '../lib/format'

export function IntegrityBadge({ b, detailed = false }: { b: Badge; detailed?: boolean }) {
  if (b.status === 'fail')
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-0.5 text-xs font-semibold text-white"
        title={b.errors?.map((e) => `[${e.check}] seq=${e.seq} ${e.error} ${e.detail}`).join('\n')}
      >
        <span aria-hidden>✕</span> FALLA
        {detailed && (
          <span className="font-normal opacity-90">
            · desde seq {b.first_error_seq} · comprobación {b.failed_check} ({b.failed_check_name})
            {b.error_count && b.error_count > 1 ? ` · ${b.error_count} errores` : ''}
          </span>
        )}
      </span>
    )
  if (b.status === 'unknown')
    return <span className="rounded-md bg-zinc-500/15 px-2 py-0.5 text-xs text-zinc-500">verificando…</span>
  const pending = b.status === 'pending_anchor'
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
        pending
          ? 'bg-amber-500/12 text-amber-700 ring-amber-500/40 dark:text-amber-300'
          : 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/40 dark:text-emerald-300',
      )}
      title={`verify_ledger en ${b.verify_ms} ms`}
    >
      <span aria-hidden>{pending ? '◔' : '✓'}</span>
      {pending ? 'pendiente de ancla' : 'íntegra'}
      {detailed && (
        <span className="font-normal opacity-90">
          · hasta seq {b.ok_up_to} · anclada hasta {b.last_anchored_seq ?? -1}
          {pending ? ` · ${b.unanchored_tail} sin anclar` : ''}
        </span>
      )}
    </span>
  )
}

export function VerdictPill({ v, big = false }: { v: VerdictLite; big?: boolean }) {
  const meta = VERDICT[v.label]
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span
        className={cx(
          'inline-flex items-center gap-1 rounded font-bold tracking-wide',
          big ? 'px-2.5 py-1 text-sm' : 'px-1.5 py-0.5 text-[10px]',
          meta.cls,
        )}
      >
        {v.label === 'USER_INSTRUCTED' && v.non_repudiable && <span title="no repudio: prompt firmado">🔏</span>}
        {big ? meta.text : meta.short}
        {v.source && <span className="font-mono font-medium opacity-90">({v.source})</span>}
      </span>
      {v.partial && (
        <span
          className={cx(
            'rounded bg-red-500/15 font-semibold text-red-700 ring-1 ring-red-500/40 ring-inset dark:text-red-300',
            big ? 'px-2 py-1 text-xs' : 'px-1 py-0.5 text-[10px]',
          )}
          title="El usuario pidió la acción, pero un argumento lo aportó la herramienta (R2b)"
        >
          parcial
        </span>
      )}
    </span>
  )
}

export function ProvChip({ p, className }: { p: string; className?: string }) {
  const t = tone(p)
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] ring-1 ring-inset',
        t.chip,
        className,
      )}
    >
      <span className={cx('size-1.5 rounded-full', t.dot)} />
      {provLabel(p)}
    </span>
  )
}

/** Resalta (sin distinguir mayúsculas) cada aparición de `needles` en `text`. */
export function Highlight({ text, needles }: { text: string; needles: string[] }) {
  const ns = needles.filter((n) => n && n.length > 2)
  if (!ns.length) return <>{text}</>
  const esc = ns.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = text.split(new RegExp(`(${esc.join('|')})`, 'gi'))
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm bg-yellow-300 px-0.5 text-black dark:bg-yellow-400">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}
