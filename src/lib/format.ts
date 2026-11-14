import type { Label, Level } from '../api'

// Colores por procedencia (SPEC §7.9): los mismos en la línea de tiempo, el contexto de una acción y los chips.
export interface Tone {
  bar: string // franja lateral
  chip: string // fondo + texto del chip
  dot: string
  label: string
}

const TONES: Record<string, Tone> = {
  user_signed: {
    bar: 'bg-emerald-500',
    chip: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30',
    dot: 'bg-emerald-500',
    label: 'usuario firmado',
  },
  user_unsigned: {
    bar: 'bg-amber-500',
    chip: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-amber-500/30',
    dot: 'bg-amber-500',
    label: 'usuario sin firma',
  },
  mcp: {
    bar: 'bg-violet-500',
    chip: 'bg-violet-500/12 text-violet-700 dark:text-violet-300 ring-violet-500/30',
    dot: 'bg-violet-500',
    label: 'herramienta MCP',
  },
  builtin: {
    bar: 'bg-orange-500',
    chip: 'bg-orange-500/12 text-orange-700 dark:text-orange-300 ring-orange-500/30',
    dot: 'bg-orange-500',
    label: 'herramienta interna',
  },
  hosted: {
    bar: 'bg-pink-500',
    chip: 'bg-pink-500/12 text-pink-700 dark:text-pink-300 ring-pink-500/30',
    dot: 'bg-pink-500',
    label: 'herramienta alojada',
  },
  model: {
    bar: 'bg-sky-500',
    chip: 'bg-sky-500/12 text-sky-700 dark:text-sky-300 ring-sky-500/30',
    dot: 'bg-sky-500',
    label: 'modelo',
  },
  agent_injected: {
    bar: 'bg-slate-400',
    chip: 'bg-slate-500/12 text-slate-600 dark:text-slate-300 ring-slate-500/30',
    dot: 'bg-slate-400',
    label: 'agente',
  },
  system: {
    bar: 'bg-slate-400',
    chip: 'bg-slate-500/12 text-slate-600 dark:text-slate-300 ring-slate-500/30',
    dot: 'bg-slate-400',
    label: 'system',
  },
  compaction: {
    bar: 'bg-slate-400',
    chip: 'bg-slate-500/12 text-slate-600 dark:text-slate-300 ring-slate-500/30',
    dot: 'bg-slate-400',
    label: 'compactación',
  },
  agent: {
    bar: 'bg-indigo-400',
    chip: 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 ring-indigo-500/30',
    dot: 'bg-indigo-400',
    label: 'agente → LLM',
  },
  hook: {
    bar: 'bg-teal-500',
    chip: 'bg-teal-500/12 text-teal-700 dark:text-teal-300 ring-teal-500/30',
    dot: 'bg-teal-500',
    label: 'hook',
  },
  gateway: {
    bar: 'bg-zinc-400 dark:bg-zinc-600',
    chip: 'bg-zinc-500/12 text-zinc-600 dark:text-zinc-300 ring-zinc-500/30',
    dot: 'bg-zinc-400',
    label: 'gateway',
  },
}

export function tone(prov: string): Tone {
  if (prov.startsWith('mcp:')) return TONES.mcp
  if (prov.startsWith('builtin:')) return TONES.builtin
  if (prov.startsWith('hosted:')) return TONES.hosted
  return TONES[prov] ?? TONES.gateway
}

export function provLabel(prov: string): string {
  if (prov.includes(':')) return prov
  return tone(prov).label
}

export const LEGEND = ['user_signed', 'user_unsigned', 'mcp:*', 'builtin:*', 'model', 'agent', 'hook', 'gateway']

export const VERDICT: Record<Label, { text: string; cls: string; short: string }> = {
  USER_INSTRUCTED: {
    text: 'Pedido por el usuario',
    short: 'USUARIO',
    cls: 'bg-emerald-600 text-white',
  },
  TOOL_INJECTED: {
    text: 'Inyectado por una herramienta',
    short: 'INYECTADO',
    cls: 'bg-red-600 text-white',
  },
  AMBIGUOUS: { text: 'Ambiguo', short: 'AMBIGUO', cls: 'bg-amber-500 text-black' },
  MODEL_INITIATIVE: { text: 'Iniciativa del modelo', short: 'MODELO', cls: 'bg-sky-600 text-white' },
  UNVERIFIABLE: {
    text: 'No verificable: la bitácora falla',
    short: 'NO VERIFICABLE',
    cls: 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900',
  },
}

export const LEVEL: Record<Level, { text: string; cls: string; dot: string }> = {
  critical: { text: 'crítica', cls: 'text-red-600 dark:text-red-400', dot: 'bg-red-600' },
  high: { text: 'alta', cls: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
  medium: { text: 'media', cls: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  info: { text: 'info', cls: 'text-zinc-500', dot: 'bg-zinc-400' },
}

export function ago(ts: string | null | undefined, now: number): string {
  if (!ts) return '—'
  const s = Math.max(0, Math.round((now - Date.parse(ts)) / 1000))
  if (s < 5) return 'ahora'
  if (s < 60) return `hace ${s} s`
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  return new Date(ts).toLocaleDateString()
}

export function clock(ts: string | null | undefined): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function short(h: string | null | undefined, n = 10): string {
  if (!h) return ''
  return h.replace('sha256:', '').slice(0, n)
}

export function cx(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ')
}
