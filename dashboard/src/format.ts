import type { Confidence, Status } from './types'

export const pct = (v: number | null | undefined, digits = 1): string =>
  v == null || Number.isNaN(v) ? '—' : `${(v * 100).toFixed(digits)}%`

export const num = (v: number | null | undefined, digits = 2): string =>
  v == null || Number.isNaN(v) ? '—' : v.toFixed(digits)

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'Confianza alta',
  moderate: 'Confianza moderada',
  limited: 'Confianza limitada',
  none: 'Sin datos',
}

export const STATUS_LABEL: Record<Status, string> = {
  ok: 'Muestra suficiente',
  insufficient_data: 'Muestra insuficiente (<10)',
  no_team_data: 'Sin jugadas del equipo',
  not_available: 'Métrica no disponible',
}

export const CATEGORY_LABEL: Record<string, string> = {
  shotgun: 'Shotgun',
  empty: 'Empty',
  singleback: 'Singleback',
  other: 'Otras',
  man: 'Man',
  zone: 'Zone',
}

export const ZONE_LABEL = {
  red_zone: 'Zona roja (1–20 yd)',
  opponent_territory: 'Territorio rival (21–50 yd)',
  own_territory: 'Territorio propio (51–80 yd)',
  backed_up: 'Pegado a su zona (81–99 yd)',
} as const

export const DISTANCE_LABEL = {
  all: 'Todas',
  short: 'Corta (0–6 yd)',
  standard: 'Estándar (7–10 yd)',
  long: 'Larga (11+ yd)',
} as const

export const SCORE_LABEL = {
  trailing: 'Perdiendo (≤ −4)',
  close: 'Parejo (−3 a +3)',
  leading: 'Ganando (≥ +4)',
} as const
