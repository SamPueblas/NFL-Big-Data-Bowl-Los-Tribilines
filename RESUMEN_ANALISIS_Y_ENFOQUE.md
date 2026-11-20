# Resumen de análisis y enfoque acordado

## Dataset

Fuente: NFL Big Data Bowl, temporada 2021, semanas 1 a 8.

El conjunto contiene exclusivamente jugadas de pase (*dropbacks*). Por tanto, cualquier conclusión está condicionada a que ya ocurrió una jugada de pase. No permite estimar la probabilidad de pase frente a carrera ni analizar equipos especiales.

### Tablas

| Tabla | Observaciones | Llave | Representa |
|---|---:|---|---|
| `games.csv` | 122 | `gameId` | Un partido |
| `plays.csv` | 8,557 | `gameId`, `playId` | Una jugada de pase |
| `players.csv` | 1,679 | `nflId` | Un jugador que aparece en tracking |
| `pffScoutingData.csv` | 188,254 | `gameId`, `playId`, `nflId` | Un jugador en una jugada, con rol y evaluación PFF |
| `tracking/tracking_<gameId>.csv` | 8,314,178 | `gameId`, `playId`, `nflId`, `frameId` | Posición y movimiento de jugador o balón por frame |

Relaciones:

- `games` 1→N `plays`, mediante `gameId`.
- `plays` 1→22 `pffScoutingData`, mediante `gameId` y `playId`.
- `plays` 1→N `tracking`, mediante `gameId` y `playId`.
- `players` 1→N `pffScoutingData` y `tracking`, mediante `nflId`.

Las llaves revisadas no tienen duplicados. Todas las jugadas de `plays` tienen tracking y scouting. Cada jugada contiene 22 jugadores en scouting y tracking, además de las filas del balón en tracking.

## Calidad y límites de los datos

### Valores faltantes esperados

- `penaltyYards` y `foulName*` están vacíos cuando no hubo penalización.
- Los indicadores PFF de presión y bloqueo están vacíos cuando el rol del jugador no aplica. Un vacío no debe convertirse automáticamente en cero.
- Las filas del balón en tracking tienen `nflId`, dorsal, orientación y dirección vacíos.
- `event` está vacío en la mayoría de frames porque solo marca eventos concretos.
- `yardlineSide` está vacío en las 125 jugadas sobre la yarda 50.

### Valores faltantes relevantes

- `players.birthDate`: 232 valores vacíos y 14 fechas no interpretables.
- `players.collegeName`: 224 valores vacíos.
- `plays.dropBackType`: 528 valores vacíos.
- `plays.offenseFormation`: 7 valores vacíos.
- `plays.defendersInBox`: 7 valores vacíos.

### Anomalías o precauciones

- Existen 35 jugadas con `down = 0`, probablemente conversiones de dos puntos. Se excluyen del análisis principal.
- Hay 98 jugadas de tiempo extra (`quarter = 5`). Se excluyen del análisis principal.
- En 253 jugadas, `playResult` no es igual a `prePenaltyPlayResult + penaltyYards`. Las penalizaciones pueden reemplazar el resultado de la jugada, por lo que la regla de cálculo de yardas debe documentarse.
- Las 190 intercepciones tienen `playResult = 0`; no hay yardas de devolución.
- Hay 543 jugadas con `passResult = S`, mientras que los créditos PFF de sack suman 602. Antes de comparar ambas métricas se debe resolver esta diferencia o usar cada fuente con su definición propia.
- `absoluteYardlineNumber` no coincide de forma consistente con la posición calculada desde `yardlineSide`, `yardlineNumber` y el equipo en posesión. Para analizar zona de campo se usará el cálculo derivado de estas últimas variables.
- Las coordenadas de tracking superan ocasionalmente los límites teóricos del campo y la aceleración alcanza valores físicamente poco plausibles. Se deben tratar como ruido del sensor al analizar movimiento.
- Faltan 25 eventos `ball_snap`; las métricas de tiempo desde el snap deben excluir o marcar esas jugadas.
- Los eventos de resultado como recepción, tackle y salida del campo son demasiado escasos para emplearlos como fuente principal del desenlace. El resultado debe obtenerse de `plays.csv`.
- `displayName` no es único. Las uniones de jugadores deben usar `nflId`.

## Perspectiva elegida: coach

Se eligió una aplicación de toma de decisiones para **coaches**, enfocada en preparación de partido y análisis de tendencias de jugadas de pase.

### Razón de la elección

| Perspectiva | Ajuste al dataset | Razón |
|---|---|---|
| Coach | Alto | El dataset tiene contexto situacional, formaciones, coberturas, presión y tracking para apoyar decisiones de preparación. |
| Scout | Bajo | Solo cubre ocho semanas, faltan carreras y equipos especiales, y los datos personales de jugadores son limitados. |
| Comentarista | Medio | Puede producir narrativa, pero faltan marcador final, EPA y probabilidad de victoria. Tiene menos valor directo para decidir. |

La pregunta central acordada es:

> Dado un contexto de juego de pase, ¿cómo suele atacar un equipo, cómo suele defender el rival y qué señales de riesgo o compatibilidad muestra el matchup?

La herramienta no debe asegurar que conoce la llamada exacta de la siguiente jugada. Debe describir tendencias, incertidumbre y evidencia disponible.

## Variables de contexto acordadas

Base de análisis: 8,424 jugadas. Se excluyen 133 jugadas con `down = 0` o tiempo extra.

### Situación: down y distancia

| Grupo | Definición |
|---|---|
| 1ª oportunidad | Cualquier distancia |
| 2ª corta | 1 a 6 yardas por avanzar |
| 2ª estándar | 7 a 10 yardas por avanzar |
| 2ª larga | 11 o más yardas por avanzar |
| 3ª corta | 1 a 6 yardas por avanzar |
| 3ª estándar | 7 a 10 yardas por avanzar |
| 3ª larga | 11 o más yardas por avanzar |
| 4ª oportunidad | Cualquier distancia |

La cuarta oportunidad se muestra con una advertencia de evidencia limitada, porque tiene poca muestra por equipo.

### Zona del campo

Se calcula como yardas hasta la zona de anotación rival, usando `yardlineSide`, `yardlineNumber` y `possessionTeam`.

| Grupo | Yardas hasta anotación rival |
|---|---|
| Zona roja | 1 a 20 |
| Campo contrario | 21 a 50 |
| Campo propio | 51 a 80 |
| Respaldado | 81 a 99 |

### Marcador

La diferencia se calcula desde la perspectiva del equipo ofensivo.

| Grupo | Diferencia de marcador |
|---|---|
| Va perdiendo | Pierde por 4 o más |
| Partido parejo | De -3 a +3 |
| Va ganando | Gana por 4 o más |

### Reloj

Se usa una bandera adicional para los últimos dos minutos del segundo y cuarto cuarto. Se ofrecerá como filtro, no como una dimensión que multiplique las celdas del modelo.

## Hallazgos de tamaño de muestra

Cada equipo tiene entre 203 y 339 jugadas ofensivas en el periodo, con una media de 263.

| Nivel de segmentación | Mediana de jugadas por celda de equipo | Interpretación |
|---|---:|---|
| Equipo × down | 77 | Muestra útil |
| Equipo × down × distancia | 10 | Muchas celdas pequeñas |
| Equipo × down × zona | 6 | Requiere fuerte regularización |
| Equipo × situación × zona × marcador | 0 | Inviable como tabla de frecuencias directa |

Por este motivo, no se cruzarán todas las variables como segmentos independientes de equipo. El enfoque bayesiano incorporará contexto sin convertir cada combinación en una celda aislada.

## Métricas principales

### Tendencias ofensivas

- Probabilidad de play action.
- Distribución de formación: Shotgun, Empty, Singleback y otras.
- Distribución de tipo de dropback: tradicional, rollout, scramble y otras/no clasificadas.
- Tasa de completos, incompletos, intercepciones, scrambles y sacks.
- Tasa de presión recibida según etiquetas PFF.
- Yardas netas por dropback, documentando el tratamiento de penalizaciones.

### Tendencias defensivas

- Probabilidad de cobertura Man, Zone u Other.
- Distribución de familias de cobertura: Cover-1, Cover-2, Cover-3, Quarters, Cover-6 y otras.
- Defensores en la caja.
- Tasa de presión y de captura generada.
- Hurries, hits y sacks por jugador y posición alineada.
- Resultados de protección por bloqueador y tipo de bloqueo, cuando el tamaño de muestra sea suficiente.

### Métricas de movimiento posibles

- Tiempo entre `ball_snap` y `pass_forward`, cuando ambos eventos existen.
- Velocidad, aceleración, distancia recorrida y profundidad de jugadores.
- Distancias y separación entre jugadores, normalizando primero la dirección de juego.

## Enfoque bayesiano

El enfoque es necesario porque las frecuencias simples se vuelven poco fiables al segmentar por equipo y situación.

### Variables binarias: Beta-Binomial

Se aplica a play action, uso de una formación, cobertura Man, presión, sack, scramble u otros resultados binarios.

- Se parte de una tasa de la liga para el contexto correspondiente.
- La información observada del equipo actualiza esa tasa.
- Con pocas jugadas, el resultado se acerca prudentemente a la liga.
- Con suficientes jugadas, refleja más claramente la tendencia del equipo.
- Se muestra la media posterior y un intervalo creíble.

### Variables categóricas: Dirichlet-Multinomial

Se aplica a formación, familia de cobertura, tipo de dropback y resultado del pase.

- El prior es la distribución de la liga dentro del contexto.
- Los conteos del equipo actualizan el prior.
- Evita conclusiones extremas, por ejemplo asumir que un equipo juega una cobertura 100% del tiempo solo porque ocurrió en dos observaciones.

### Aplicación del contexto

- El nivel principal es equipo × situación.
- Zona y marcador ajustan el prior a nivel liga en lugar de crear una tabla completa por equipo.
- El reloj de dos minutos es un filtro contextual.
- El modelo mostrará tamaño de muestra e incertidumbre para cada estimación.

Este modelo se puede implementar con pandas y numpy, sin agregar dependencias al stack del proyecto.

## Matchup: ofensiva contra defensa

El producto incluirá matchup en la primera versión.

No se entrenará una tendencia directa de Equipo A contra Equipo B, porque en ocho semanas la mayoría de pares se enfrentan cero o una vez. Esa evidencia no sería fiable.

El matchup combinará:

1. Tendencia ofensiva del equipo atacante en el contexto seleccionado.
2. Tendencia defensiva del equipo rival en el mismo contexto.
3. Referencia de la liga para ese contexto.
4. Resultados históricos de combinaciones que sí existen en toda la liga, por ejemplo Shotgun contra Man, play action contra Zone o 3ª y larga contra Cover-1.

Las conclusiones se redactarán como señales de preparación, por ejemplo:

- Tendencia compatible entre formación ofensiva y cobertura frecuente del rival.
- Riesgo elevado de presión cuando ofensiva y defensa están por encima de la media en sus respectivos indicadores.
- Evidencia insuficiente cuando la muestra directa del equipo sea reducida.

No se presentarán estas señales como causalidad o predicción determinista.

## Propuesta de pantallas

### 1. Configurador de situación

Filtros:

- Equipo ofensivo.
- Equipo defensivo.
- Down y distancia.
- Zona del campo.
- Estado del marcador.
- Últimos dos minutos, opcional.

### 2. Tendencias ofensivas

- Play action y formación esperada.
- Tipo de dropback.
- Resultado y riesgo de presión.
- Estimación posterior, intervalo creíble y muestra.

### 3. Tendencias defensivas

- Cobertura Man/Zone/Other y familia de cobertura.
- Presión, sacks y defensores en caja.
- Principales generadores de presión.
- Estimación posterior, intervalo creíble y muestra.

### 4. Resumen de matchup

- Tendencias ofensivas y defensivas lado a lado.
- Señales de riesgo, compatibilidad y muestra limitada.
- Comparación contra la media contextual de la liga.

## Indicador de confianza

Cada métrica debe indicar la muestra directa del equipo, su intervalo creíble y un nivel de confianza.

| Nivel | Criterio orientativo |
|---|---|
| Alta confianza | 30 o más jugadas directas |
| Confianza moderada | 10 a 29 jugadas directas |
| Evidencia limitada | Menos de 10 jugadas directas |

El nivel de confianza no reemplaza al intervalo creíble; ambos se deben mostrar.

## Límites metodológicos para mostrar en la aplicación

> El análisis usa jugadas de pase de las semanas 1 a 8 de la temporada 2021. Las estimaciones describen tendencias condicionadas a que ocurrió una jugada de pase. No estiman la probabilidad de correr frente a pasar ni garantizan la siguiente llamada.

> Las coberturas son etiquetas PFF registradas después de la jugada. Se utilizan para estudiar tendencias defensivas, no como información observable con certeza antes del snap.

> El matchup compara patrones ofensivos, defensivos y de liga. No representa evidencia suficiente para afirmar una causalidad directa entre un par específico de equipos.

## Próxima etapa

Definir el contrato funcional del MVP antes de escribir código:

1. Filtros exactos del dashboard.
2. Métricas, denominadores y reglas de tratamiento de penalizaciones.
3. Forma de cada respuesta de la API.
4. Visualizaciones de React y Recharts.
5. Método de cálculo y almacenamiento en memoria de los agregados.
