import type { ReactNode } from 'react'
import type { IntegrityBadge, VerdictLite } from '../api'
import {
  actionPhrase,
  actionVerb,
  argNoun,
  cx,
  provName,
  SOURCE,
  sourceOf,
  taintedArgs,
  VERDICT_TONE,
  VERDICT_WORD,
} from '../lib/format'

// ------------------------------------------------------------------ iconos (trazo fino, heredan el color)

type IconProps = { className?: string; title?: string }

export function IconSeal({ className, title }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cx('size-4', className)} aria-hidden={!title} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="0.9" strokeDasharray="1.4 1.4" />
      <path d="M9 12.3l2.1 2.1L15.2 10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export function IconLink({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cx('size-4', className)} aria-hidden>
      <rect x="3" y="8.5" width="10" height="7" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="8.5" width="10" height="7" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export function IconBroken({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cx('size-4', className)} aria-hidden>
      <path d="M10 8.5H6.5a3.5 3.5 0 000 7H9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14 15.5h3.5a3.5 3.5 0 000-7H15" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 5l1 3M13 19l-1-3M8 4.5l1.5 2.5M16 19.5l-1.5-2.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

export function IconSun({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cx('size-4', className)} aria-hidden>
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconMoon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cx('size-4', className)} aria-hidden>
      <path d="M19.5 14.5A8 8 0 019.5 4.5a8 8 0 1010 10z" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export function IconClose({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cx('size-4', className)} aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

// ------------------------------------------------------------------ sello de goma

export function Stamp({
  children,
  size = 'md',
  tone = 'red',
  className,
}: {
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  tone?: 'red' | 'seal'
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-block -rotate-[7deg] font-mono font-semibold tracking-[0.14em] uppercase select-none',
        tone === 'red' ? 'border-red text-red' : 'border-seal text-seal',
        size === 'sm' && 'border-[1.5px] px-1.5 py-px text-[10px]',
        size === 'md' && 'border-2 px-2 py-0.5 text-xs',
        size === 'lg' && 'my-2 mr-3 animate-[stamp_420ms_ease-out] border-[3px] px-3 py-1 text-xl',
        'rounded-[3px]',
        tone === 'red'
          ? '[box-shadow:inset_0_0_0_1px_color-mix(in_oklab,var(--red)_35%,transparent)]'
          : '[box-shadow:inset_0_0_0_1px_color-mix(in_oklab,var(--seal)_35%,transparent)]',
        className,
      )}
    >
      {children}
    </span>
  )
}

// ------------------------------------------------------------------ integridad

export function IntegrityMark({ b, large = false }: { b: IntegrityBadge; large?: boolean }) {
  if (b.status === 'unknown') return <span className="label text-ink-3">verificando…</span>
  if (b.status === 'fail')
    return (
      <span className="inline-flex flex-wrap items-center gap-3">
        <Stamp size={large ? 'lg' : 'sm'}>alterada</Stamp>
        {large && (
          <span className="font-mono text-xs text-red">
            <IconBroken className="mr-1 inline size-4 align-[-3px]" />
            cadena rota en #{b.first_error_seq} · comprobación {b.failed_check}: {b.failed_check_name}
            {b.error_count && b.error_count > 1 ? ` · ${b.error_count} errores` : ''}
          </span>
        )}
      </span>
    )
  const pending = b.status === 'pending_anchor'
  return (
    <span
      className={cx('inline-flex items-center gap-1.5', pending ? 'text-ink-2' : 'text-seal')}
      title={`verify_ledger en ${b.verify_ms} ms`}
    >
      {pending ? <IconLink className={large ? 'size-5' : 'size-3.5'} /> : <IconSeal className={large ? 'size-5' : 'size-3.5'} />}
      <span className={cx(large ? 'font-mono text-xs' : 'label')}>
        {large
          ? pending
            ? `cadena íntegra hasta #${b.ok_up_to} · ${b.unanchored_tail} eslabones sin sellar`
            : `cadena íntegra hasta #${b.ok_up_to} · sellada externamente hasta #${b.last_anchored_seq}`
          : pending
            ? 'íntegra · sin sellar'
            : 'íntegra · sellada'}
      </span>
    </span>
  )
}

// ------------------------------------------------------------------ veredicto

/** Línea compacta para la línea de tiempo: "INYECTADO · mcp:issues · parcial". */
export function VerdictLine({ v }: { v: VerdictLite }) {
  if (v.label === 'TOOL_INJECTED' || v.label === 'UNVERIFIABLE')
    return (
      <Stamp size="sm">
        {VERDICT_WORD[v.label]}
        {v.source ? ` · ${v.source.split('(')[0]}` : ''}
        {v.partial ? ' · parcial' : ''}
      </Stamp>
    )
  return (
    <span className={cx('label inline-flex items-center gap-1', VERDICT_TONE[v.label])}>
      {v.label === 'USER_INSTRUCTED' && v.non_repudiable && <IconSeal className="size-3.5" />}
      {v.label === 'USER_INSTRUCTED' ? `pedido por ${v.source}` : VERDICT_WORD[v.label]}
      {v.label === 'USER_INSTRUCTED' && (v.non_repudiable ? ' · firmado' : ' · sin firma')}
    </span>
  )
}

function Who({ children, src }: { children: ReactNode; src: 'user' | 'tool' }) {
  return <span className={cx('font-semibold not-italic', SOURCE[src].text)}>{children}</span>
}

/** La frase que resume la acción, en castellano llano. */
export function VerdictSentence({
  v,
  user,
  tool,
  args,
}: {
  v: VerdictLite
  user: string | null
  tool: string
  args: Record<string, unknown>
}) {
  const who = v.source && sourceOf(v.source) === 'user' ? v.source : (user ?? 'el usuario')
  switch (v.label) {
    case 'USER_INSTRUCTED':
      return (
        <>
          <Who src="user">{who}</Who> pidió {actionPhrase(tool, args)}
          {v.non_repudiable ? ', y lo firmó.' : ', pero sin firma: puede negarlo.'}
        </>
      )
    case 'TOOL_INJECTED': {
      const src = <Who src="tool">{(v.source ?? 'una herramienta').split('(')[0]}</Who>
      if (v.partial) {
        const t = taintedArgs(v)
        const first = t[0]
        const val = first ? args[first.split('.')[0]] : undefined
        return (
          <>
            <Who src="user">{user ?? 'El usuario'}</Who> pidió {actionVerb(tool, args)}, pero{' '}
            {first ? argNoun(first) : 'un argumento'}
            {typeof val === 'string' && val !== '•••' && (
              <>
                {' '}
                <span className="font-mono text-[0.8em] text-red">{val}</span>
              </>
            )}{' '}
            lo puso {src}.
          </>
        )
      }
      return (
        <>
          {src} ordenó {actionPhrase(tool, args)}. <Who src="user">{user ?? 'El usuario'}</Who> nunca lo pidió.
        </>
      )
    }
    case 'AMBIGUOUS':
      return <>No se puede saber quién pidió {actionPhrase(tool, args)}.</>
    case 'MODEL_INITIATIVE':
      return <>Nadie pidió {actionPhrase(tool, args)}: lo decidió el modelo.</>
    case 'UNVERIFIABLE':
      return <>La cadena está rota antes de esta acción: no se puede atribuir.</>
  }
}

// ------------------------------------------------------------------ procedencia

export function ProvTag({ p, className }: { p: string; className?: string }) {
  const src = SOURCE[sourceOf(p)]
  return (
    <span className={cx('label inline-flex items-center gap-1.5 normal-case', src.text, className)}>
      <span className={cx('inline-block size-1.5 rounded-full', src.bg)} />
      {provName(p)}
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
          <mark key={i} className="bg-mark px-0.5 text-ink [box-decoration-break:clone]">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}
