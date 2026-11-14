// Tipos y llamadas a la API de `owit monitor` (Open Witness, SPEC §17.5).

export type Level = 'critical' | 'high' | 'medium' | 'info'
export type Label = 'USER_INSTRUCTED' | 'TOOL_INJECTED' | 'AMBIGUOUS' | 'MODEL_INITIATIVE' | 'UNVERIFIABLE'

export interface IntegrityBadge {
  status: 'ok' | 'pending_anchor' | 'fail' | 'unknown'
  ok?: boolean
  entries?: number
  ok_up_to?: number
  last_anchored_seq?: number
  unanchored_tail?: number
  verify_ms?: number
  missing_blobs?: number
  first_error_seq?: number | null
  failed_check?: number
  failed_check_name?: string
  error_count?: number
  errors?: { seq: number | null; error: string; detail: string; check: number }[]
}

export interface SessionSummary {
  sid: string
  user: string | null
  agent: { name?: string; version?: string }
  upstream: { profile?: string; provider?: string; model_requested?: string }
  protocol: string | null
  entries: number
  first_ts: string | null
  last_ts: string | null
  ended: boolean
  counts: Record<
    | 'prompts_signed'
    | 'text_unsigned'
    | 'llm_requests'
    | 'tool_calls'
    | 'tools_stripped'
    | 'tools_denied'
    | 'anomalies'
    | 'history_mismatch',
    number
  >
  verdicts: Partial<Record<Label, number>>
  alerts: Record<Level, number>
  integrity: IntegrityBadge
  reloads: number
}

export interface VerdictLite {
  label: Label
  source: string | null
  non_repudiable: boolean
  partial: boolean
  confidence: number
  rule?: string
  arg_provenance: Record<string, string[]>
  provisional: boolean
  integrity_ok?: boolean
}

export interface Entry {
  seq: number
  ts: string
  kind: string
  actor: { type: string; id: string } | null
  provenance: string
  hash: string
  payload_hash: string | null
  blob: 'present' | 'missing' | 'mismatch' | null
  summary: string
  fragment: string | null
  args: Record<string, unknown> | null // solo en tool_call y si el monitor muestra contenido
  meta: Record<string, unknown>
  verdict: VerdictLite | null
}

export interface Alert {
  id: string
  sid: string
  seq: number | null
  level: Level
  type: string
  title: string
  detail: string
  ts: string | null
}

export interface ContextItem {
  seq: number
  kind: string
  provenance: string
  reason: string
  resource: string | null
  matches: string[]
  fragment: string | null
}

export interface ActionDetail {
  sid: string
  seq: number
  tool: string
  user: string | null
  integrity_ok: boolean
  integrity_errors: { seq: number | null; error: string; check: number }[]
  request_seq: number | null
  args: Record<string, unknown>
  sensitive: { name: string; kind: string; decisive: boolean; value: string | null; provenance: string[] }[]
  verdict: VerdictLite & { method: string; detail: Record<string, unknown> }
  context: ContextItem[]
}

export interface Stats {
  sessions: number
  open: number
  actions: number
  by_label: Partial<Record<Label, number>>
  partial: number
  non_repudiable: number
  by_source: Record<string, number>
  by_user: Record<string, Partial<Record<Label, number>>>
  by_rule: Record<string, number>
  by_tool: Record<string, Partial<Record<Label, number>>>
  arg_sources: Partial<Record<'user_signed' | 'user_unsigned' | 'tool' | 'model' | 'nowhere', number>>
  integrity: Partial<Record<'ok' | 'pending_anchor' | 'fail' | 'unknown', number>>
  alerts: Partial<Record<Level, number>>
  alert_types: Record<string, number>
  prompts: { signed: number; unsigned: number }
  entries_by_kind: Record<string, number>
  timeline: { bucket_s: number; series: { t: string; counts: Partial<Record<Label, number>> }[] }
  verify: { p50: number; p95: number; max: number } | null
}

export interface Health {
  ok: boolean
  data: string
  sessions: number
  no_content: boolean
  pubkey_source: string
  registry_users: string[]
}

export type MonitorEvent =
  | { type: 'entries' | 'reset'; sid: string; entries: Entry[] }
  | { type: 'session'; session: SessionSummary }
  | { type: 'alert'; alert: Alert }
  | { type: 'alert_cleared'; id: string; sid: string }
  | { type: 'verdict'; sid: string; seq: number; verdict: VerdictLite }
  | { type: 'integrity'; sid: string; ok: boolean }
  | { type: 'removed'; sid: string }
  | { type: 'monitor_error'; error: string }

// ------------------------------------------------------------------ token (si el monitor escucha fuera de localhost)

const TOKEN_KEY = 'owit-monitor-token'

export function token(): string | null {
  const fromUrl = new URLSearchParams(location.search).get('token')
  try {
    if (fromUrl) sessionStorage.setItem(TOKEN_KEY, fromUrl)
    return fromUrl ?? sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return fromUrl
  }
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function get<T>(path: string): Promise<T> {
  const t = token()
  const r = await fetch(path, { headers: t ? { authorization: `Bearer ${t}` } : {} })
  if (!r.ok) throw new ApiError(r.status, `${r.status} ${await r.text()}`)
  return (await r.json()) as T
}

export const api = {
  health: () => get<Health>('/api/health'),
  sessions: () => get<SessionSummary[]>('/api/sessions'),
  entries: (sid: string, after = -1) =>
    get<{ session: SessionSummary; entries: Entry[] }>(`/api/sessions/${sid}/entries?after=${after}`),
  verify: (sid: string) => get<Record<string, unknown> & { badge: IntegrityBadge }>(`/api/sessions/${sid}/verify`),
  action: (sid: string, seq: number) => get<ActionDetail>(`/api/sessions/${sid}/actions/${seq}`),
  alerts: () => get<Alert[]>('/api/alerts'),
  stats: () => get<Stats>('/api/stats'),
  eventsUrl: () => {
    const t = token()
    return `/api/events${t ? `?token=${encodeURIComponent(t)}` : ''}`
  },
}
