import { TEAMS } from '../api'
import { DISTANCE_LABEL, SCORE_LABEL, ZONE_LABEL } from '../format'
import type { Distance, FieldZone, MatchupQuery, ScoreState } from '../types'

interface Props {
  query: MatchupQuery
  onChange: (q: MatchupQuery) => void
  loading: boolean
}

const selectCls =
  'w-full bg-ink-900 border border-ink-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[11px] uppercase tracking-widest text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  )
}

export default function Configurator({ query, onChange, loading }: Props) {
  const set = (patch: Partial<MatchupQuery>) => onChange({ ...query, ...patch })
  const sameTeam = query.offense_team === query.defense_team
  const fixedDistance = query.down === 1 || query.down === 4

  const setDown = (down: 1 | 2 | 3 | 4) => {
    // Contrato: down 1 y 4 exigen distance=all; down 2 y 3 exigen short/standard/long
    const distance: Distance =
      down === 1 || down === 4 ? 'all' : query.distance === 'all' ? 'standard' : query.distance
    set({ down, distance })
  }

  return (
    <section aria-label="Configuración del matchup" className="border-b border-ink-700 bg-ink-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        <Field label="Ofensiva">
          <select className={selectCls} value={query.offense_team} onChange={(e) => set({ offense_team: e.target.value })}>
            {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Defensiva">
          <select className={selectCls} value={query.defense_team} onChange={(e) => set({ defense_team: e.target.value })}>
            {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Down">
          <select className={selectCls} value={query.down} onChange={(e) => setDown(Number(e.target.value) as 1 | 2 | 3 | 4)}>
            {[1, 2, 3, 4].map((d) => <option key={d} value={d}>{d}.º</option>)}
          </select>
        </Field>
        <Field label="Distancia">
          <select
            className={`${selectCls} disabled:opacity-50`}
            value={query.distance}
            disabled={fixedDistance}
            onChange={(e) => set({ distance: e.target.value as Distance })}
          >
            {(fixedDistance ? ['all'] : ['short', 'standard', 'long']).map((d) => (
              <option key={d} value={d}>{DISTANCE_LABEL[d as Distance]}</option>
            ))}
          </select>
        </Field>
        <Field label="Zona del campo">
          <select className={selectCls} value={query.field_zone} onChange={(e) => set({ field_zone: e.target.value as FieldZone })}>
            {(Object.keys(ZONE_LABEL) as FieldZone[]).map((z) => <option key={z} value={z}>{ZONE_LABEL[z]}</option>)}
          </select>
        </Field>
        <Field label="Marcador">
          <select className={selectCls} value={query.score_state} onChange={(e) => set({ score_state: e.target.value as ScoreState })}>
            {(Object.keys(SCORE_LABEL) as ScoreState[]).map((s) => <option key={s} value={s}>{SCORE_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Reloj">
          <label className="flex items-center gap-2 h-[38px] px-3 border border-ink-600 rounded bg-ink-900 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="accent-[#F2B134]"
              checked={query.last_two_minutes}
              onChange={(e) => set({ last_two_minutes: e.target.checked })}
            />
            Últimos 2 min
          </label>
        </Field>
      </div>
      {(sameTeam || fixedDistance || loading) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 text-xs">
          {sameTeam && <p className="text-danger">La ofensiva y la defensiva deben ser equipos distintos.</p>}
          {!sameTeam && fixedDistance && (
            <p className="text-slate-400">En 1.º y 4.º down la distancia no se filtra (el contrato exige «todas»).</p>
          )}
        </div>
      )}
    </section>
  )
}
