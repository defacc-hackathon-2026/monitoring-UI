import type { Entry, Label, Level, VerdictLite } from '../api'

// ------------------------------------------------------------------ carriles: quién habla en cada entrada

export type Lane = 'user' | 'agent' | 'model' | 'tools' | 'gateway'

export const LANES: { id: Lane; short: string; label: string }[] = [
  { id: 'user', short: 'USU', label: 'Usuario' },
  { id: 'agent', short: 'AGE', label: 'Agente' },
  { id: 'model', short: 'MOD', label: 'Modelo' },
  { id: 'tools', short: 'HER', label: 'Herramientas' },
  { id: 'gateway', short: 'GAT', label: 'Gateway' },
]

export function laneOf(e: Entry): Lane {
  switch (e.kind) {
    case 'user_prompt':
      return 'user'
    case 'user_text_unsigned':
      return e.meta.reason === 'no_hook' || e.meta.reason === 'no_match' ? 'user' : 'agent'
    case 'llm_request':
    case 'context_reset':
      return 'agent'
    case 'llm_response':
    case 'tool_call':
      return 'model'
    case 'tool_result':
      return 'tools'
    default:
      return 'gateway'
  }
}

// ------------------------------------------------------------------ color = procedencia (solo tres)

export type Source = 'user' | 'tool' | 'model' | 'other'

export function sourceOf(prov: string): Source {
  if (prov === 'user_signed' || prov === 'user_unsigned') return 'user'
  if (prov.startsWith('mcp:') || prov.startsWith('builtin:') || prov.startsWith('hosted:')) return 'tool'
  if (prov === 'model') return 'model'
  return 'other'
}

export const SOURCE = {
  user: { text: 'text-seal', bg: 'bg-seal', soft: 'bg-seal/10', border: 'border-seal', stroke: 'var(--seal)' },
  tool: { text: 'text-ochre', bg: 'bg-ochre', soft: 'bg-ochre/10', border: 'border-ochre', stroke: 'var(--ochre)' },
  model: { text: 'text-model', bg: 'bg-model', soft: 'bg-model/10', border: 'border-model', stroke: 'var(--model)' },
  other: { text: 'text-ink-3', bg: 'bg-ink-3', soft: 'bg-ink-3/10', border: 'border-ink-3', stroke: 'var(--ink-3)' },
} as const

export function provName(prov: string): string {
  switch (prov) {
    case 'user_signed':
      return 'usuario · firmado'
    case 'user_unsigned':
      return 'usuario · sin firma'
    case 'agent_injected':
      return 'agente'
    case 'system':
      return 'system'
    case 'model':
      return 'modelo'
    case 'compaction':
      return 'compactación'
    default:
      return prov
  }
}

// ------------------------------------------------------------------ veredictos

export const VERDICT_TONE: Record<Label, string> = {
  USER_INSTRUCTED: 'text-seal',
  TOOL_INJECTED: 'text-red',
  AMBIGUOUS: 'text-mustard',
  MODEL_INITIATIVE: 'text-model',
  UNVERIFIABLE: 'text-red',
}

export const VERDICT_WORD: Record<Label, string> = {
  USER_INSTRUCTED: 'pedido por el usuario',
  TOOL_INJECTED: 'inyectado',
  AMBIGUOUS: 'ambiguo',
  MODEL_INITIATIVE: 'iniciativa del modelo',
  UNVERIFIABLE: 'no verificable',
}

export const LEVEL: Record<Level, { word: string; tone: string }> = {
  critical: { word: 'crítico', tone: 'text-red' },
  high: { word: 'alto', tone: 'text-ochre' },
  medium: { word: 'medio', tone: 'text-mustard' },
  info: { word: 'info', tone: 'text-ink-3' },
}

// ------------------------------------------------------------------ frases en castellano llano

function base(tool: string): string {
  const parts = tool.split('__')
  return tool.startsWith('mcp__') && parts.length >= 3 ? parts.slice(2).join('__') : tool
}

function s(v: unknown): string {
  return typeof v === 'string' ? v : v === undefined ? '' : JSON.stringify(v)
}

function isPost(args: Record<string, unknown>): boolean {
  return String(args.method ?? 'GET').toUpperCase() !== 'GET' || Boolean(args.body ?? args.data)
}

/** "enviar un correo" (sin el argumento, para cuando el argumento no lo puso el usuario). */
export function actionVerb(tool: string, args: Record<string, unknown>): string {
  switch (base(tool)) {
    case 'send_email':
      return 'enviar un correo'
    case 'write_file':
    case 'Write':
    case 'Edit':
      return 'escribir un archivo'
    case 'read_file':
    case 'Read':
      return 'leer un archivo'
    case 'fetch':
    case 'WebFetch':
      return isPost(args) ? 'enviar datos a una URL' : 'abrir una página'
    case 'list_issues':
      return 'listar los issues'
    case 'get_issue':
      return 'consultar un issue'
    case 'Bash':
      return 'ejecutar un comando'
    default:
      return `usar ${base(tool)}`
  }
}

/** "enviar un correo a reportes@evil.test" */
export function actionPhrase(tool: string, args: Record<string, unknown>): string {
  switch (base(tool)) {
    case 'send_email':
      return `enviar un correo a ${s(args.to)}`
    case 'write_file':
    case 'Write':
    case 'Edit':
      return `escribir ${s(args.path ?? args.file_path)}`
    case 'read_file':
    case 'Read':
      return `leer ${s(args.path ?? args.file_path)}`
    case 'fetch':
    case 'WebFetch':
      return isPost(args) ? `enviar datos a ${s(args.url)}` : `abrir ${s(args.url)}`
    case 'list_issues':
      return `listar los issues de ${s(args.project)}`
    case 'get_issue':
      return `consultar el issue ${s(args.issue_id)}`
    case 'Bash':
      return `ejecutar «${s(args.command).slice(0, 60)}»`
    default:
      return `usar ${base(tool)}`
  }
}

export function argNoun(name: string): string {
  const k = name.split(/[.[]/)[0]
  return (
    { to: 'el destinatario', url: 'la URL', path: 'la ruta', command: 'el comando', amount: 'el monto' } as Record<
      string,
      string
    >
  )[k] ?? `«${k}»`
}

export function toolName(tool: string): string {
  return base(tool)
}

/** Argumentos que salieron solo de herramientas (los que hacen "parcial" un veredicto). */
export function taintedArgs(v: VerdictLite): string[] {
  return Object.entries(v.arg_provenance)
    .filter(([, ps]) => ps.length > 0 && ps.every((p) => sourceOf(p) === 'tool'))
    .map(([k]) => k.split('#')[0])
}

// ------------------------------------------------------------------ utilidades

/** Número de expediente: "exp. 007". */
export function caseNo(n: number): string {
  return `exp. ${String(n).padStart(3, '0')}`
}

export function ago(ts: string | null | undefined, now: number): string {
  if (!ts) return '—'
  const sec = Math.max(0, Math.round((now - Date.parse(ts)) / 1000))
  if (sec < 5) return 'ahora'
  if (sec < 60) return `hace ${sec} s`
  if (sec < 3600) return `hace ${Math.floor(sec / 60)} min`
  if (sec < 86400) return `hace ${Math.floor(sec / 3600)} h`
  return new Date(ts).toLocaleDateString()
}

export function clock(ts: string | null | undefined): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function short(h: string | null | undefined, n = 6): string {
  if (!h) return ''
  return h.replace('sha256:', '').slice(0, n)
}

export function cx(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ')
}
