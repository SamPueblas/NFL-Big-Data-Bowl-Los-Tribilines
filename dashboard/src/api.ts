import type { MatchupQuery, MatchupResponse } from './types'

export const TEAMS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
  'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LA', 'LAC', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
  'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS',
] as const

export function buildParams(q: MatchupQuery): URLSearchParams {
  const p = new URLSearchParams()
  p.set('offense_team', q.offense_team)
  p.set('defense_team', q.defense_team)
  p.set('down', String(q.down))
  p.set('distance', q.distance)
  p.set('field_zone', q.field_zone)
  p.set('score_state', q.score_state)
  p.set('last_two_minutes', String(q.last_two_minutes))
  return p
}

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message)
  }
}

export async function fetchMatchup(q: MatchupQuery, signal?: AbortSignal): Promise<MatchupResponse> {
  let res: Response
  try {
    // Ruta relativa sin diagonal inicial, según CONTRATO_API.md
    res = await fetch(`api/matchup?${buildParams(q).toString()}`, { signal })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new ApiError('No se pudo conectar con el servidor.')
  }
  if (!res.ok) {
    let detail = `Error ${res.status}`
    try {
      const body = await res.json()
      if (typeof body?.detail === 'string') detail = body.detail
      else if (Array.isArray(body?.detail)) detail = body.detail.map((d: { msg?: string }) => d.msg).join('; ')
    } catch { /* cuerpo no JSON */ }
    throw new ApiError(detail, res.status)
  }
  let data: unknown
  try {
    data = await res.json()
  } catch {
    throw new ApiError('La respuesta del servidor no es JSON válido.', res.status)
  }
  const d = data as Partial<MatchupResponse>
  if (!d || !d.offense || !d.defense || !d.matchup) {
    throw new ApiError('La respuesta no cumple el contrato de la API.', res.status)
  }
  return { ...(d as MatchupResponse), warnings: d.warnings ?? [] }
}
