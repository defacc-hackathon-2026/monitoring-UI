// Gráficos a mano (HTML + CSS), con las reglas de la skill dataviz:
// marcas finas (<= 24px, extremo redondeado de 4px y base recta), 2px de hueco entre segmentos,
// grilla en línea fina, leyenda para >= 2 series, tooltip por marca y tabla en un desplegable.
import { createContext, useContext, useState, type ReactNode } from 'react'
import { cx } from '../lib/format'
import { Disclosure } from './Marks'

export interface Series {
  key: string
  label: string
  color: string // var(--c-…)
}

// ------------------------------------------------------------------ tooltip único

interface Tip {
  x: number
  y: number
  title: string
  rows: { label: string; value: string; color?: string }[]
}

const TipCtx = createContext<(t: Tip | null) => void>(() => {})

export function TooltipLayer({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<Tip | null>(null)
  return (
    <TipCtx.Provider value={setTip}>
      {children}
      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 min-w-40 rounded-lg bg-card px-3 py-2 shadow-[0_0_0_1px_var(--rule),0_8px_24px_rgb(0_0_0/0.14)]"
          style={{ left: Math.min(tip.x + 14, window.innerWidth - 220), top: tip.y + 14 }}
        >
          <div className="label mb-1 text-ink-3">{tip.title}</div>
          {tip.rows.map((r) => (
            <div key={r.label} className="flex items-center gap-2 text-[13px] leading-6">
              {r.color && <span className="h-0.5 w-3 rounded-full" style={{ background: r.color }} />}
              <span className="font-mono font-semibold text-ink tabular-nums">{r.value}</span>
              <span className="text-ink-2">{r.label}</span>
            </div>
          ))}
        </div>
      )}
    </TipCtx.Provider>
  )
}

function useTip() {
  return useContext(TipCtx)
}

// ------------------------------------------------------------------ marco

export function Legend({ series }: { series: Series[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
          <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  )
}

export function ChartCard({
  title,
  note,
  legend,
  table,
  className,
  children,
}: {
  title: string
  note?: string
  legend?: Series[]
  table?: { head: string[]; rows: (string | number)[][] }
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cx('rounded-xl bg-card p-5 shadow-[0_0_0_1px_var(--rule)]', className)}>
      <h3 className="text-[17px] leading-tight font-medium">{title}</h3>
      {note && <p className="mt-0.5 text-[13px] text-ink-3">{note}</p>}
      {legend && legend.length > 1 && (
        <div className="mt-3">
          <Legend series={legend} />
        </div>
      )}
      <div className="mt-4">{children}</div>
      {table && (
        <Disclosure summary="ver tabla" className="mt-4">
          <table className="w-full font-mono text-[11.5px]">
            <thead>
              <tr className="text-ink-3">
                {table.head.map((h, i) => (
                  <th key={h} className={cx('pb-1 font-normal', i === 0 ? 'text-left' : 'text-right')}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, j) => (
                <tr key={j} className="border-t border-rule">
                  {r.map((c, i) => (
                    <td key={i} className={cx('py-1', i === 0 ? 'text-left text-ink-2' : 'text-right tabular-nums')}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Disclosure>
      )}
    </section>
  )
}

function niceMax(v: number): number {
  if (v <= 4) return Math.max(1, Math.ceil(v))
  const p = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p
  return 10 * p
}

const fmt = (n: number) => n.toLocaleString('es')

// ------------------------------------------------------------------ columnas apiladas en el tiempo

export function StackedColumns({
  data,
  series,
  xLabel,
  height = 200,
}: {
  data: { x: string; values: Record<string, number> }[]
  series: Series[]
  xLabel: (i: number) => string
  height?: number
}) {
  const tip = useTip()
  const [hover, setHover] = useState<number | null>(null)
  const totals = data.map((d) => series.reduce((n, s) => n + (d.values[s.key] ?? 0), 0))
  const max = niceMax(Math.max(1, ...totals))
  const ticks = [0, max / 2, max]
  const labelEvery = Math.max(1, Math.ceil(data.length / 6))
  if (!data.length) return <p className="py-10 text-center text-ink-3 italic">Sin acciones todavía.</p>
  return (
    <div>
      <div className="flex">
        <div className="relative w-8 shrink-0" style={{ height }}>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-2 -translate-y-1/2 font-mono text-[10.5px] text-ink-3 tabular-nums"
              style={{ top: height - (t / max) * height }}
            >
              {fmt(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1" style={{ height }} onPointerLeave={() => (setHover(null), tip(null))}>
          {ticks.map((t) => (
            <span key={t} className="absolute inset-x-0 h-px bg-rule" style={{ top: height - (t / max) * height }} />
          ))}
          <div className="absolute inset-0 flex">
            {data.map((d, i) => (
              <div
                key={d.x}
                tabIndex={0}
                className="flex h-full flex-1 cursor-default flex-col-reverse items-center outline-none"
                onPointerMove={(e) => {
                  setHover(i)
                  tip({
                    x: e.clientX,
                    y: e.clientY,
                    title: d.x,
                    rows: [
                      { label: 'acciones en total', value: fmt(totals[i]) },
                      ...series.map((s) => ({ label: s.label, value: fmt(d.values[s.key] ?? 0), color: s.color })),
                    ],
                  })
                }}
                onFocus={(e) => {
                  const r = e.currentTarget.getBoundingClientRect()
                  setHover(i)
                  tip({
                    x: r.left,
                    y: r.top,
                    title: d.x,
                    rows: series.map((s) => ({ label: s.label, value: fmt(d.values[s.key] ?? 0), color: s.color })),
                  })
                }}
                onBlur={() => (setHover(null), tip(null))}
              >
                <div
                  className={cx(
                    'flex w-full max-w-6 flex-col-reverse gap-[2px] transition-opacity',
                    hover !== null && hover !== i && 'opacity-40',
                  )}
                  style={{ height: (totals[i] / max) * height }}
                >
                  {series.map((s, j) => {
                    const v = d.values[s.key] ?? 0
                    if (!v) return null
                    const isTop = series.slice(j + 1).every((x) => !(d.values[x.key] ?? 0))
                    return (
                      <span
                        key={s.key}
                        className={cx('w-full', isTop && 'rounded-t-[4px]')}
                        style={{ flexGrow: v, flexBasis: 0, background: s.color }}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-1.5 ml-8 flex">
        {data.map((d, i) => (
          <span key={d.x} className="flex-1 text-center font-mono text-[10.5px] text-ink-3">
            {i % labelEvery === 0 ? xLabel(i) : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ barra segmentada (un todo en partes)

export function SegmentedBar({
  parts,
  tall = true,
}: {
  parts: { key: string; label: string; value: number; color: string; ink?: 'light' | 'dark' }[]
  tall?: boolean
}) {
  const tip = useTip()
  const total = parts.reduce((n, p) => n + p.value, 0)
  const shown = parts.filter((p) => p.value > 0)
  if (!total) return <div className={cx('rounded-full bg-rule', tall ? 'h-7' : 'h-2')} />
  return (
    <div
      className={cx('flex gap-[2px]', tall ? 'h-7' : 'h-2')}
      role="img"
      aria-label={shown.map((p) => `${p.label}: ${p.value}`).join(', ')}
      onPointerLeave={() => tip(null)}
    >
      {shown.map((p) => {
        const pct = Math.round((p.value / total) * 100)
        return (
          <div
            key={p.key}
            tabIndex={0}
            className={cx(
              'flex min-w-[3px] items-center overflow-hidden px-2 outline-none hover:brightness-110',
              tall ? 'rounded-[4px]' : 'rounded-full',
            )}
            style={{ flexGrow: p.value, flexBasis: 0, background: p.color }}
            onPointerMove={(e) =>
              tip({ x: e.clientX, y: e.clientY, title: p.label, rows: [{ label: `${pct} % del total`, value: fmt(p.value), color: p.color }] })
            }
            onFocus={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              tip({ x: r.left, y: r.bottom, title: p.label, rows: [{ label: `${pct} % del total`, value: fmt(p.value) }] })
            }}
            onBlur={() => tip(null)}
          >
            {tall && p.value / total >= 0.09 && (
              <span className={cx('font-mono text-[11.5px] font-semibold', p.ink === 'dark' ? 'text-[#141414]' : 'text-white')}>
                {pct} %
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------------ barras horizontales (simples o apiladas)

export function HBars({
  rows,
  series,
}: {
  rows: { label: string; values: Record<string, number> }[]
  series: Series[]
}) {
  const tip = useTip()
  const totals = rows.map((r) => series.reduce((n, s) => n + (r.values[s.key] ?? 0), 0))
  const max = Math.max(1, ...totals)
  if (!rows.length) return <p className="py-6 text-center text-ink-3 italic">Nada que mostrar todavía.</p>
  return (
    <ol className="space-y-2.5" onPointerLeave={() => tip(null)}>
      {rows.map((r, i) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3">
          <span className="truncate text-right font-mono text-[12px] text-ink-2" title={r.label}>
            {r.label}
          </span>
          <div
            tabIndex={0}
            className="group flex items-center gap-2 py-1 outline-none"
            onPointerMove={(e) =>
              tip({
                x: e.clientX,
                y: e.clientY,
                title: r.label,
                rows:
                  series.length > 1
                    ? series
                        .filter((s) => r.values[s.key])
                        .map((s) => ({ label: s.label, value: fmt(r.values[s.key] ?? 0), color: s.color }))
                    : [{ label: series[0].label, value: fmt(totals[i]), color: series[0].color }],
              })
            }
            onFocus={(e) => {
              const b = e.currentTarget.getBoundingClientRect()
              tip({ x: b.left, y: b.bottom, title: r.label, rows: [{ label: 'total', value: fmt(totals[i]) }] })
            }}
            onBlur={() => tip(null)}
          >
            <div className="flex h-[18px] gap-[2px] group-hover:brightness-110" style={{ width: `${(totals[i] / max) * 100}%` }}>
              {series.map((s, j) => {
                const v = r.values[s.key] ?? 0
                if (!v) return null
                const isEnd = series.slice(j + 1).every((x) => !(r.values[x.key] ?? 0))
                return (
                  <span
                    key={s.key}
                    className={cx('h-full', isEnd && 'rounded-r-[4px]')}
                    style={{ flexGrow: v, flexBasis: 0, background: s.color }}
                  />
                )
              })}
            </div>
            <span className="shrink-0 font-mono text-[11.5px] text-ink tabular-nums">{fmt(totals[i])}</span>
          </div>
        </li>
      ))}
    </ol>
  )
}
