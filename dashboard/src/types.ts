// Tipos del contrato CONTRATO_API.md v1.0 (GET /api/matchup)

export type Status = 'ok' | 'insufficient_data' | 'no_team_data' | 'not_available'
export type Confidence = 'high' | 'moderate' | 'limited' | 'none'
export type Distance = 'all' | 'short' | 'standard' | 'long'
export type FieldZone = 'red_zone' | 'opponent_territory' | 'own_territory' | 'backed_up'
export type ScoreState = 'trailing' | 'close' | 'leading'

export interface Interval {
  lower: number | null
  upper: number | null
}

export interface RateMetric {
  status: Status
  numerator: number
  denominator: number
  observed_rate: number | null
  bayesian_estimate: {
    posterior_mean: number | null
    credible_interval_80: Interval
    prior_strength: number | null
  }
  league_reference: { sample_size: number; rate: number | null }
}

export interface ValueMetric {
  status: Status
  value: number | null
  sample_size: number
  league_reference: { sample_size: number; value: number | null }
}

export interface Category {
  name: string
  count: number
  observed_rate: number | null
  bayesian_estimate: {
    posterior_mean: number | null
    credible_interval_80: Interval
  }
  league_reference_rate: number | null
}

export interface Distribution {
  status: Status
  sample_size: number
  categories: Category[]
}

export interface OffenseBlock {
  team: string
  sample_size: number
  confidence: Confidence
  metrics: {
    play_action_rate: RateMetric
    sack_received_rate: RateMetric
    pressure_received_rate: RateMetric
    completion_rate: RateMetric
    yards_per_dropback: ValueMetric
  }
  formation_distribution: Distribution
}

export interface DefenseBlock {
  team: string
  sample_size: number
  confidence: Confidence
  metrics: {
    pressure_generated_rate: RateMetric
    sack_generated_rate: RateMetric
    defenders_in_box: ValueMetric
  }
  coverage_distribution: Distribution
}

export type SignalType =
  | 'pressure_risk'
  | 'formation_tendency'
  | 'coverage_tendency'
  | 'play_action_tendency'
  | 'insufficient_evidence'
export type Severity = 'info' | 'low' | 'moderate' | 'high'

export interface Signal {
  type: SignalType
  severity: Severity
  title: string
  message: string
}

export interface Warning {
  code:
    | 'limited_offense_sample'
    | 'limited_defense_sample'
    | 'fourth_down_limited'
    | 'missing_metric_data'
    | 'no_matching_league_data'
  message: string
}

export interface MatchupContext {
  offense_team: string
  defense_team: string
  down: number
  distance: Distance
  field_zone: FieldZone
  score_state: ScoreState
  last_two_minutes: boolean
}

export interface MatchupResponse {
  context: MatchupContext
  offense: OffenseBlock
  defense: DefenseBlock
  matchup: {
    method: string
    league_context_sample_size: number
    signals: Signal[]
  }
  warnings: Warning[]
}

// Parámetros de consulta que el usuario configura
export interface MatchupQuery {
  offense_team: string
  defense_team: string
  down: 1 | 2 | 3 | 4
  distance: Distance
  field_zone: FieldZone
  score_state: ScoreState
  last_two_minutes: boolean
}
