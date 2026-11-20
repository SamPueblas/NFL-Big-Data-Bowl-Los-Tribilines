"""FastAPI application for NFL Tactical Matchup Intelligence."""
from __future__ import annotations

from functools import lru_cache

from fastapi import FastAPI, HTTPException, Query, Request

from backend.analytics import MatchupAnalytics, TEAM_CODES

app = FastAPI(title="Hackathon NFL UNAM")

DISTANCES = {"all", "short", "standard", "long"}
FIELD_ZONES = {"red_zone", "opponent_territory", "own_territory", "backed_up"}
SCORE_STATES = {"trailing", "close", "leading"}


@lru_cache(maxsize=1)
def get_analytics() -> MatchupAnalytics:
    """Load the two required source tables once per API process."""
    return MatchupAnalytics()


def validation_error(message: str) -> None:
    raise HTTPException(status_code=422, detail=message)


def validate_query(
    request: Request,
    offense_team: str,
    defense_team: str,
    down: int,
    distance: str,
    field_zone: str,
    score_state: str,
    last_two_minutes: str | None,
) -> bool:
    names = {
        "offense_team",
        "defense_team",
        "down",
        "distance",
        "field_zone",
        "score_state",
        "last_two_minutes",
    }
    for name in names:
        if len(request.query_params.getlist(name)) > 1:
            validation_error(f"El parámetro '{name}' no puede repetirse.")

    if offense_team not in TEAM_CODES:
        validation_error("'offense_team' debe ser un código NFL válido en mayúsculas.")
    if defense_team not in TEAM_CODES:
        validation_error("'defense_team' debe ser un código NFL válido en mayúsculas.")
    if offense_team == defense_team:
        validation_error("'offense_team' y 'defense_team' deben ser distintos.")
    if down not in {1, 2, 3, 4}:
        validation_error("'down' debe ser 1, 2, 3 o 4.")
    if distance not in DISTANCES:
        validation_error("'distance' debe ser all, short, standard o long.")
    if field_zone not in FIELD_ZONES:
        validation_error("'field_zone' no es válido.")
    if score_state not in SCORE_STATES:
        validation_error("'score_state' debe ser trailing, close o leading.")
    if down in {1, 4} and distance != "all":
        validation_error("Para down 1 o 4, 'distance' debe ser all.")
    if down in {2, 3} and distance == "all":
        validation_error("Para down 2 o 3, 'distance' no puede ser all.")
    if last_two_minutes not in {None, "true", "false"}:
        validation_error("'last_two_minutes' debe ser true o false.")
    return last_two_minutes == "true"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/matchup")
def get_matchup(
    request: Request,
    offense_team: str = Query(...),
    defense_team: str = Query(...),
    down: int = Query(...),
    distance: str = Query(...),
    field_zone: str = Query(...),
    score_state: str = Query(...),
    last_two_minutes: str | None = Query(None),
) -> dict:
    """Return contextual offensive, defensive and league trend estimates."""
    last_two_minutes_value = validate_query(
        request,
        offense_team,
        defense_team,
        down,
        distance,
        field_zone,
        score_state,
        last_two_minutes,
    )
    return get_analytics().matchup(
        offense_team=offense_team,
        defense_team=defense_team,
        down=down,
        distance=distance,
        field_zone=field_zone,
        score_state=score_state,
        last_two_minutes=last_two_minutes_value,
    )
