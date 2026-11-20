Sí, pueden trabajar en paralelo desde sus propias laptops y unirlo por GitHub. Es más recomendable que intentar desarrollar ambos desde esta misma máquina, porque pueden avanzar de forma independiente y usar pull requests para integrar con control.

Kiro no comparte una sesión ni archivos automáticamente entre computadoras. Cada persona usará Kiro sobre su copia local del repositorio. La sincronización ocurre mediante **Git y GitHub**.

## División recomendada

| Persona | Responsabilidad principal | Carpetas que debería tocar principalmente |
|---|---|---|
| Tú | Backend, análisis y modelo bayesiano | `backend/`, documentación técnica y pruebas del backend |
| Tu amiga | Frontend, visualización e interacción | `dashboard/` |
| Ambos | Contrato de API, integración y revisión | Archivo de contrato, PRs y pruebas finales |

Eviten editar el mismo archivo al mismo tiempo. Los conflictos más probables estarían en:

- `backend/main.py`, si ambos lo editan.
- `dashboard/src/...`, si trabajan sobre el mismo componente.
- `dashboard/vite.config.ts`, porque ahí irá el proxy de desarrollo.
- Archivos de configuración como `.gitignore` o `README.md`.

## Flujo de trabajo en GitHub

### 1. Un repositorio remoto como fuente oficial

El proyecto debe estar en un repositorio de GitHub de alguno de ustedes o de una organización del equipo.

La dueña o dueño del repositorio debe invitar a la otra persona como colaboradora:

**GitHub → Settings → Collaborators → Add people**

No compartan contraseñas ni tokens.

### 2. Cada quien clona el repositorio

Tu amiga, desde su computadora:

```powershell
git clone <URL-DEL-REPOSITORIO>
cd hackathon-unam
```

Después debe preparar el entorno con las instrucciones del proyecto. Los datos y `.env` requieren cuidado:

- `.env` no se sube ni se comparte por GitHub.
- No debe agregar credenciales de AWS al código, README o commits.
- Ambos deben tener una copia local válida del dataset para que el backend pueda calcular las métricas.
- No conviene subir o volver a commitear archivos grandes de datos salvo que ya formen parte consciente del repositorio y GitHub los soporte.

### 3. Una rama por tarea

No trabajen directamente sobre `main`.

Ejemplo de ramas:

```text
main
├── feature/backend-api-bayes
├── feature/frontend-dashboard
├── feature/api-integration
└── fix/<descripcion-corta>
```

Tú crearías una rama de backend:

```powershell
git checkout main
git pull origin main
git checkout -b feature/backend-api-bayes
```

Tu amiga crearía una rama de frontend:

```powershell
git checkout main
git pull origin main
git checkout -b feature/frontend-dashboard
```

Cada persona hace commits pequeños y descriptivos:

```powershell
git add backend
git commit -m "feat: add matchup trend endpoints"
git push -u origin feature/backend-api-bayes
```

```powershell
git add dashboard
git commit -m "feat: add matchup dashboard layout"
git push -u origin feature/frontend-dashboard
```

Luego abren un Pull Request hacia `main`. La otra persona revisa antes de hacer merge.

## La pieza clave: contrato de API antes de programar

Para que frontend y backend avancen sin esperarse, acuerden primero un contrato. Ese contrato define:

1. Qué filtros manda el dashboard.
2. Qué endpoint recibe esos filtros.
3. Qué campos devuelve el backend.
4. Qué significan los valores, intervalos y advertencias.
5. Qué campos pueden ser `null`.

Esto debe quedar versionado en un Markdown, por ejemplo `CONTRATO_API.md` en la raíz del proyecto. No necesitan implementar nada todavía para acordarlo.

Ejemplo conceptual de una petición:

```text
GET api/matchup?offense=DAL&defense=TB&situation=third_long&zone=red_zone&score_state=trailing
```

Importante: en el dashboard debe usarse una ruta relativa sin diagonal inicial, como exige el proyecto:

```ts
fetch('api/matchup?...')
```

Nunca:

```ts
fetch('/api/matchup?...')
```

Y la respuesta podría tener una estructura acordada como esta:

```json
{
  "context": {
    "offense_team": "DAL",
    "defense_team": "TB",
    "situation": "third_long",
    "zone": "red_zone",
    "score_state": "trailing"
  },
  "offense": {
    "sample_size": 31,
    "confidence_level": "moderate",
    "play_action": {
      "posterior_mean": 0.11,
      "credible_interval_80": [0.06, 0.18],
      "league_context_mean": 0.09
    }
  },
  "defense": {
    "sample_size": 28,
    "confidence_level": "moderate",
    "coverage_type": {
      "man": 0.47,
      "zone": 0.45,
      "other": 0.08
    }
  },
  "signals": [
    {
      "type": "pressure_risk",
      "level": "elevated",
      "message": "..."
    }
  ],
  "warnings": [
    "La estimación usa evidencia limitada para esta situación."
  ]
}
```

No es una especificación final. Es un ejemplo de por qué acordar el formato antes evita que el frontend tenga que rehacerse cuando el backend esté listo.

## Cómo puede avanzar el frontend sin backend terminado

Tu amiga puede construir en paralelo:

- Layout general.
- Selector de ofensiva y defensa.
- Filtros de situación, zona, marcador y reloj.
- Tarjetas de tendencia.
- Gráficas de barras, intervalos creíbles y distribución de coberturas.
- Estados de carga, error, datos insuficientes y advertencias.
- Navegación y diseño responsive.

Para no inventar datos deportivos, recomiendo que inicialmente use:

- Estados vacíos y componentes sin resultados.
- El contrato TypeScript de la respuesta.
- Una respuesta de ejemplo generada por el backend cuando exista el primer endpoint funcional.

Eviten llenar el frontend con métricas NFL ficticias solo para que “se vea completo”. Si usan datos temporales para diseñar una gráfica, deben estar claramente aislados como fixture de desarrollo y sustituirse antes de integrar. Lo mejor es que el backend entregue pronto un único resultado real para usarlo como referencia.

## Cómo puede avanzar el backend sin frontend terminado

Tú puedes construir:

- Lectura de los CSV.
- Validación de equipos y filtros.
- Transformación de contexto: down/distancia, zona, marcador y últimos dos minutos.
- Cálculo de priors de liga.
- Actualización Beta-Binomial y Dirichlet-Multinomial.
- Intervalos creíbles con `numpy`.
- Señales de matchup.
- Endpoints FastAPI bajo `api/...`.
- Pruebas o verificaciones sobre métricas conocidas.

El backend debe respetar el contrato del proyecto:

- `backend/main.py` expone `app`.
- `GET /health` devuelve `{"status": "ok"}`.
- Todos los endpoints de datos van bajo `/api/...`.
- No agregar dependencias.
- Python se ejecuta dentro de `.venv`.
- Los cálculos pueden hacerse al inicio de la app o bajo demanda, sin depender de escribir archivos.

## Integración local

Mientras desarrollan por separado:

- El backend corre con Uvicorn en el puerto 8000.
- El frontend corre con Vite en su puerto de desarrollo.
- `dashboard/vite.config.ts` debe tener el proxy de `/api` hacia `http://localhost:8000`.
- El dashboard seguirá llamando `fetch('api/...')`; Vite se encarga de redirigir durante desarrollo.

En producción ambos estarán bajo la misma URL, así que las rutas relativas son necesarias.

## Rutina recomendada antes de cada Pull Request

```powershell
git status
git fetch origin
git rebase origin/main
```

Después:

- Backend: comprobar que `/health` responde correctamente y que los endpoints devuelven JSON válido.
- Frontend: ejecutar el build de Vite.
- Proyecto completo: ejecutar:

```powershell
.\.hackathon\setup.cmd --check
```

Si hay conflictos durante el rebase, no usen `git reset --hard` ni borren trabajo. Resuelvan el archivo conflictivo, prueben y continúen el rebase.

## Recomendación final

Trabajen desde sus propias computadoras, con ramas separadas y PRs hacia `main`. Antes de que cualquiera escriba la aplicación, acuerden y documenten el contrato de API. Eso les permite desarrollar frontend y backend en paralelo sin depender de que la otra persona termine primero.
