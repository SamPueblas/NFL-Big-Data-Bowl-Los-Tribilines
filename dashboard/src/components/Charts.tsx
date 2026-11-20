import { Bar, BarChart, CartesianGrid, ErrorBar, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CATEGORY_LABEL, pct, STATUS_LABEL } from '../format'
import type { Distribution, RateMetric } from '../types'

const TEAM_COLOR = '#F2B134'
const LEAGUE_COLOR = '#64748B'

interface Row {
  name: string
  equipo: number | null
  liga: number | null
  err: [number, number] | null
  lower: number | null
  upper: number | null
  count: number
}

function toRows(d: Distribution): Row[] {
  return (d.categories ?? [])
    .map((c) => {
      const m = c.bayesian_estimate?.posterior_mean ?? null
      const lo = c.bayesian_estimate?.credible_interval_80?.lower ?? null
      const hi = c.bayesian_estimate?.credible_interval_80?.upper ?? null
      return {
        name: CATEGORY_LABEL[c.name] ?? c.name,
        equipo: m,
        liga: c.league_reference_rate,
        err: m != null && lo != null && hi != null ? [Math.max(0, m - lo), Math.max(0, hi - m)] : null,
        lower: lo,
        upper: hi,
        count: c.count,
      }
    })
}

// Gráfica de barras: estimación bayesiana del equipo (con intervalo creíble 80%) vs referencia de liga
export function DistributionChart({ title, teamLabel, dist, accent = TEAM_COLOR, note }: {
  title: string
  teamLabel: string
  dist: Distribution | undefined
  accent?: string
  note?: string
}) {
  const d: Distribution = dist ?? { status: 'not_available', sample_size: 0, categories: [] }
  const rows = toRows(d)
  const hasData = d.status !== 'no_team_data' && d.status !== 'not_available' && rows.some((r) => r.equipo != null)
  return (
    <figure className="m-0">
      <figcaption className="mb-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs text-slate-400">
          {teamLabel} · basado en {d.sample_size ?? 0} jugadas · barras: estimación ajustada · bigotes: rango de incertidumbre (80%) · gris: liga
          {note && <span className="block mt-1 text-warn">{note}</span>}
        </p>
      </figcaption>
      {!hasData ? (
        <p className="text-sm text-slate-400 border border-dashed border-ink-600 rounded p-4">
          {STATUS_LABEL[d.status] ?? 'Sin datos'}. No hay distribución que mostrar para este contexto.
        </p>
      ) : (
        <>
          {d.status === 'insufficient_data' && (
            <p className="text-xs text-warn mb-1"><strong>Evidencia insuficiente para establecer una tendencia táctica confiable.</strong> La muestra es menor a 10 jugadas.</p>
          )}
          <div className="h-60" role="img" aria-label={title}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#1F2937" vertical={false} />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} tickLine={false} />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                  domain={[0, (max: number) => Math.min(1, Math.ceil(max * 10 + 1) / 10)]}
                  label={{ value: '% de jugadas', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11, dx: 6 }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={{ background: '#0B1220', border: '1px solid #334155', fontSize: 12 }}
                  formatter={(v, name) => [pct(typeof v === 'number' ? v : null), String(name)]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="equipo" name={`${teamLabel} (estimado)`} fill={accent} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  <ErrorBar dataKey="err" stroke="#E2E8F0" strokeWidth={1.5} width={6} />
                </Bar>
                <Bar dataKey="liga" name="Liga" fill={LEAGUE_COLOR} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs text-slate-400 list-none p-0">
            {rows.map((r) => (
              <li key={r.name}>
                <span className="text-slate-200">{r.name}</span> · observado: {r.count} jug.
                <br />
                Ajustado: {pct(r.equipo, 0)} · incertidumbre: {pct(r.lower, 0)}–{pct(r.upper, 0)}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-500 mt-2">Una categoría con 0 jugadas observadas puede conservar una estimación ajustada por la referencia de liga; no representa una tendencia confirmada del equipo.</p>
        </>
      )}
    </figure>
  )
}

// Comparación de presión: ofensiva (recibida) vs defensiva (generada) vs liga
export function PressureChart({ offTeam, defTeam, offense, defense }: {
  offTeam: string
  defTeam: string
  offense: RateMetric | undefined
  defense: RateMetric | undefined
}) {
  const ok = (m?: RateMetric) => m != null && m.bayesian_estimate?.posterior_mean != null
  const mk = (label: string, m?: RateMetric) => {
    const mean = m?.bayesian_estimate?.posterior_mean ?? null
    const lo = m?.bayesian_estimate?.credible_interval_80?.lower ?? null
    const hi = m?.bayesian_estimate?.credible_interval_80?.upper ?? null
    return {
      name: label,
      valor: mean,
      liga: m?.league_reference?.rate ?? null,
      err: mean != null && lo != null && hi != null ? ([Math.max(0, mean - lo), Math.max(0, hi - mean)] as [number, number]) : null,
    }
  }
  const rows = [
    mk(`${offTeam} recibe`, offense),
    mk(`${defTeam} genera`, defense),
  ]
  const nO = offense?.denominator ?? 0
  const nD = defense?.denominator ?? 0
  return (
    <figure className="m-0">
      <figcaption className="mb-2">
        <h3 className="text-sm font-semibold text-white">Presión sobre el mariscal</h3>
        <p className="text-xs text-slate-400">
          {offTeam}: frecuencia histórica con que su QB enfrenta hit, hurry o sack. {defTeam}: frecuencia histórica con que presiona al QB rival.
          <br />Basado en {nO} jugadas ({offTeam}) y {nD} ({defTeam}) · barra: estimación ajustada · bigotes: rango de incertidumbre (80%) · gris: liga.
        </p>
      </figcaption>
      {!ok(offense) && !ok(defense) ? (
        <p className="text-sm text-slate-400 border border-dashed border-ink-600 rounded p-4">
          No hay datos de presión disponibles para este contexto.
        </p>
      ) : (
        <div className="h-60" role="img" aria-label="Comparación de presión recibida y generada">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1F2937" vertical={false} />
              <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} tickLine={false} />
              <YAxis
                stroke="#94A3B8"
                fontSize={12}
                tickLine={false}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                domain={[0, (max: number) => Math.min(1, Math.ceil(max * 10 + 1) / 10)]}
                label={{ value: '% de jugadas', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11, dx: 6 }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                contentStyle={{ background: '#0B1220', border: '1px solid #334155', fontSize: 12 }}
                formatter={(v, name) => [pct(typeof v === 'number' ? v : null), String(name)]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="valor" name="Estimado (media posterior)" fill={TEAM_COLOR} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                <ErrorBar dataKey="err" stroke="#E2E8F0" strokeWidth={1.5} width={6} />
              </Bar>
              <Bar dataKey="liga" name="Liga" fill={LEAGUE_COLOR} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  )
}

// Play action: estimación del equipo ofensivo vs liga
export function PlayActionChart({ offense, m }: { offense: string; m: RateMetric | undefined }) {
  const mean = m?.bayesian_estimate?.posterior_mean ?? null
  const lo = m?.bayesian_estimate?.credible_interval_80?.lower ?? null
  const hi = m?.bayesian_estimate?.credible_interval_80?.upper ?? null
  const rows = [{
    name: 'Play action',
    equipo: mean,
    liga: m?.league_reference?.rate ?? null,
    err: mean != null && lo != null && hi != null ? ([Math.max(0, mean - lo), Math.max(0, hi - mean)] as [number, number]) : null,
  }]
  return (
    <figure className="m-0">
      <figcaption className="mb-2">
        <h3 className="text-sm font-semibold text-white">Frecuencia de play action</h3>
        <p className="text-xs text-slate-400">
          {offense} · basado en {m?.denominator ?? 0} jugadas · liga: {m?.league_reference?.sample_size ?? 0} jugadas
          <br />Barra: estimación ajustada · bigotes: rango de incertidumbre (80%) · gris: liga.
        </p>
      </figcaption>
      {mean == null ? (
        <p className="text-sm text-slate-400 border border-dashed border-ink-600 rounded p-4">
          No hay estimación de play action para este contexto.
        </p>
      ) : (
        <div className="h-60" role="img" aria-label="Frecuencia de play action frente a la liga">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1F2937" vertical={false} />
              <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} tickLine={false} />
              <YAxis
                stroke="#94A3B8"
                fontSize={12}
                tickLine={false}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                domain={[0, (max: number) => Math.min(1, Math.ceil(max * 10 + 1) / 10)]}
                label={{ value: '% de jugadas', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11, dx: 6 }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                contentStyle={{ background: '#0B1220', border: '1px solid #334155', fontSize: 12 }}
                formatter={(v, name) => [pct(typeof v === 'number' ? v : null), String(name)]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="equipo" name={`${offense} (estimado)`} fill="#F2B134" radius={[3, 3, 0, 0]} isAnimationActive={false} barSize={60}>
                <ErrorBar dataKey="err" stroke="#E2E8F0" strokeWidth={1.5} width={6} />
              </Bar>
              <Bar dataKey="liga" name="Liga" fill="#64748B" radius={[3, 3, 0, 0]} isAnimationActive={false} barSize={60} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  )
}
