"""Cálculos de tendencias NFL para el endpoint de matchup.

Este módulo no conoce FastAPI. Carga los CSV una vez y produce diccionarios
serializables que respetan CONTRATO_API.md.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

TEAM_CODES = frozenset(
    {
        "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE",
        "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
        "LA", "LAC", "LV", "MIA", "MIN", "NE", "NO", "NYG",
        "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WAS",
    }
)

PRIOR_STRENGTH = 20.0
INTERVAL_DRAWS = 10_000


class MatchupAnalytics:
    """Carga el dataset y calcula estimaciones por equipo y contexto."""

    def __init__(self) -> None:
        root = Path(__file__).resolve().parent.parent
        data_dir = (
            root
            / "data"
            / "nfl-big-data-bowl-regional-event-data-main"
            / "nfl-big-data-bowl-regional-event-data-main"
            / "data"
        )
        self.plays = self._load_data(data_dir)

    @staticmethod
    def _load_data(data_dir: Path) -> pd.DataFrame:
        games = pd.read_csv(
            data_dir / "games.csv",
            usecols=["gameId", "homeTeamAbbr", "visitorTeamAbbr"],
        )
        plays = pd.read_csv(
            data_dir / "plays.csv",
            usecols=[
                "gameId",
                "playId",
                "quarter",
                "down",
                "yardsToGo",
                "possessionTeam",
                "defensiveTeam",
                "yardlineSide",
                "yardlineNumber",
                "gameClock",
                "preSnapHomeScore",
                "preSnapVisitorScore",
                "passResult",
                "playResult",
                "offenseFormation",
                "defendersInBox",
                "pff_playAction",
                "pff_passCoverageType",
            ],
        )
        scouting = pd.read_csv(
            data_dir / "pffScoutingData.csv",
            usecols=["gameId", "playId", "pff_hit", "pff_hurry", "pff_sack"],
        )

        pressure_columns = ["pff_hit", "pff_hurry", "pff_sack"]
        scouting["_pressure_available"] = scouting[pressure_columns].notna().any(axis=1)
        scouting["_pressure_event"] = scouting[pressure_columns].eq(1).any(axis=1)
        pressure_by_play = (
            scouting.groupby(["gameId", "playId"], as_index=False)
            .agg(
                pressure_available=("_pressure_available", "max"),
                pressure_event=("_pressure_event", "max"),
            )
        )

        plays = plays.merge(games, on="gameId", how="left", validate="many_to_one")
        plays = plays.merge(
            pressure_by_play,
            on=["gameId", "playId"],
            how="left",
            validate="one_to_one",
        )

        # Solo jugadas reglamentarias y downs válidos según el contrato.
        plays = plays.loc[plays["quarter"].between(1, 4) & plays["down"].between(1, 4)].copy()

        is_home_offense = plays["possessionTeam"].eq(plays["homeTeamAbbr"])
        plays["score_difference"] = np.where(
            is_home_offense,
            plays["preSnapHomeScore"] - plays["preSnapVisitorScore"],
            plays["preSnapVisitorScore"] - plays["preSnapHomeScore"],
        )

        # yardlineSide es vacío en la yarda 50. En ese caso la distancia a meta es 50.
        own_side = plays["yardlineSide"].eq(plays["possessionTeam"])
        plays["yards_to_endzone"] = np.where(
            own_side,
            100 - plays["yardlineNumber"],
            plays["yardlineNumber"],
        ).astype(float)
        plays.loc[plays["yardlineSide"].isna(), "yards_to_endzone"] = 50.0

        clock = plays["gameClock"].str.split(":", n=1, expand=True)
        plays["clock_seconds"] = (
            pd.to_numeric(clock[0], errors="coerce") * 60
            + pd.to_numeric(clock[1], errors="coerce")
        )

        plays["formation_group"] = plays["offenseFormation"].map(
            {
                "SHOTGUN": "shotgun",
                "EMPTY": "empty",
                "SINGLEBACK": "singleback",
            }
        ).fillna("other")
        plays["coverage_group"] = plays["pff_passCoverageType"].map(
            {"Man": "man", "Zone": "zone", "Other": "other"}
        ).fillna("other")
        plays["completion_available"] = plays["passResult"].isin(["C", "I", "IN"])
        plays["completion_event"] = plays["passResult"].eq("C")
        return plays

    @staticmethod
    def _confidence(sample_size: int) -> str:
        if sample_size >= 30:
            return "high"
        if sample_size >= 10:
            return "moderate"
        if sample_size > 0:
            return "limited"
        return "none"

    @staticmethod
    def _status(sample_size: int, league_sample_size: int) -> str:
        if league_sample_size == 0:
            return "not_available"
        if sample_size == 0:
            return "no_team_data"
        if sample_size < 10:
            return "insufficient_data"
        return "ok"

    @staticmethod
    def _rounded(value: float | np.floating | None, digits: int = 4) -> float | None:
        if value is None or pd.isna(value):
            return None
        return round(float(value), digits)

    @staticmethod
    def _interval(alpha: float, beta: float) -> dict[str, float]:
        # Semilla fija para que la misma petición produzca la misma respuesta.
        draws = np.random.default_rng(2021).beta(alpha, beta, INTERVAL_DRAWS)
        lower, upper = np.quantile(draws, [0.10, 0.90])
        return {"lower": round(float(lower), 4), "upper": round(float(upper), 4)}

    @staticmethod
    def _dirichlet_intervals(alpha: np.ndarray) -> np.ndarray:
        draws = np.random.default_rng(2021).dirichlet(alpha, INTERVAL_DRAWS)
        return np.quantile(draws, [0.10, 0.90], axis=0)

    def _binary_metric(
        self,
        team: pd.DataFrame,
        league: pd.DataFrame,
        event_column: str,
        availability_column: str | None = None,
    ) -> dict[str, Any]:
        if availability_column is None:
            team_eligible = team
            league_eligible = league
        else:
            team_eligible = team.loc[team[availability_column].fillna(False).astype(bool)]
            league_eligible = league.loc[league[availability_column].fillna(False).astype(bool)]

        denominator = int(len(team_eligible))
        numerator = int(team_eligible[event_column].fillna(False).astype(bool).sum())
        league_denominator = int(len(league_eligible))
        league_numerator = int(league_eligible[event_column].fillna(False).astype(bool).sum())
        status = self._status(denominator, league_denominator)
        league_rate = (
            league_numerator / league_denominator if league_denominator else None
        )

        if denominator == 0 or league_rate is None:
            posterior_mean = None
            interval: dict[str, float | None] = {"lower": None, "upper": None}
            prior_strength: float | None = None
            observed_rate = None
        else:
            # El suavizado impide parámetros Beta iguales a cero si la tasa de liga es 0 o 1.
            smoothed_league_rate = (league_numerator + 0.5) / (league_denominator + 1.0)
            alpha = smoothed_league_rate * PRIOR_STRENGTH + numerator
            beta = (1.0 - smoothed_league_rate) * PRIOR_STRENGTH + denominator - numerator
            posterior_mean = self._rounded(alpha / (alpha + beta))
            interval = self._interval(alpha, beta)
            prior_strength = PRIOR_STRENGTH
            observed_rate = self._rounded(numerator / denominator)

        return {
            "status": status,
            "numerator": numerator,
            "denominator": denominator,
            "observed_rate": observed_rate,
            "bayesian_estimate": {
                "posterior_mean": posterior_mean,
                "credible_interval_80": interval,
                "prior_strength": prior_strength,
            },
            "league_reference": {
                "sample_size": league_denominator,
                "rate": self._rounded(league_rate),
            },
        }

    def _mean_metric(
        self, team: pd.DataFrame, league: pd.DataFrame, value_column: str
    ) -> dict[str, Any]:
        team_values = pd.to_numeric(team[value_column], errors="coerce").dropna()
        league_values = pd.to_numeric(league[value_column], errors="coerce").dropna()
        team_sample_size = int(len(team_values))
        league_sample_size = int(len(league_values))
        status = self._status(team_sample_size, league_sample_size)
        return {
            "status": status,
            "value": self._rounded(team_values.mean(), 2) if team_sample_size else None,
            "sample_size": team_sample_size,
            "league_reference": {
                "sample_size": league_sample_size,
                "value": self._rounded(league_values.mean(), 2) if league_sample_size else None,
            },
        }

    def _distribution(
        self,
        team: pd.DataFrame,
        league: pd.DataFrame,
        value_column: str,
        categories: list[str],
    ) -> dict[str, Any]:
        team_values = team[value_column].dropna()
        league_values = league[value_column].dropna()
        team_sample_size = int(len(team_values))
        league_sample_size = int(len(league_values))
        status = self._status(team_sample_size, league_sample_size)
        team_counts = team_values.value_counts()
        league_counts = league_values.value_counts()

        posterior: np.ndarray | None = None
        intervals: np.ndarray | None = None
        if team_sample_size and league_sample_size:
            league_raw = np.array([int(league_counts.get(name, 0)) for name in categories])
            team_raw = np.array([int(team_counts.get(name, 0)) for name in categories])
            # Prior Dirichlet centrado en la mezcla contextual de liga.
            league_probs = (league_raw + 0.5) / (league_sample_size + 0.5 * len(categories))
            alpha = league_probs * PRIOR_STRENGTH + team_raw
            posterior = alpha / alpha.sum()
            intervals = self._dirichlet_intervals(alpha)

        category_payload = []
        for index, name in enumerate(categories):
            count = int(team_counts.get(name, 0))
            league_count = int(league_counts.get(name, 0))
            category_payload.append(
                {
                    "name": name,
                    "count": count,
                    "observed_rate": self._rounded(count / team_sample_size)
                    if team_sample_size
                    else None,
                    "bayesian_estimate": {
                        "posterior_mean": self._rounded(posterior[index])
                        if posterior is not None
                        else None,
                        "credible_interval_80": {
                            "lower": self._rounded(intervals[0, index])
                            if intervals is not None
                            else None,
                            "upper": self._rounded(intervals[1, index])
                            if intervals is not None
                            else None,
                        },
                    },
                    "league_reference_rate": self._rounded(league_count / league_sample_size)
                    if league_sample_size
                    else None,
                }
            )

        return {
            "status": status,
            "sample_size": team_sample_size,
            "categories": category_payload,
        }

    def _context_rows(
        self,
        down: int,
        distance: str,
        field_zone: str,
        score_state: str,
        last_two_minutes: bool,
    ) -> pd.DataFrame:
        rows = self.plays.loc[self.plays["down"].eq(down)].copy()
        if distance == "short":
            rows = rows.loc[rows["yardsToGo"].between(0, 6)]
        elif distance == "standard":
            rows = rows.loc[rows["yardsToGo"].between(7, 10)]
        elif distance == "long":
            rows = rows.loc[rows["yardsToGo"].ge(11)]

        zone_limits = {
            "red_zone": (1, 20),
            "opponent_territory": (21, 50),
            "own_territory": (51, 80),
            "backed_up": (81, 99),
        }
        lower, upper = zone_limits[field_zone]
        rows = rows.loc[rows["yards_to_endzone"].between(lower, upper)]

        score_mask = {
            "trailing": rows["score_difference"].le(-4),
            "close": rows["score_difference"].between(-3, 3),
            "leading": rows["score_difference"].ge(4),
        }[score_state]
        rows = rows.loc[score_mask]

        if last_two_minutes:
            rows = rows.loc[
                rows["quarter"].isin([2, 4]) & rows["clock_seconds"].le(120)
            ]
        return rows

    def matchup(
        self,
        offense_team: str,
        defense_team: str,
        down: int,
        distance: str,
        field_zone: str,
        score_state: str,
        last_two_minutes: bool,
    ) -> dict[str, Any]:
        league = self._context_rows(
            down, distance, field_zone, score_state, last_two_minutes
        )
        offense_rows = league.loc[league["possessionTeam"].eq(offense_team)]
        defense_rows = league.loc[league["defensiveTeam"].eq(defense_team)]

        offense_metrics = {
            "play_action_rate": self._binary_metric(
                offense_rows, league, "pff_playAction"
            ),
            "sack_received_rate": self._binary_metric(
                offense_rows.assign(_sack=offense_rows["passResult"].eq("S")),
                league.assign(_sack=league["passResult"].eq("S")),
                "_sack",
            ),
            "pressure_received_rate": self._binary_metric(
                offense_rows,
                league,
                "pressure_event",
                "pressure_available",
            ),
            "completion_rate": self._binary_metric(
                offense_rows,
                league,
                "completion_event",
                "completion_available",
            ),
            "yards_per_dropback": self._mean_metric(
                offense_rows, league, "playResult"
            ),
        }
        defense_metrics = {
            "pressure_generated_rate": self._binary_metric(
                defense_rows,
                league,
                "pressure_event",
                "pressure_available",
            ),
            "sack_generated_rate": self._binary_metric(
                defense_rows.assign(_sack=defense_rows["passResult"].eq("S")),
                league.assign(_sack=league["passResult"].eq("S")),
                "_sack",
            ),
            "defenders_in_box": self._mean_metric(
                defense_rows, league, "defendersInBox"
            ),
        }
        formation = self._distribution(
            offense_rows,
            league,
            "formation_group",
            ["shotgun", "empty", "singleback", "other"],
        )
        coverage = self._distribution(
            defense_rows,
            league,
            "coverage_group",
            ["man", "zone", "other"],
        )

        warnings = self._warnings(down, offense_rows, defense_rows, league, offense_metrics, defense_metrics, formation, coverage)
        signals = self._signals(offense_metrics, defense_metrics, formation, coverage)

        return {
            "context": {
                "offense_team": offense_team,
                "defense_team": defense_team,
                "down": down,
                "distance": distance,
                "field_zone": field_zone,
                "score_state": score_state,
                "last_two_minutes": last_two_minutes,
            },
            "offense": {
                "team": offense_team,
                "sample_size": int(len(offense_rows)),
                "confidence": self._confidence(int(len(offense_rows))),
                "metrics": offense_metrics,
                "formation_distribution": formation,
            },
            "defense": {
                "team": defense_team,
                "sample_size": int(len(defense_rows)),
                "confidence": self._confidence(int(len(defense_rows))),
                "metrics": defense_metrics,
                "coverage_distribution": coverage,
            },
            "matchup": {
                "method": "Comparación descriptiva de tendencias ofensivas, defensivas y de liga; no es una predicción determinista ni un modelo head-to-head.",
                "league_context_sample_size": int(len(league)),
                "signals": signals,
            },
            "warnings": warnings,
        }

    @staticmethod
    def _warnings(
        down: int,
        offense_rows: pd.DataFrame,
        defense_rows: pd.DataFrame,
        league: pd.DataFrame,
        offense_metrics: dict[str, Any],
        defense_metrics: dict[str, Any],
        formation: dict[str, Any],
        coverage: dict[str, Any],
    ) -> list[dict[str, str]]:
        warnings: list[dict[str, str]] = []
        if down == 4:
            warnings.append(
                {
                    "code": "fourth_down_limited",
                    "message": "Cuarta oportunidad tiene una muestra reducida; interpreta las tendencias con cautela.",
                }
            )
        if len(offense_rows) < 10:
            warnings.append(
                {
                    "code": "limited_offense_sample",
                    "message": "La ofensiva tiene menos de 10 jugadas directas en este contexto.",
                }
            )
        if len(defense_rows) < 10:
            warnings.append(
                {
                    "code": "limited_defense_sample",
                    "message": "La defensa tiene menos de 10 jugadas directas en este contexto.",
                }
            )
        all_statuses = [
            metric["status"]
            for metric in list(offense_metrics.values()) + list(defense_metrics.values())
        ] + [formation["status"], coverage["status"]]
        if "not_available" in all_statuses:
            warnings.append(
                {
                    "code": "missing_metric_data",
                    "message": "Al menos una métrica no cuenta con datos fuente para este contexto.",
                }
            )
        if len(league) == 0:
            warnings.append(
                {
                    "code": "no_matching_league_data",
                    "message": "No existen jugadas de liga que cumplan todos los filtros seleccionados.",
                }
            )
        return warnings

    @staticmethod
    def _signals(
        offense_metrics: dict[str, Any],
        defense_metrics: dict[str, Any],
        formation: dict[str, Any],
        coverage: dict[str, Any],
    ) -> list[dict[str, str]]:
        signals: list[dict[str, str]] = []

        def posterior_delta(metric: dict[str, Any]) -> float | None:
            estimate = metric["bayesian_estimate"]["posterior_mean"]
            league_rate = metric["league_reference"]["rate"]
            if estimate is None or league_rate is None:
                return None
            return float(estimate) - float(league_rate)

        defense_pressure_delta = posterior_delta(defense_metrics["pressure_generated_rate"])
        offense_pressure_delta = posterior_delta(offense_metrics["pressure_received_rate"])
        if (defense_pressure_delta is not None and defense_pressure_delta >= 0.05) or (
            offense_pressure_delta is not None and offense_pressure_delta >= 0.05
        ):
            signals.append(
                {
                    "type": "pressure_risk",
                    "severity": "high" if (defense_pressure_delta or 0) >= 0.10 else "moderate",
                    "title": "Señal de presión elevada",
                    "message": "La presión de la defensa o la presión permitida por la ofensiva está por encima de la referencia de liga para este contexto.",
                }
            )

        play_action_delta = posterior_delta(offense_metrics["play_action_rate"])
        if play_action_delta is not None and abs(play_action_delta) >= 0.08:
            direction = "mayor" if play_action_delta > 0 else "menor"
            signals.append(
                {
                    "type": "play_action_tendency",
                    "severity": "moderate",
                    "title": "Tendencia de play action",
                    "message": f"La tasa posterior de play action de la ofensiva es {direction} que la referencia de liga en este contexto.",
                }
            )

        def category_delta(distribution: dict[str, Any], category: str) -> float | None:
            item = next(entry for entry in distribution["categories"] if entry["name"] == category)
            estimate = item["bayesian_estimate"]["posterior_mean"]
            league_rate = item["league_reference_rate"]
            if estimate is None or league_rate is None:
                return None
            return float(estimate) - float(league_rate)

        shotgun_delta = category_delta(formation, "shotgun")
        if shotgun_delta is not None and abs(shotgun_delta) >= 0.10:
            signals.append(
                {
                    "type": "formation_tendency",
                    "severity": "moderate",
                    "title": "Tendencia de formación shotgun",
                    "message": "El uso posterior de shotgun difiere al menos 10 puntos porcentuales de la referencia de liga para este contexto.",
                }
            )

        man_delta = category_delta(coverage, "man")
        if man_delta is not None and abs(man_delta) >= 0.10:
            signals.append(
                {
                    "type": "coverage_tendency",
                    "severity": "moderate",
                    "title": "Tendencia de cobertura Man",
                    "message": "El uso posterior de cobertura Man difiere al menos 10 puntos porcentuales de la referencia de liga para este contexto.",
                }
            )

        if not signals:
            signals.append(
                {
                    "type": "insufficient_evidence",
                    "severity": "info",
                    "title": "Sin señal fuerte",
                    "message": "No se detectó una diferencia posterior relevante frente a la referencia de liga con los filtros seleccionados.",
                }
            )
        return signals[:4]
