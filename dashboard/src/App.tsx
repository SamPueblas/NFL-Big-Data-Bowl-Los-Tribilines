import { useEffect, useState } from 'react'
import { ApiError, fetchMatchup } from './api'
import { DistributionChart, PlayActionChart, PressureChart } from './components/Charts'
import Configurator from './components/Configurator'
import { RateRow, ValueRow } from './components/Metrics'
import { Signals, Warnings } from './components/Signals'
import { CoachingConsiderations, TacticalSummary } from './components/TacticalInsights'
import { CONFIDENCE_LABEL, DISTANCE_LABEL, SCORE_LABEL, ZONE_LABEL } from './format'
import type { Confidence, MatchupQuery, MatchupResponse } from './types'

const DEFAULT_QUERY: MatchupQuery = {
  offense_team: 'KC',
  defense_team: 'BUF',
  down: 3,
  distance: 'standard',
  field_zone: 'opponent_territory',
  score_state: 'close',
  last_two_minutes: false,
}

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'invalid'; message: string }
  | { kind: 'ready'; data: MatchupResponse }

const CONF_COLOR: Record<Confidence, string> = {
  high: 'text-ok border-ok/40',
  moderate: 'text-accent border-accent/40',
  limited: 'text-warn border-warn/40',
  none: 'text-slate-400 border-ink-600',
}

function Panel({ title, team, sample, confidence, children }: {
  title: string
  team: string
  sample: number
  confidence: Confidence
  children: React.ReactNode
}) {
  return (
    <section className="bg-ink-800 border border-ink-700 rounded p-4 min-w-0">
      <header className="flex items-start justify-between gap-3 mb-1">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-slate-400">{title}</div>
          <h2 className="text-3xl font-black text-white leading-tight">{team}</h2>
        </div>
        <div className={`text-xs border rounded px-2 py-1 text-right ${CONF_COLOR[confidence] ?? CONF_COLOR.none}`}>
          <div className="font-semibold">{CONFIDENCE_LABEL[confidence] ?? confidence}</div>
          <div className="tabular-nums">Basado en {sample} jugadas</div>
        </div>
      </header>
      {children}
    </section>
  )
}

export default function App() {
  const [query, setQuery] = useState<MatchupQuery>(DEFAULT_QUERY)
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (query.offense_team === query.defense_team) {
      setState({ kind: 'invalid', message: 'Selecciona dos equipos distintos para comparar.' })
      return
    }
    const ctrl = new AbortController()
    setState({ kind: 'loading' })
    fetchMatchup(query, ctrl.signal)
      .then((data) => setState({ kind: 'ready', data }))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setState({ kind: 'error', message: e instanceof ApiError ? e.message : 'Error inesperado.' })
      })
    return () => ctrl.abort()
  }, [query, retry])

  const loading = state.kind === 'loading'

  return (
    <div className="min-h-screen bg-ink-900 text-slate-200">
      <header className="border-b border-ink-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-black tracking-tight text-white">
            MATCHUP <span className="text-accent">CENTER</span>
          </h1>
          <p className="text-xs text-slate-400">Asistente de preparación táctica · tendencias históricas de pases NFL</p>
        </div>
      </header>

      <Configurator query={query} onChange={setQuery} loading={loading} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6" aria-busy={loading}>
        {state.kind === 'loading' && (
          <div role="status" className="text-sm text-slate-400 border border-ink-700 rounded p-6">
            Analizando matchup…
          </div>
        )}
        {state.kind === 'invalid' && (
          <div className="text-sm text-slate-300 border border-ink-700 rounded p-6">{state.message}</div>
        )}
        {state.kind === 'error' && (
          <div role="alert" className="border border-danger/50 bg-danger/10 rounded p-4">
            <p className="font-semibold text-white">No se pudo cargar el matchup</p>
            <p className="text-sm text-slate-300 mt-1">{state.message}</p>
            <button
              onClick={() => setRetry((n) => n + 1)}
              className="mt-3 px-3 py-1.5 text-sm rounded bg-ink-700 hover:bg-ink-600 text-white"
            >
              Reintentar
            </button>
          </div>
        )}
        {state.kind === 'ready' && <Result data={state.data} />}
      </main>
    </div>
  )
}

export function Result({ data }: { data: MatchupResponse }) {
  const { offense, defense, matchup, context } = data
  const empty = offense.sample_size === 0 && defense.sample_size === 0
  const om: Partial<MatchupResponse['offense']['metrics']> = offense.metrics ?? {}
  const dm: Partial<MatchupResponse['defense']['metrics']> = defense.metrics ?? {}

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-lg font-bold text-white">
          {context.offense_team} <span className="text-slate-500 font-normal">ofensiva vs</span> {context.defense_team}
        </p>
        <p className="text-sm text-slate-400">
          {context.down}.º down · {DISTANCE_LABEL[context.distance]} · {ZONE_LABEL[context.field_zone]} · {SCORE_LABEL[context.score_state]}
          {context.last_two_minutes && ' · últimos 2 min'}
        </p>
      </div>

      {empty && (
        <div className="border border-ink-700 rounded p-6 text-sm text-slate-300">
          Ningún equipo tiene jugadas en este contexto. Prueba con otra combinación de down, zona o marcador.
        </div>
      )}

      <TacticalSummary data={data} />
      <Warnings warnings={data.warnings} />

      <section aria-label="Señales tácticas">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-2">Señales estadísticas</h2>
        <p className="text-xs text-slate-500 mb-2">Se muestran como evidencia histórica complementaria; el resumen superior las traduce a preparación táctica.</p>
        <Signals signals={matchup.signals ?? []} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Ofensiva" team={offense.team} sample={offense.sample_size} confidence={offense.confidence}>
          <RateRow
            label="Play action"
            hint="Frecuencia histórica de engaño de carrera antes del pase."
            meaning="Porcentaje de jugadas de pase con play action registrado por PFF."
            consideration="Preparar respuestas al play action solo si la estimación y su rango de incertidumbre justifican atención adicional."
            m={om.play_action_rate}
          />
          <RateRow
            label="Presión sobre el QB ofensivo"
            hint="Qué tan seguido el mariscal enfrenta un hit, hurry o sack."
            meaning="Porcentaje de jugadas con al menos un hit, hurry o sack PFF contra la ofensiva."
            consideration="Si está por encima de liga, revisar protecciones y opciones de liberación rápida sin asumir una presión segura."
            m={om.pressure_received_rate}
          />
          <RateRow
            label="Sacks recibidos"
            hint="Capturas registradas en la jugada."
            meaning="Porcentaje de dropbacks con passResult = sack."
            consideration="Usarlo junto con presión y video para priorizar contingencias de protección."
            m={om.sack_received_rate}
          />
          <RateRow
            label="Pases completos"
            hint="Completos entre intentos de pase registrados."
            meaning="Porcentaje de completos entre pases completos, incompletos e intercepciones."
            consideration="Es contexto histórico del resultado, no una probabilidad garantizada del siguiente pase."
            m={om.completion_rate}
          />
          <ValueRow
            label="Yardas por dropback"
            unit="yd"
            meaning="Promedio de playResult por jugada de pase; incluye el resultado registrado de penalizaciones."
            consideration="Comparar con liga como señal descriptiva, no como EPA ni como causalidad."
            m={om.yards_per_dropback}
          />
        </Panel>
        <Panel title="Defensiva" team={defense.team} sample={defense.sample_size} confidence={defense.confidence}>
          <RateRow
            label="Presión generada por la defensa"
            hint="Qué tan seguido esta defensa presiona al mariscal rival."
            meaning="Porcentaje de jugadas con al menos un hit, hurry o sack PFF generado por la defensa."
            consideration="Si está por encima de liga, revisar reglas de protección y alternativas de liberación rápida."
            m={dm.pressure_generated_rate}
          />
          <RateRow
            label="Sacks generados"
            hint="Capturas registradas en jugadas contra esta defensa."
            meaning="Porcentaje de dropbacks rivales con passResult = sack."
            consideration="Complementarlo con la tasa de presión: una muestra corta no prueba que una captura sea inevitable."
            m={dm.sack_generated_rate}
          />
          <ValueRow
            label="Defensores en la caja (promedio)"
            meaning="Promedio de defensores alineados cerca de la línea de golpeo antes del snap."
            consideration="Úsalo como contexto de alineación, no como una llamada defensiva confirmada."
            m={dm.defenders_in_box}
          />
        </Panel>
      </div>

      <section aria-label="Visualizaciones" className="grid gap-6 lg:grid-cols-2">
        <div className="bg-ink-800 border border-ink-700 rounded p-4">
          <DistributionChart title="Formaciones ofensivas" teamLabel={offense.team} dist={offense.formation_distribution} />
        </div>
        <div className="bg-ink-800 border border-ink-700 rounded p-4">
          <DistributionChart
            title="Cobertura defensiva: Man vs Zone"
            teamLabel={defense.team}
            dist={defense.coverage_distribution}
            accent="#38BDF8"
            note="Las coberturas PFF son observaciones históricas etiquetadas después de la jugada; no se conocen con certeza antes del snap."
          />
        </div>
        <div className="bg-ink-800 border border-ink-700 rounded p-4">
          <PressureChart
            offTeam={offense.team}
            defTeam={defense.team}
            offense={om.pressure_received_rate}
            defense={dm.pressure_generated_rate}
          />
        </div>
        <div className="bg-ink-800 border border-ink-700 rounded p-4">
          <PlayActionChart offense={offense.team} m={om.play_action_rate} />
        </div>
      </section>

      <CoachingConsiderations data={data} />

      <details className="border border-ink-700 rounded p-4 text-sm text-slate-300">
        <summary className="cursor-pointer font-semibold text-white">Cómo leer la evidencia y las estimaciones</summary>
        <div className="mt-3 space-y-2 text-sm text-slate-400">
          <p><strong className="text-slate-200">Estimación ajustada:</strong> combina la frecuencia observada del equipo con la referencia de liga del mismo contexto para no sobrerreaccionar a muestras pequeñas.</p>
          <p><strong className="text-slate-200">Rango de incertidumbre (80%):</strong> muestra el rango compatible con los datos y el modelo. Un rango amplio implica más incertidumbre.</p>
          <p><strong className="text-slate-200">Confiabilidad:</strong> considera cantidad de jugadas, ancho del rango de incertidumbre e influencia del prior de liga. Las señales limitadas deben usarse para revisar video y preparar contingencias.</p>
          <p><strong className="text-slate-200">Alcance:</strong> el análisis incluye solo jugadas de pase de las semanas 1 a 8 de 2021. Describe asociaciones históricas; no establece causalidad ni garantiza comportamiento futuro.</p>
        </div>
      </details>

      <footer className="text-xs text-slate-500 border-t border-ink-700 pt-4">
        <p>{matchup.method}</p>
        <p className="mt-1">Muestra de liga en este contexto: {matchup.league_context_sample_size} jugadas. Yardas por dropback es descriptiva (playResult), no EPA.</p>
      </footer>
    </>
  )
}
