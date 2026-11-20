# NFL Tactical Matchup Intelligence

Aplicación de apoyo para preparación táctica de partidos NFL. Compara tendencias de una ofensiva y una defensa en un contexto de juego de pase mediante datos del NFL Big Data Bowl 2021 y estimaciones bayesianas.

## Alcance

- Datos de las semanas 1 a 8 de la temporada 2021.
- Solo jugadas de pase (*dropbacks*).
- Tendencias de play action, formación, presión, sacks, cobertura y defensores en caja.
- Comparación descriptiva de ofensiva, defensa y referencia de liga. No predice una llamada garantizada ni la probabilidad de correr frente a pasar.

## Estructura

```text
backend/     API FastAPI y cálculos estadísticos
dashboard/   Interfaz React/Vite
data/        Dataset NFL, solo lectura
```

## Requisitos

El entorno del hackathon fija las versiones de Python, FastAPI, pandas, numpy, Node, React, Vite y Tailwind. No se requieren dependencias adicionales.

Verifica el entorno desde la raíz:

```powershell
.\.hackathon\setup.cmd --check
```

## Desarrollo

### Backend

Desde la raíz del repositorio, con la máquina virtual existente:

```powershell
.\.venv\Scripts\uvicorn.exe backend.main:app --reload --host 127.0.0.1 --port 8000
```

Comprobación de salud:

```text
http://localhost:8000/health
```

Respuesta esperada:

```json
{"status":"ok"}
```

La API de matchup está en:

```text
GET /api/matchup
```

La especificación completa de filtros, respuesta y métricas está en [`CONTRATO_API.md`](CONTRATO_API.md).

### Frontend

En otra terminal:

```powershell
cd dashboard
npm run dev
```

Durante desarrollo, Vite debe redirigir `/api` a `http://localhost:8000`. El dashboard debe consumir rutas relativas sin diagonal inicial:

```ts
fetch(`api/matchup?${searchParams.toString()}`)
```

No usar `fetch('/api/...')`, `localhost`, `127.0.0.1` ni URLs absolutas dentro del código del dashboard, porque el despliegue publica la aplicación bajo una subruta.

## Build y despliegue

Genera el frontend antes de iniciar el backend de producción:

```powershell
cd dashboard
npm run build
cd ..
.\.venv\Scripts\uvicorn.exe backend.main:app --host 0.0.0.0 --port 8000
```

`vite build` crea `dashboard/dist`. Si esa carpeta existe al iniciar FastAPI, el backend la sirve en `/` y mantiene los endpoints `/health` y `/api/...` en el mismo puerto.

## Entrega

Antes de entregar:

```powershell
.\.hackathon\setup.cmd --check
```

Para generar el archivo de entrega:

```powershell
.\.hackathon\setup.cmd --entregar
```

## Datos y seguridad

- Los archivos de `data/` son solo lectura.
- `.env` no se versiona ni se incluye en la entrega.
- Nunca agregues llaves, tokens o credenciales al código, commits o documentación.
