import type { ReactNode } from 'react'
import type { IntegrityBadge as IB, Label, VerdictLite } from '../api'
import {
  actionPhrase,
  actionVerb,
  argNoun,
  cx,
  LABEL_TONE,
  provName,
  SOURCE,
  sourceOf,
  taintedArgs,
  TONE,
  verdictTone,
  type Tone,
} from '../lib/format'

// ------------------------------------------------------------------ iconos (trazo fino, heredan el color)

type IconProps = { className?: string; title?: string }

export function IconSeal({ className, title }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cx('size-4', className)} aria-hidden={!title} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.5 12.3l2.4 2.4L15.5 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
      <path d="M10 8.5H6.5a3.5 3.5 0 000 7H9" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M14 15.5h3.5a3.5 3.5 0 000-7H15" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M11 5l1 3M13 19l-1-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

export function IconRefresh({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cx('size-4', className)} aria-hidden>
      <path d="M19 12a7 7 0 11-2.05-4.95M19 4.5V8h-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export function IconArrow({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cx('size-3', className)} aria-hidden>
      <path d="M4 12h15M14 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function Chevron({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cx('size-3.5 transition-transform', className)} aria-hidden>
      <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

// ------------------------------------------------------------------ desplegable

export function Disclosure({
  summary,
  children,
  className,
  open,
}: {
  summary: ReactNode
  children: ReactNode
  className?: string
  open?: boolean
}) {
  return (
    <details className={cx('group', className)} open={open} onClick={(e) => e.stopPropagation()}>
      <summary className="label flex cursor-pointer items-center gap-1.5 text-ink-3 select-none hover:text-ink">
        <Chevron className="group-open:rotate-90" />
        {summary}
      </summary>
      <div className="pt-2">{children}</div>
    </details>
  )
}

// ------------------------------------------------------------------ insignias (rectas, sólidas)

export function Badge({
  tone,
  size = 'sm',
  solid = true,
  icon,
  children,
  className,
}: {
  tone: Tone
  size?: 'sm' | 'lg'
  solid?: boolean
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  const t = TONE[tone]
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center font-mono font-medium tracking-wide uppercase',
        size === 'sm' ? 'gap-1 rounded-[4px] px-1.5 py-[3px] text-[10.5px] leading-none' : 'gap-2 rounded-md px-3 py-1.5 text-[13px]',
        solid ? cx(t.bg, 'text-paper') : cx(t.soft, t.text),
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

export function IntegrityBadge({ b, size = 'sm' }: { b: IB; size?: 'sm' | 'lg' }) {
  const ic = size === 'lg' ? 'size-4' : 'size-3'
  if (b.status === 'unknown')
    return (
      <Badge tone="muted" solid={false} size={size}>
        verificando
      </Badge>
    )
  if (b.status === 'fail')
    return (
      <Badge tone="alarm" size={size} icon={<IconBroken className={ic} />}>
        alterada
      </Badge>
    )
  if (b.status === 'pending_anchor')
    return (
      <Badge tone="muted" solid={false} size={size} icon={<IconLink className={ic} />}>
        íntegra · sin sellar
      </Badge>
    )
  return (
    <Badge tone="user" solid={false} size={size} icon={<IconSeal className={ic} />}>
      íntegra
    </Badge>
  )
}

export function VerdictBadge({ v, size = 'sm' }: { v: VerdictLite; size?: 'sm' | 'lg' }) {
  const tone = verdictTone(v)
  const src = v.source?.split('(')[0]
  let text: string
  switch (v.label) {
    case 'USER_INSTRUCTED':
      text = v.non_repudiable ? `firmado · ${src}` : `${src} · sin firma`
      break
    case 'TOOL_INJECTED':
      text = `inyectado · ${src}`
      break
    case 'AMBIGUOUS':
      text = 'ambiguo'
      break
    case 'MODEL_INITIATIVE':
      text = 'iniciativa del modelo'
      break
    case 'UNVERIFIABLE':
      text = 'no verificable'
      break
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge
        tone={tone}
        size={size}
        solid={tone === 'alarm' || tone === 'user'}
        icon={v.label === 'USER_INSTRUCTED' && v.non_repudiable ? <IconSeal className={size === 'lg' ? 'size-4' : 'size-3'} /> : undefined}
      >
        {text}
      </Badge>
      {v.partial && (
        <Badge tone="alarm" size={size} solid={false}>
          parcial
        </Badge>
      )}
    </span>
  )
}

const BAR_ORDER: Label[] = ['TOOL_INJECTED', 'UNVERIFIABLE', 'AMBIGUOUS', 'MODEL_INITIATIVE', 'USER_INSTRUCTED']

/** Barra de composición: un segmento por acción, coloreado por su veredicto. */
export function VerdictBar({
  verdicts,
  total,
  className,
}: {
  verdicts: Partial<Record<Label, number>>
  total: number
  className?: string
}) {
  const known = BAR_ORDER.reduce((n, l) => n + (verdicts[l] ?? 0), 0)
  const pending = Math.max(0, total - known)
  if (!total) return <div className={cx('h-1.5 rounded-full bg-rule', className)} />
  return (
    <div className={cx('flex h-1.5 gap-[2px] overflow-hidden rounded-full', className)}>
      {BAR_ORDER.flatMap((l) =>
        Array.from({ length: verdicts[l] ?? 0 }, (_, i) => (
          <span key={`${l}${i}`} className={cx('flex-1', TONE[LABEL_TONE[l]].bg)} title={l} />
        )),
      )}
      {Array.from({ length: pending }, (_, i) => (
        <span key={`p${i}`} className="flex-1 bg-rule" />
      ))}
    </div>
  )
}

/** "to ← mcp:issues": de dónde salió cada argumento, en chips. */
export function ArgFlow({ v }: { v: VerdictLite }) {
  const seen = new Set<string>()
  const rows = Object.entries(v.arg_provenance).filter(([k]) => {
    const key = k.split('#')[0]
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (!rows.length) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {rows.map(([k, ps]) => (
        <span key={k} className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-2">
          {k.split('#')[0]}
          <span className="text-ink-3">←</span>
          {ps.length ? (
            ps.map((p) => (
              <span key={p} className={cx('inline-flex items-center gap-1', SOURCE[sourceOf(p)].text)}>
                <span className={cx('size-1.5 rounded-full', SOURCE[sourceOf(p)].bg)} />
                {provName(p).replace(' · ', ' ')}
              </span>
            ))
          ) : (
            <span className="text-model italic">nadie</span>
          )}
        </span>
      ))}
    </span>
  )
}

function Who({ children, src }: { children: ReactNode; src: 'user' | 'tool' }) {
  return <span className={cx('font-semibold', SOURCE[src].text)}>{children}</span>
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
          {v.non_repudiable ? ', y lo firmó.' : ', pero sin firma.'}
        </>
      )
    case 'TOOL_INJECTED': {
      const src = <Who src="tool">{(v.source ?? 'una herramienta').split('(')[0]}</Who>
      if (v.partial) {
        const first = taintedArgs(v)[0]
        const val = first ? args[first.split('.')[0]] : undefined
        return (
          <>
            <Who src="user">{user ?? 'El usuario'}</Who> pidió {actionVerb(tool, args)}, pero{' '}
            {first ? argNoun(first) : 'un argumento'}
            {typeof val === 'string' && val !== '•••' && (
              <>
                {' '}
                <span className="font-mono text-[0.8em] text-alarm">{val}</span>
              </>
            )}{' '}
            lo puso {src}.
          </>
        )
      }
      return (
        <>
          {src} ordenó {actionPhrase(tool, args)}. <Who src="user">{user ?? 'El usuario'}</Who> no lo pidió.
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
          <mark key={i} className="rounded-[2px] bg-mark px-0.5 text-ink [box-decoration-break:clone]">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}
