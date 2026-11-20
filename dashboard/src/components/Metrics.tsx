import { num, pct, STATUS_LABEL } from '../format'
import type { RateMetric, ValueMetric } from '../types'

// Banda = rango de incertidumbre 80%; punto = estimación ajustada; marca = referencia de liga.
function IntervalBar({ m, max }: { m: RateMetric; max: number }) {
  const b = m.bayesian_estimate
  const lo = b?.credible_interval_80?.lower
  const hi = b?.credible_interval_80?.upper
  const mean = b?.posterior_mean
  const league = m.league_reference?.rate
  const p = (v: number) => `${Math.min(100, (v / max) * 100)}%`
  return (
    <div className="relative h-5" aria-hidden>
      <div className="absolute inset-x-0 top-1/2 h-px bg-ink-600" />
      {lo != null && hi != null && (
        <div className="absolute top-1/2 -translate-y-1/2 h-2 rounded bg-accent/30" style={{ left: p(lo), width: `calc(${p(hi)} - ${p(lo)})` }} />
      )}
      {league != null && <div className="absolute top-0 h-5 w-0.5 bg-slate-400" style={{ left: p(league) }} />}
      {mean != null && (
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-accent border-2 border-ink-900" style={{ left: p(mean) }} />
      )}
    </div>
  )
}

export function RateRow({ label, hint, meaning, consideration, m }: {
  label: string
  hint?: string
  meaning?: string
  consideration?: string
  m: RateMetric | undefined
}) {
  if (!m) return <MissingRow label={label} />
  const unavailable = m.status === 'no_team_data' || m.status === 'not_available'
  const b = m.bayesian_estimate
  const vals = [b?.credible_interval_80?.upper, m.league_reference?.rate, b?.posterior_mean].filter((v): v is number => v != null)
  const max = Math.min(1, Math.max(0.1, Math.ceil(Math.max(0, ...vals) * 10 + 1) / 10))
  return (
    <div className="py-3 border-b border-ink-700 last:border-0">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-white">{label}</div>
          {hint && <div className="text-xs text-slate-500">{hint}</div>}
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-bold tabular-nums text-white">{unavailable ? '—' : pct(b?.posterior_mean)}</div>
          <div className="text-[11px] text-slate-400">estimación ajustada</div>
        </div>
      </div>
      {meaning && <p className="text-xs text-slate-400 mt-1">Qué mide: {meaning}</p>}
      {unavailable ? (
        <p className="text-xs text-slate-400 mt-1">{STATUS_LABEL[m.status]}.</p>
      ) : (
        <>
          <IntervalBar m={m} max={max} />
          <div className="flex flex-wrap justify-between gap-x-4 text-xs text-slate-400">
            <span>Rango de incertidumbre (80%): {pct(b?.credible_interval_80?.lower)} – {pct(b?.credible_interval_80?.upper)}</span>
            <span>Observado: {pct(m.observed_rate)} ({m.numerator}/{m.denominator})</span>
            <span>Liga: {pct(m.league_reference?.rate)} (basado en {m.league_reference?.sample_size ?? 0} jugadas)</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Basado en {m.denominator} jugadas del equipo. Punto azul: estimación ajustada; línea gris: liga.</p>
          {consideration && <p className="text-xs text-slate-300 mt-1"><strong>Para preparación:</strong> {consideration}</p>}
          {m.status === 'insufficient_data' && (
            <p className="text-xs text-warn mt-1"><strong>Evidencia insuficiente para establecer una tendencia táctica confiable.</strong> Solo hay {m.denominator} observaciones.</p>
          )}
        </>
      )}
    </div>
  )
}

export function ValueRow({ label, unit, meaning, consideration, m }: {
  label: string
  unit?: string
  meaning?: string
  consideration?: string
  m: ValueMetric | undefined
}) {
  if (!m) return <MissingRow label={label} />
  const unavailable = m.status === 'no_team_data' || m.status === 'not_available'
  const diff = m.value != null && m.league_reference?.value != null ? m.value - m.league_reference.value : null
  return (
    <div className="py-3 border-b border-ink-700 last:border-0">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xl font-bold tabular-nums text-white">
          {unavailable ? '—' : num(m.value)} {!unavailable && unit && <span className="text-xs font-normal text-slate-400">{unit}</span>}
        </div>
      </div>
      {meaning && <p className="text-xs text-slate-400 mt-1">Qué mide: {meaning}</p>}
      {unavailable ? (
        <p className="text-xs text-slate-400 mt-1">{STATUS_LABEL[m.status]}.</p>
      ) : (
        <>
          <div className="flex flex-wrap justify-between gap-x-4 text-xs text-slate-400 mt-1">
            <span>Basado en {m.sample_size} jugadas</span>
            <span>
              Liga: {num(m.league_reference?.value)} (basado en {m.league_reference?.sample_size ?? 0} jugadas)
              {diff != null && ` · ${diff >= 0 ? '+' : ''}${diff.toFixed(2)} vs liga`}
            </span>
          </div>
          {consideration && <p className="text-xs text-slate-300 mt-1"><strong>Para preparación:</strong> {consideration}</p>}
        </>
      )}
      {m.status === 'insufficient_data' && <p className="text-xs text-warn mt-1"><strong>Evidencia insuficiente para establecer una tendencia táctica confiable.</strong></p>}
    </div>
  )
}

function MissingRow({ label }: { label: string }) {
  return (
    <div className="py-3 border-b border-ink-700 last:border-0 flex justify-between text-sm">
      <span className="text-white">{label}</span>
      <span className="text-slate-400">No incluida en la respuesta</span>
    </div>
  )
}
