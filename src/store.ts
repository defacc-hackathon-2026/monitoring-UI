import { useCallback, useEffect, useReducer, useRef } from 'react'
import { api, type Alert, type Entry, type Health, type MonitorEvent, type SessionSummary } from './api'

export type Conn = 'connecting' | 'live' | 'reconnecting' | 'error'

export interface State {
  conn: Conn
  health: Health | null
  sessions: Record<string, SessionSummary>
  entries: Record<string, Entry[]> // solo las sesiones abiertas
  alerts: Record<string, Alert>
  fresh: Record<string, number> // sid:seq → instante en que llegó (para resaltar lo nuevo)
  lastEventAt: number | null
  error: string | null
}

type Action =
  | { t: 'conn'; conn: Conn }
  | { t: 'health'; health: Health }
  | { t: 'sessions'; sessions: SessionSummary[] }
  | { t: 'alerts'; alerts: Alert[] }
  | { t: 'entries'; sid: string; entries: Entry[]; session: SessionSummary }
  | { t: 'event'; e: MonitorEvent; at: number }
  | { t: 'error'; error: string | null }

const initial: State = {
  conn: 'connecting',
  health: null,
  sessions: {},
  entries: {},
  alerts: {},
  fresh: {},
  lastEventAt: null,
  error: null,
}

function mergeEntries(old: Entry[], add: Entry[]): Entry[] {
  if (!add.length) return old
  const bySeq = new Map(old.map((e) => [e.seq, e]))
  for (const e of add) bySeq.set(e.seq, e)
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq)
}

function reduce(s: State, a: Action): State {
  switch (a.t) {
    case 'conn':
      return { ...s, conn: a.conn }
    case 'health':
      return { ...s, health: a.health }
    case 'error':
      return { ...s, error: a.error }
    case 'sessions':
      return { ...s, sessions: Object.fromEntries(a.sessions.map((x) => [x.sid, x])) }
    case 'alerts':
      return { ...s, alerts: Object.fromEntries(a.alerts.map((x) => [x.id, x])) }
    case 'entries':
      return {
        ...s,
        sessions: { ...s.sessions, [a.sid]: a.session },
        entries: { ...s.entries, [a.sid]: a.entries },
      }
    case 'event': {
      const e = a.e
      const next: State = { ...s, lastEventAt: a.at }
      switch (e.type) {
        case 'session':
          next.sessions = { ...s.sessions, [e.session.sid]: e.session }
          break
        case 'entries':
        case 'reset': {
          const open = s.entries[e.sid]
          if (open)
            next.entries = {
              ...s.entries,
              [e.sid]: e.type === 'reset' ? mergeEntries([], e.entries) : mergeEntries(open, e.entries),
            }
          if (e.type === 'entries') {
            const fresh = { ...s.fresh }
            for (const x of e.entries) fresh[`${e.sid}:${x.seq}`] = a.at
            next.fresh = fresh
          }
          break
        }
        case 'verdict': {
          const list = s.entries[e.sid]
          if (list)
            next.entries = {
              ...s.entries,
              [e.sid]: list.map((x) => (x.seq === e.seq ? { ...x, verdict: e.verdict } : x)),
            }
          break
        }
        case 'alert':
          next.alerts = { ...s.alerts, [e.alert.id]: e.alert }
          break
        case 'alert_cleared': {
          const { [e.id]: _gone, ...rest } = s.alerts
          void _gone
          next.alerts = rest
          break
        }
        case 'removed': {
          const { [e.sid]: _s, ...sessions } = s.sessions
          void _s
          next.sessions = sessions
          break
        }
        case 'monitor_error':
          next.error = e.error
          break
        case 'integrity':
          break
      }
      return next
    }
  }
}

export function useMonitor() {
  const [state, dispatch] = useReducer(reduce, initial)
  const loaded = useRef(new Set<string>())

  const reloadAll = useCallback(async () => {
    try {
      const [health, sessions, alerts] = await Promise.all([api.health(), api.sessions(), api.alerts()])
      dispatch({ t: 'health', health })
      dispatch({ t: 'sessions', sessions })
      dispatch({ t: 'alerts', alerts })
      dispatch({ t: 'error', error: null })
      // las sesiones abiertas se vuelven a pedir completas (pudo haber huecos mientras no había conexión)
      for (const sid of loaded.current) {
        const r = await api.entries(sid)
        dispatch({ t: 'entries', sid, entries: r.entries, session: r.session })
      }
    } catch (err) {
      dispatch({ t: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  useEffect(() => {
    let es: EventSource | null = null
    let retry: ReturnType<typeof setTimeout> | undefined
    let closed = false
    let attempt = 0

    const connect = () => {
      es = new EventSource(api.eventsUrl())
      es.addEventListener('hello', () => {
        attempt = 0
        dispatch({ t: 'conn', conn: 'live' })
        void reloadAll()
      })
      es.onmessage = (m) => {
        try {
          dispatch({ t: 'event', e: JSON.parse(m.data) as MonitorEvent, at: Date.now() })
        } catch {
          /* línea rara: se ignora */
        }
      }
      es.onerror = () => {
        es?.close()
        if (closed) return
        dispatch({ t: 'conn', conn: attempt > 3 ? 'error' : 'reconnecting' })
        attempt += 1
        retry = setTimeout(connect, Math.min(1000 * 2 ** attempt, 10000))
      }
    }
    connect()
    return () => {
      closed = true
      clearTimeout(retry)
      es?.close()
    }
  }, [reloadAll])

  const openSession = useCallback(async (sid: string) => {
    loaded.current.add(sid)
    try {
      const r = await api.entries(sid)
      dispatch({ t: 'entries', sid, entries: r.entries, session: r.session })
    } catch (err) {
      dispatch({ t: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  return { state, openSession, reloadAll }
}
