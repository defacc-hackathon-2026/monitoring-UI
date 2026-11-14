import { useEffect, useState } from 'react'
import { api, type Label, type Stats } from '../api'
import { cx } from '../lib/format'
import { ChartCard, HBars, SegmentedBar, StackedColumns, TooltipLayer, type Series } from './Charts'

// Orden fijo de las series (validado por pares adyacentes: verde · ámbar · violeta · rojo).
const VERDICTS: (Series & { key: Label })[] = [
  { key: 'USER_INSTRUCTED', label: 'Pedido por el usuario', color: 'var(--c-user)' },
  { key: 'AMBIGUOUS', label: 'Ambiguo', color: 'var(--c-warn)' },
  { key: 'MODEL_INITIATIVE', label: 'Iniciativa del modelo', color: 'var(--c-model)' },
  { key: 'TOOL_INJECTED', label: 'Inyectado por una herramienta', color: 'var(--c-alarm)' },
  { key: 'UNVERIFIABLE', label: 'No verificable', color: 'var(--c-none)' },
]

const ARG_SOURCES: Series[] = [
  { key: 'user_signed', label: 'Texto firmado del usuario', color: 'var(--c-user)' },
  { key: 'user_unsigned', label: 'Texto del usuario sin firma', color: 'var(--c-warn)' },
  { key: 'tool', label: 'Solo una herramienta', color: 'var(--c-tool)' },
  { key: 'model', label: 'Solo el modelo', color: 'var(--c-model)' },
  { key: 'nowhere', label: 'En ningún lado', color: 'var(--c-none)' },
]

const INTEGRITY: Series[] = [
  { key: 'ok', label: 'Íntegra y sellada', color: 'var(--c-user)' },
  { key: 'pending_anchor', label: 'Íntegra, sin sellar', color: 'var(--c-none)' },
  { key: 'fail', label: 'Alterada', color: 'var(--c-alarm)' },
]

const ALERT_TYPE: Record<string, string> = {
  tool_injected: 'acción inyectada',
  integrity_fail: 'bitácora alterada',
  tool_stripped: 'herramienta quitada',
  tool_denied: 'denegada por el hook',
  anomaly: 'anomalía',
  history_mismatch: 'historial distinto',
  unsigned_text: 'texto sin firma',
}

function present<T extends Series>(series: T[], values: Record<string, number | undefined>): T[] {
  return series.filter((s) => (values[s.key] ?? 0) > 0)
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'alarm' | 'user' }) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-[0_0_0_1px_var(--rule)]">
      <div className="text-[13px] text-ink-2">{label}</div>
      <div className={cx('mt-1 text-[30px] leading-none font-medium', tone === 'alarm' ? 'text-alarm' : tone === 'user' ? 'text-user' : 'text-ink')}>
        {value}
      </div>
      {sub && <div className="mt-1.5 font-mono text-[11px] text-ink-3">{sub}</div>}
    </div>
  )
}

function bucketLabel(s: number): string {
  return s < 60 ? `${s} s` : s < 3600 ? `${s / 60} min` : s < 86400 ? `${s / 3600} h` : 'día'
}

export function StatsView() {
  const [st, setSt] = useState<Stats | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [stale, setStale] = useState(false)

  useEffect(() => {
    let live = true
    const load = async () => {
      setStale(true)
      try {
        const s = await api.stats()
        if (live) {
          setSt(s)
          setErr(null)
        }
      } catch (e) {
        if (live) setErr(e instanceof Error ? e.message : String(e))
      } finally {
        if (live) setStale(false)
      }
    }
    void load()
    const t = setInterval(load, 3000)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [])

  if (!st) return <p className="p-8 text-ink-3 italic">{err ?? 'Calculando…'}</p>

  const n = st.actions
  const inj = st.by_label.TOOL_INJECTED ?? 0
  const pctInj = n ? Math.round((inj / n) * 100) : 0
  const fail = st.integrity.fail ?? 0
  const verdictParts = VERDICTS.map((v) => ({ ...v, value: st.by_label[v.key] ?? 0, ink: v.key === 'AMBIGUOUS' ? ('dark' as const) : undefined }))
  const users = Object.entries(st.by_user).sort((a, b) => sum(b[1]) - sum(a[1]))
  const tools = Object.entries(st.by_tool).sort((a, b) => sum(b[1]) - sum(a[1]))
  const sources = Object.entries(st.by_source).sort((a, b) => b[1] - a[1])
  const rules = ['R1', 'R1b', 'R2', 'R2b', 'R3', 'R4', 'INTEGRITY'].filter((r) => st.by_rule[r])
  const alertTypes = Object.entries(st.alert_types).sort((a, b) => b[1] - a[1])
  const t0 = st.timeline.series[0]?.t
  const clockOf = (i: number) =>
    new Date(st.timeline.series[i].t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: st.timeline.bucket_s < 60 ? '2-digit' : undefined })

  return (
    <TooltipLayer>
      <div className={cx('mx-auto max-w-[1400px] space-y-5 p-6 transition-opacity', stale && 'opacity-90')}>
        {/* cifra principal + tarjetas */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
          <section className="rounded-xl bg-card p-6 shadow-[0_0_0_1px_var(--rule)]">
            <div className="text-[14px] text-ink-2">Acciones que vinieron de una herramienta, no del usuario</div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className={cx('text-[64px] leading-none font-medium tracking-tight', inj ? 'text-alarm' : 'text-ink')}>
                {pctInj} %
              </span>
              <span className="font-mono text-[12px] text-ink-3">
                {inj} de {n} · {st.partial} parciales
              </span>
            </div>
            <div className="mt-5">
              <SegmentedBar parts={verdictParts} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {present(VERDICTS, st.by_label).map((v) => (
                <span key={v.key} className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
                  <span className="size-2.5 rounded-[3px]" style={{ background: v.color }} />
                  {v.label}
                  <span className="font-mono text-ink-3">{st.by_label[v.key]}</span>
                </span>
              ))}
            </div>
          </section>
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
            <Tile label="Sesiones" value={String(st.sessions)} sub={`${st.open} en curso`} />
            <Tile label="Acciones atribuidas" value={String(n)} sub="solo reglas, sin juez" />
            <Tile label="Con no repudio" value={String(st.non_repudiable)} sub={`${st.prompts.signed} prompts firmados`} tone="user" />
            <Tile label="Bitácoras alteradas" value={String(fail)} sub={fail ? 'la cadena no verifica' : 'todas verifican'} tone={fail ? 'alarm' : undefined} />
            <Tile label="Alertas críticas y altas" value={String((st.alerts.critical ?? 0) + (st.alerts.high ?? 0))} sub={`${st.alerts.medium ?? 0} medias · ${st.alerts.info ?? 0} info`} />
            <Tile label="Verificar una bitácora" value={st.verify ? `${st.verify.p50} ms` : '—'} sub={st.verify ? `p95 ${st.verify.p95} ms · máx. ${st.verify.max} ms` : undefined} />
          </div>
        </div>

        <ChartCard
          title="Acciones en el tiempo, por veredicto"
          note={t0 ? `cada columna son ${bucketLabel(st.timeline.bucket_s)}` : undefined}
          legend={present(VERDICTS, st.by_label)}
          table={{
            head: ['inicio', ...present(VERDICTS, st.by_label).map((v) => v.label)],
            rows: st.timeline.series.map((b, i) => [clockOf(i), ...present(VERDICTS, st.by_label).map((v) => b.counts[v.key] ?? 0)]),
          }}
        >
          <StackedColumns
            data={st.timeline.series.map((b, i) => ({ x: clockOf(i), values: b.counts as Record<string, number> }))}
            series={present(VERDICTS, st.by_label)}
            xLabel={clockOf}
          />
        </ChartCard>

        <div className="grid gap-5 lg:grid-cols-2">
          <ChartCard
            title="Origen de las inyecciones"
            note="herramienta que aportó la orden o el destino"
            table={{ head: ['fuente', 'acciones'], rows: sources }}
          >
            <HBars
              rows={sources.map(([k, v]) => ({ label: k, values: { n: v } }))}
              series={[{ key: 'n', label: 'acciones inyectadas', color: 'var(--c-alarm)' }]}
            />
          </ChartCard>

          <ChartCard
            title="¿De dónde salieron los argumentos sensibles?"
            note="destinatarios, URLs, rutas y comandos de cada acción"
            legend={present(ARG_SOURCES, st.arg_sources)}
            table={{ head: ['origen', 'argumentos'], rows: ARG_SOURCES.map((s) => [s.label, st.arg_sources[s.key as keyof Stats['arg_sources']] ?? 0]) }}
          >
            <SegmentedBar
              parts={ARG_SOURCES.map((s) => ({ ...s, value: st.arg_sources[s.key as keyof Stats['arg_sources']] ?? 0, ink: s.key === 'user_unsigned' ? ('dark' as const) : undefined }))}
            />
          </ChartCard>

          <ChartCard
            title="Veredictos por usuario"
            legend={present(VERDICTS, st.by_label)}
            table={{ head: ['usuario', ...VERDICTS.map((v) => v.label)], rows: users.map(([u, c]) => [u, ...VERDICTS.map((v) => c[v.key] ?? 0)]) }}
          >
            <HBars rows={users.map(([u, c]) => ({ label: u, values: c as Record<string, number> }))} series={present(VERDICTS, st.by_label)} />
          </ChartCard>

          <ChartCard
            title="Veredictos por herramienta"
            legend={present(VERDICTS, st.by_label)}
            table={{ head: ['herramienta', ...VERDICTS.map((v) => v.label)], rows: tools.map(([t, c]) => [t, ...VERDICTS.map((v) => c[v.key] ?? 0)]) }}
          >
            <HBars rows={tools.map(([t, c]) => ({ label: t, values: c as Record<string, number> }))} series={present(VERDICTS, st.by_label)} />
          </ChartCard>

          <ChartCard
            title="Qué regla decidió"
            note="R1 firmado · R1b sin firma · R2 orden de una herramienta · R2b destino de una herramienta · R3 ambiguo · R4 nadie"
            table={{ head: ['regla', 'acciones'], rows: rules.map((r) => [r, st.by_rule[r]]) }}
          >
            <HBars
              rows={rules.map((r) => ({ label: r, values: { n: st.by_rule[r] } }))}
              series={[{ key: 'n', label: 'acciones', color: 'var(--c-tool)' }]}
            />
          </ChartCard>

          <ChartCard
            title="Integridad de las bitácoras"
            legend={present(INTEGRITY, st.integrity)}
            table={{ head: ['estado', 'sesiones'], rows: INTEGRITY.map((s) => [s.label, st.integrity[s.key as keyof Stats['integrity']] ?? 0]) }}
          >
            <SegmentedBar parts={INTEGRITY.map((s) => ({ ...s, value: st.integrity[s.key as keyof Stats['integrity']] ?? 0, ink: s.key === 'pending_anchor' ? ('dark' as const) : undefined }))} />
            <div className="mt-6">
              <div className="mb-2 text-[13px] text-ink-2">Alertas por tipo</div>
              <HBars
                rows={alertTypes.map(([k, v]) => ({ label: ALERT_TYPE[k] ?? k, values: { n: v } }))}
                series={[{ key: 'n', label: 'alertas', color: 'var(--c-warn)' }]}
              />
            </div>
          </ChartCard>
        </div>
      </div>
    </TooltipLayer>
  )
}

function sum(c: Partial<Record<Label, number>>): number {
  return Object.values(c).reduce((a, b) => a + (b ?? 0), 0)
}
