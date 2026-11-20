# Contrato API: análisis de matchup

**Versión:** 1.0  
**Objetivo:** contrato mínimo para que frontend y backend desarrollen en paralelo durante el hackathon.

## Reglas de integración

- El backend expone FastAPI desde `backend/main.py` como `app`.
- `GET /health` responde siempre `{"status":"ok"}`.
- El endpoint de datos del servidor es `/api/matchup`.
- Desde React/Vite se solicita **sin diagonal inicial**:

  ```ts
  fetch(`api/matchup?${searchParams.toString()}`)
  ```

  No usar `fetch('/api/matchup?...')` ni URLs absolutas.
- El endpoint describe tendencias en jugadas de pase. No predice pase frente a carrera ni garantiza la siguiente llamada.

---

## Endpoint

```http
GET /api/matchup
```

Devuelve tendencias ofensivas del equipo atacante, tendencias defensivas del equipo defensor, referencias de liga y señales descriptivas para el contexto seleccionado.

### Parámetros de consulta

Todos los nombres y valores son en minúsculas, salvo los códigos de equipo.

| Parámetro | Obligatorio | Valores aceptados | Definición |
|---|---:|---|---|
| `offense_team` | Sí | Código NFL de tres caracteres de la lista siguiente | Equipo en posesión; calcula sus métricas ofensivas. |
| `defense_team` | Sí | Código NFL de tres caracteres de la lista siguiente, distinto de `offense_team` | Equipo en defensa; calcula sus métricas defensivas. |
| `down` | Sí | `1`, `2`, `3`, `4` | Down de la situación. |
| `distance` | Sí | `all`, `short`, `standard`, `long` | Grupo de `yardsToGo`. Para `down=1` y `down=4` debe enviarse `all`. |
| `field_zone` | Sí | `red_zone`, `opponent_territory`, `own_territory`, `backed_up` | Zona respecto a la ofensiva. |
| `score_state` | Sí | `trailing`, `close`, `leading` | Diferencia de marcador desde el equipo ofensivo. |
| `last_two_minutes` | No | `true`, `false` | Cuando es `true`, conserva solo jugadas del 2.º o 4.º cuarto con 2:00 o menos. Si es `false` u omitido, no restringe por reloj. Por defecto: `false`. |

### Códigos de equipo válidos

```text
ARI, ATL, BAL, BUF, CAR, CHI, CIN, CLE,
DAL, DEN, DET, GB, HOU, IND, JAX, KC,
LA, LAC, LV, MIA, MIN, NE, NO, NYG,
NYJ, PHI, PIT, SEA, SF, TB, TEN, WAS
```

### Definición exacta de filtros

| Filtro | Regla sobre el dataset |
|---|---|
| Base | Solo `down` de 1 a 4 y `quarter` de 1 a 4. Se excluyen conversiones de dos puntos (`down=0`) y tiempo extra. |
| `distance=short` | `yardsToGo` entre 0 y 6, inclusivo. |
| `distance=standard` | `yardsToGo` entre 7 y 10, inclusivo. |
| `distance=long` | `yardsToGo >= 11`. |
| `distance=all` | Sin filtro adicional por `yardsToGo`; permitido únicamente en 1.ª y 4.ª oportunidad. |
| `field_zone=red_zone` | De 1 a 20 yardas hasta la zona de anotación rival. |
| `field_zone=opponent_territory` | De 21 a 50 yardas hasta la zona de anotación rival. |
| `field_zone=own_territory` | De 51 a 80 yardas hasta la zona de anotación rival. |
| `field_zone=backed_up` | De 81 a 99 yardas hasta la zona de anotación rival. |
| `score_state=trailing` | Diferencia ofensiva menor o igual a -4. |
| `score_state=close` | Diferencia ofensiva entre -3 y +3, inclusiva. |
| `score_state=leading` | Diferencia ofensiva mayor o igual a +4. |
| `last_two_minutes=true` | `quarter` en `{2, 4}` y `gameClock <= 02:00`. |

La distancia a anotación se deriva de `yardlineSide`, `yardlineNumber` y `possessionTeam`. No se usa `absoluteYardlineNumber` para este filtro.

### Validación

- `offense_team` y `defense_team` deben ser códigos válidos y distintos.
- `down=1` o `down=4` requiere `distance=all`.
- `down=2` o `down=3` requiere `distance=short`, `standard` o `long`.
- Un parámetro ausente, repetido, fuera de catálogo o incompatible devuelve **HTTP 422**.

Respuesta de error de validación:

```json
{
  "detail": "Mensaje legible que identifica el parámetro inválido."
}
```

---

## Respuesta exitosa: HTTP 200

La siguiente plantilla define la estructura completa. Los valores `number`, `string`, `boolean` y `null` indican el tipo que entregará la API; no son datos NFL de ejemplo.

```json
{
  "context": {
    "offense_team": "string",
    "defense_team": "string",
    "down": "number",
    "distance": "all | short | standard | long",
    "field_zone": "red_zone | opponent_territory | own_territory | backed_up",
    "score_state": "trailing | close | leading",
    "last_two_minutes": "boolean"
  },
  "offense": {
    "team": "string",
    "sample_size": "number",
    "confidence": "high | moderate | limited | none",
    "metrics": {
      "play_action_rate": {
        "status": "ok | insufficient_data | no_team_data | not_available",
        "numerator": "number",
        "denominator": "number",
        "observed_rate": "number | null",
        "bayesian_estimate": {
          "posterior_mean": "number | null",
          "credible_interval_80": {
            "lower": "number | null",
            "upper": "number | null"
          },
          "prior_strength": "number | null"
        },
        "league_reference": {
          "sample_size": "number",
          "rate": "number | null"
        }
      },
      "sack_received_rate": {
        "status": "ok | insufficient_data | no_team_data | not_available",
        "numerator": "number",
        "denominator": "number",
        "observed_rate": "number | null",
        "bayesian_estimate": {
          "posterior_mean": "number | null",
          "credible_interval_80": {
            "lower": "number | null",
            "upper": "number | null"
          },
          "prior_strength": "number | null"
        },
        "league_reference": {
          "sample_size": "number",
          "rate": "number | null"
        }
      },
      "pressure_received_rate": {
        "status": "ok | insufficient_data | no_team_data | not_available",
        "numerator": "number",
        "denominator": "number",
        "observed_rate": "number | null",
        "bayesian_estimate": {
          "posterior_mean": "number | null",
          "credible_interval_80": {
            "lower": "number | null",
            "upper": "number | null"
          },
          "prior_strength": "number | null"
        },
        "league_reference": {
          "sample_size": "number",
          "rate": "number | null"
        }
      },
      "completion_rate": {
        "status": "ok | insufficient_data | no_team_data | not_available",
        "numerator": "number",
        "denominator": "number",
        "observed_rate": "number | null",
        "bayesian_estimate": {
          "posterior_mean": "number | null",
          "credible_interval_80": {
            "lower": "number | null",
            "upper": "number | null"
          },
          "prior_strength": "number | null"
        },
        "league_reference": {
          "sample_size": "number",
          "rate": "number | null"
        }
      },
      "yards_per_dropback": {
        "status": "ok | insufficient_data | no_team_data | not_available",
        "value": "number | null",
        "sample_size": "number",
        "league_reference": {
          "sample_size": "number",
          "value": "number | null"
        }
      }
    },
    "formation_distribution": {
      "status": "ok | insufficient_data | no_team_data | not_available",
      "sample_size": "number",
      "categories": [
        {
          "name": "shotgun | empty | singleback | other",
          "count": "number",
          "observed_rate": "number | null",
          "bayesian_estimate": {
            "posterior_mean": "number | null",
            "credible_interval_80": {
              "lower": "number | null",
              "upper": "number | null"
            }
          },
          "league_reference_rate": "number | null"
        }
      ]
    }
  },
  "defense": {
    "team": "string",
    "sample_size": "number",
    "confidence": "high | moderate | limited | none",
    "metrics": {
      "pressure_generated_rate": {
        "status": "ok | insufficient_data | no_team_data | not_available",
        "numerator": "number",
        "denominator": "number",
        "observed_rate": "number | null",
        "bayesian_estimate": {
          "posterior_mean": "number | null",
          "credible_interval_80": {
            "lower": "number | null",
            "upper": "number | null"
          },
          "prior_strength": "number | null"
        },
        "league_reference": {
          "sample_size": "number",
          "rate": "number | null"
        }
      },
      "sack_generated_rate": {
        "status": "ok | insufficient_data | no_team_data | not_available",
        "numerator": "number",
        "denominator": "number",
        "observed_rate": "number | null",
        "bayesian_estimate": {
          "posterior_mean": "number | null",
          "credible_interval_80": {
            "lower": "number | null",
            "upper": "number | null"
          },
          "prior_strength": "number | null"
        },
        "league_reference": {
          "sample_size": "number",
          "rate": "number | null"
        }
      },
      "defenders_in_box": {
        "status": "ok | insufficient_data | no_team_data | not_available",
        "value": "number | null",
        "sample_size": "number",
        "league_reference": {
          "sample_size": "number",
          "value": "number | null"
        }
      }
    },
    "coverage_distribution": {
      "status": "ok | insufficient_data | no_team_data | not_available",
      "sample_size": "number",
      "categories": [
        {
          "name": "man | zone | other",
          "count": "number",
          "observed_rate": "number | null",
          "bayesian_estimate": {
            "posterior_mean": "number | null",
            "credible_interval_80": {
              "lower": "number | null",
              "upper": "number | null"
            }
          },
          "league_reference_rate": "number | null"
        }
      ]
    }
  },
  "matchup": {
    "method": "Comparación descriptiva de tendencias ofensivas, defensivas y de liga; no es una predicción determinista ni un modelo head-to-head.",
    "league_context_sample_size": "number",
    "signals": [
      {
        "type": "pressure_risk | formation_tendency | coverage_tendency | play_action_tendency | insufficient_evidence",
        "severity": "info | low | moderate | high",
        "title": "string",
        "message": "string"
      }
    ]
  },
  "warnings": [
    {
      "code": "limited_offense_sample | limited_defense_sample | fourth_down_limited | missing_metric_data | no_matching_league_data",
      "message": "string"
    }
  ]
}
```

### Formato de números

- Tasas y probabilidades: decimal entre `0.0` y `1.0`; el frontend las convierte a porcentaje.
- `credible_interval_80.lower` y `upper`: decimales entre `0.0` y `1.0`.
- `yards_per_dropback` y `defenders_in_box`: números decimales redondeados por backend a dos posiciones.
- Los conteos y tamaños de muestra son enteros no negativos.

---

## Definiciones de métricas

El filtro contextual se aplica primero. Para ofensiva se conservan las filas cuyo `possessionTeam` coincide con `offense_team`; para defensa, las filas cuyo `defensiveTeam` coincide con `defense_team`.

| Métrica | Numerador | Denominador | Fuente |
|---|---|---|---|
| `play_action_rate` | Jugadas con `pff_playAction = 1` | Todas las jugadas ofensivas filtradas | `plays.csv` |
| `sack_received_rate` | Jugadas ofensivas con `passResult = "S"` | Todas las jugadas ofensivas filtradas | `plays.csv` |
| `pressure_received_rate` | Jugadas ofensivas donde al menos un defensor tiene `pff_hit = 1`, `pff_hurry = 1` o `pff_sack = 1` | Todas las jugadas ofensivas filtradas con scouting disponible | `pffScoutingData.csv` |
| `completion_rate` | Jugadas con `passResult = "C"` | Jugadas con `passResult` en `{"C", "I", "IN"}` | `plays.csv` |
| `yards_per_dropback` | Suma de `playResult` | Todas las jugadas ofensivas filtradas | `plays.csv` |
| Formación | Conteo de jugadas de cada categoría | Todas las jugadas ofensivas filtradas | `plays.csv` |
| `pressure_generated_rate` | Jugadas defensivas donde al menos un defensor tiene `pff_hit = 1`, `pff_hurry = 1` o `pff_sack = 1` | Todas las jugadas defensivas filtradas con scouting disponible | `pffScoutingData.csv` |
| `sack_generated_rate` | Jugadas defensivas con `passResult = "S"` | Todas las jugadas defensivas filtradas | `plays.csv` |
| `defenders_in_box` | No aplica: media de `defendersInBox` | Número de jugadas defensivas filtradas con ese valor disponible | `plays.csv` |
| Cobertura | Conteo de cada categoría Man, Zone u Other | Todas las jugadas defensivas filtradas con cobertura disponible | `plays.csv` |

### Agrupaciones categóricas

| Campo de respuesta | Regla |
|---|---|
| `formation_distribution.shotgun` | `offenseFormation = "SHOTGUN"` |
| `formation_distribution.empty` | `offenseFormation = "EMPTY"` |
| `formation_distribution.singleback` | `offenseFormation = "SINGLEBACK"` |
| `formation_distribution.other` | `I_FORM`, `PISTOL`, `JUMBO`, `WILDCAT` o valor faltante |
| `coverage_distribution.man` | `pff_passCoverageType = "Man"` |
| `coverage_distribution.zone` | `pff_passCoverageType = "Zone"` |
| `coverage_distribution.other` | `pff_passCoverageType = "Other"` o valor faltante |

`yards_per_dropback` usa `playResult`, que es la ganancia neta registrada en el dataset e incluye el efecto registrado de penalizaciones. La app debe mostrarlo como métrica descriptiva, no como EPA.

---

## Estimaciones bayesianas y referencia de liga

- Para tasas binarias se usa una actualización **Beta-Binomial**.
- Para distribuciones de formación y cobertura se usa una actualización **Dirichlet-Multinomial**.
- La referencia de liga usa todas las jugadas de la liga que cumplen el mismo filtro contextual. Incluye las jugadas de los equipos seleccionados.
- `observed_rate` es la frecuencia directa de equipo: `numerator / denominator`.
- `posterior_mean` combina la frecuencia directa con un prior centrado en la referencia de liga contextual.
- `credible_interval_80` es el intervalo creíble central al 80% de la distribución posterior.
- `prior_strength` es el número efectivo de observaciones del prior. Se devuelve para explicar cuánto se contrajo la estimación hacia la liga.

No se devuelve una probabilidad conjunta de que una ofensiva específica use una formación contra una defensa específica: el dataset no tiene evidencia suficiente de cada enfrentamiento equipo contra equipo. El bloque `matchup` compara tendencias de ambos lados y referencias de liga.

---

## Datos faltantes y evidencia insuficiente

Cada métrica, distribución y promedio devuelve `status`.

| `status` | Condición | Representación |
|---|---|---|
| `ok` | Tiene 10 o más observaciones directas en su denominador | Valores y estimación posterior disponibles. |
| `insufficient_data` | Tiene entre 1 y 9 observaciones directas | Se devuelven conteos y estimación posterior, pero el frontend debe mostrar advertencia. |
| `no_team_data` | No hay observaciones del equipo para el filtro | Conteos en `0`; tasas, estimaciones e intervalos en `null`. La referencia de liga sigue disponible si existe. |
| `not_available` | Falta el campo fuente o no existen datos de liga para calcular la métrica | Conteos disponibles si aplican; valor, tasa, estimación e intervalo en `null`. |

La confianza de cada bloque sigue esta misma regla:

| `confidence` | Muestra directa del equipo |
|---|---:|
| `high` | 30 o más jugadas |
| `moderate` | 10 a 29 jugadas |
| `limited` | 1 a 9 jugadas |
| `none` | 0 jugadas |

### Advertencias obligatorias

- Cuando `down=4`, incluir `fourth_down_limited`, incluso si hay datos suficientes.
- Cuando la ofensiva o defensa tenga menos de 10 jugadas, incluir la advertencia correspondiente.
- Cuando una métrica no esté disponible, incluir `missing_metric_data`.
- Cuando no haya muestra de liga para el contexto, incluir `no_matching_league_data`.

---

## Alcance de la primera implementación

Este contrato cubre una única pantalla de matchup y un único endpoint. No incluye detalle por jugador, tracking frame a frame, rutas de receptor, autenticación, persistencia ni IA. Esos elementos quedan fuera del MVP de 90 minutos.
