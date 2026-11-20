import { pct } from '../format'
import type { MatchupResponse, RateMetric } from '../types'

type Reliability = {
  label: string
  tone: string
  message: string
  limited: boolean
}

type Finding = {
  key: string
  priority: number
  kind: 'opportunity' | 'threat' | 'tendency'
  title: string
  explanation: string
  evidence: string
  consideration: string
  reliability: Reliability
}

function reliability(metric: RateMetric): Reliability {
  const interval = metric.bayesian_estimate?.credible_interval_80
  const width = interval?.lower != null && interval?.upper != null
    ? interval.upper - interval.lower
    : null
  const prior = metric.bayesian_estimate?.prior_strength
  const priorShare = prior != null ? prior / (prior + metric.denominator) : 1

  if (metric.status !== 'ok' || metric.denominator < 10 || width == null || width >= 0.25 || priorShare >= 0.67) {
    return {
      label: 'EVIDENCIA MUY LIMITADA',
      tone: 'text-danger border-danger/40 bg-danger/10',
      message: 'Evidencia insuficiente para establecer una tendencia táctica confiable.',
      limited: true,
    }
  }
  if (metric.denominator < 30 || width >= 0.15 || priorShare >= 0.40) {
    return {
      label: 'EVIDENCIA LIMITADA',
      tone: 'text-warn border-warn/40 bg-warn/10',
      message: 'La estimación combina evidencia directa con una influencia relevante de la referencia de liga.',
      limited: true,
    }
  }
  return {
    label: 'EVIDENCIA MÁS SÓLIDA',
    tone: 'text-ok border-ok/40 bg-ok/10',
    message: 'La muestra, el rango de incertidumbre y la influencia del prior apoyan una lectura más estable.',
    limited: false,
  }
}

function rateEvidence(metric: RateMetric, label: string): string {
  const estimate = metric.bayesian_estimate?.posterior_mean
  const interval = metric.bayesian_estimate?.credible_interval_80
  const league = metric.league_reference?.rate
  return `${label}: estimación ajustada ${pct(estimate)} frente a ${pct(league)} en liga. Basado en ${metric.denominator} jugadas; rango de incertidumbre (80%): ${pct(interval?.lower)}–${pct(interval?.upper)}.`
}

function rateDelta(metric: RateMetric): number | null {
  const estimate = metric.bayesian_estimate?.posterior_mean
  const league = metric.league_reference?.rate
  return estimate != null && league != null ? estimate - league : null
}

function pressureFinding(
  metric: RateMetric,
  team: string,
  role: 'allowed' | 'generated',
): Finding | null {
  const delta = rateDelta(metric)
  if (delta == null || Math.abs(delta) < 0.03) return null
  const r = reliability(metric)
  const elevated = delta >= 0
  const isAllowed = role === 'allowed'
  const title = isAllowed
    ? elevated ? `${team}: presión recibida por encima de liga` : `${team}: presión recibida por debajo de liga`
    : elevated ? `${team}: amenaza histórica de presión` : `${team}: presión histórica por debajo de liga`
  const explanation = isAllowed
    ? elevated
      ? 'El mariscal de esta ofensiva ha enfrentado presión con mayor frecuencia que la referencia contextual de liga.'
      : 'El mariscal de esta ofensiva ha enfrentado presión con menor frecuencia que la referencia contextual de liga.'
    : elevated
      ? 'Esta defensa ha presionado al mariscal rival con mayor frecuencia que la referencia contextual de liga.'
      : 'Esta defensa ha presionado al mariscal rival con menor frecuencia que la referencia contextual de liga.'
  const consideration = isAllowed
    ? elevated
      ? 'Considere revisar protecciones, respuestas de liberación rápida y planes de contingencia frente a presión; no implica que la presión vaya a ocurrir en una jugada concreta.'
      : 'Considere contrastar esta tendencia con el pass rush rival antes de cambiar el énfasis de protección; es una asociación histórica, no una garantía.'
    : elevated
      ? 'Considere revisar reglas de protección y alternativas de liberación rápida frente a esta tendencia defensiva; no es una predicción de presión en cada jugada.'
      : 'Considere no sobrerreaccionar a esta señal aislada y revisar el rango de incertidumbre antes de reducir el énfasis de protección.'
  return {
    key: `${role}-pressure`,
    priority: Math.abs(delta) + (r.limited ? 0 : 0.08),
    kind: elevated ? (isAllowed ? 'threat' : 'threat') : 'opportunity',
    title,
    explanation,
    evidence: rateEvidence(metric, isAllowed ? 'Presión sobre el QB ofensivo' : 'Presión generada por la defensa'),
    consideration,
    reliability: r,
  }
}

function playActionFinding(metric: RateMetric, team: string): Finding | null {
  const delta = rateDelta(metric)
  if (delta == null || Math.abs(delta) < 0.03) return null
  const r = reliability(metric)
  const higher = delta >= 0
  return {
    key: 'play-action',
    priority: Math.abs(delta) + (r.limited ? 0 : 0.05),
    kind: higher ? 'tendency' : 'opportunity',
    title: `${team}: tendencia de play action ${higher ? 'por encima' : 'por debajo'} de liga`,
    explanation: higher
      ? 'La ofensiva ha usado play action con mayor frecuencia que la referencia contextual de liga.'
      : 'La ofensiva ha usado play action con menor frecuencia que la referencia contextual de liga.',
    evidence: rateEvidence(metric, 'Play action'),
    consideration: higher
      ? 'Considere preparar reglas disciplinadas de lectura de play action y comunicación defensiva para esta situación, sin asumir que será la llamada siguiente.'
      : 'Considere si la menor frecuencia histórica justifica repartir la preparación entre play action y otras respuestas ofensivas.',
    reliability: r,
  }
}

function chooseFindings(data: MatchupResponse): Finding[] {
  const offense = data.offense.metrics
  const defense = data.defense.metrics
  const candidates = [
    pressureFinding(defense.pressure_generated_rate, data.defense.team, 'generated'),
    pressureFinding(offense.pressure_received_rate, data.offense.team, 'allowed'),
    playActionFinding(offense.play_action_rate, data.offense.team),
  ].filter((finding): finding is Finding => finding != null)

  return candidates
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3)
}

const KIND_STYLE: Record<Finding['kind'], { label: string; tone: string }> = {
  opportunity: { label: 'OPORTUNIDAD A EXPLORAR', tone: 'text-ok' },
  threat: { label: 'AMENAZA A PREPARAR', tone: 'text-danger' },
  tendency: { label: 'TENDENCIA A PREPARAR', tone: 'text-accent' },
}

export function TacticalSummary({ data }: { data: MatchupResponse }) {
  const findings = chooseFindings(data)
  const noDirectData = data.offense.sample_size === 0 && data.defense.sample_size === 0
  return (
    <section aria-labelledby="tactical-summary-heading" className="bg-ink-800 border border-ink-700 rounded p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
        <div>
          <h2 id="tactical-summary-heading" className="text-sm font-bold uppercase tracking-widest text-accent">Tactical Matchup Summary</h2>
          <p className="text-sm text-slate-300 mt-1">Hallazgos históricos para orientar la preparación, no llamadas automáticas.</p>
        </div>
        <p className="text-xs text-slate-500">Contexto de liga: {data.matchup.league_context_sample_size} jugadas</p>
      </div>

      {findings.length === 0 ? (
        <div className="border border-warn/40 bg-warn/10 rounded p-4 text-sm text-slate-200">
          <strong className="text-warn">{noDirectData ? 'Evidencia insuficiente para establecer una tendencia táctica confiable.' : 'No se detectó una diferencia histórica material frente a la referencia de liga.'}</strong>
          <p className="mt-1">{noDirectData ? 'Prueba una situación con más jugadas o revisa las métricas disponibles debajo.' : 'La ausencia de una señal destacada también es útil: no justifica cambiar el énfasis de preparación solo con estos datos.'}</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {findings.map((finding) => {
            const kind = KIND_STYLE[finding.kind]
            return (
              <article key={finding.key} className="border border-ink-600 rounded p-4 bg-ink-900/40">
                <div className={`text-[10px] font-bold tracking-widest ${kind.tone}`}>{kind.label}</div>
                <h3 className="text-base font-semibold text-white mt-1 leading-snug">{finding.title}</h3>
                <p className="text-sm text-slate-300 mt-2">{finding.explanation}</p>
                <p className="text-xs text-slate-400 mt-3">{finding.evidence}</p>
                <div className={`mt-3 border rounded px-2 py-1.5 text-xs ${finding.reliability.tone}`}>
                  <strong>{finding.reliability.label}</strong>
                  <span className="text-slate-300"> · {finding.reliability.message}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-ink-700">
                  <div className="text-[10px] font-bold tracking-widest text-slate-500">CONSIDERACIÓN DE COACHING</div>
                  <p className="text-sm text-slate-200 mt-1">{finding.consideration}</p>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function CoachingConsiderations({ data }: { data: MatchupResponse }) {
  const findings = chooseFindings(data)
  const limited = findings.filter((finding) => finding.reliability.limited)
  return (
    <section aria-labelledby="coaching-considerations-heading" className="border border-ink-700 rounded p-4 sm:p-5">
      <h2 id="coaching-considerations-heading" className="text-sm font-bold uppercase tracking-widest text-accent">Coaching Considerations</h2>
      <p className="text-sm text-slate-400 mt-1">Preguntas para orientar la preparación a partir de evidencia histórica.</p>
      <ul className="mt-4 grid gap-3 md:grid-cols-2 list-none p-0">
        {findings.map((finding) => (
          <li key={finding.key} className="bg-ink-800 border border-ink-700 rounded p-3 text-sm text-slate-200">
            <strong className="text-white">¿Qué conviene revisar?</strong>
            <p className="mt-1">{finding.consideration}</p>
          </li>
        ))}
        {limited.length > 0 && (
          <li className="bg-warn/10 border border-warn/40 rounded p-3 text-sm text-slate-200">
            <strong className="text-warn">¿Justifica cambiar el énfasis de preparación?</strong>
            <p className="mt-1">No todavía de forma concluyente. Al menos una señal relevante tiene evidencia limitada; úsala para revisar video y planear contingencias, no como una instrucción definitiva.</p>
          </li>
        )}
        <li className="bg-ink-800 border border-ink-700 rounded p-3 text-sm text-slate-200">
          <strong className="text-white">¿Qué no afirma este reporte?</strong>
          <p className="mt-1">No identifica la próxima llamada ni garantiza un resultado. Resume asociaciones históricas de jugadas de pase en este contexto.</p>
        </li>
      </ul>
    </section>
  )
}
