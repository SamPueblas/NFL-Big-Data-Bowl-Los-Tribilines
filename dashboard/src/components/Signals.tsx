import type { Severity, Signal, Warning } from '../types'

const SEV: Record<Severity, { label: string; bar: string; text: string }> = {
  high: { label: 'ALTA', bar: 'bg-danger', text: 'text-danger' },
  moderate: { label: 'MEDIA', bar: 'bg-accent', text: 'text-accent' },
  low: { label: 'BAJA', bar: 'bg-sky-400', text: 'text-sky-400' },
  info: { label: 'INFO', bar: 'bg-slate-500', text: 'text-slate-400' },
}
const ORDER: Severity[] = ['high', 'moderate', 'low', 'info']

export function Signals({ signals }: { signals: Signal[] }) {
  const sorted = [...signals].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity))
  if (sorted.length === 0) {
    return <p className="text-sm text-slate-400">El análisis no generó señales tácticas para este contexto.</p>
  }
  return (
    <ul className="grid gap-3 md:grid-cols-2 list-none p-0 m-0">
      {sorted.map((s, i) => {
        const sev = SEV[s.severity] ?? SEV.info
        return (
          <li key={`${s.type}-${i}`} className="flex bg-ink-800 border border-ink-700 rounded overflow-hidden">
            <div className={`w-1 shrink-0 ${sev.bar}`} />
            <div className="p-3 min-w-0">
              <div className={`text-[11px] font-bold tracking-widest ${sev.text}`}>{sev.label}</div>
              <div className="text-sm font-semibold text-white">{s.title}</div>
              <p className="text-sm text-slate-300 mt-1">{s.message}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function Warnings({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) return null
  return (
    <div role="alert" className="border border-warn/40 bg-warn/10 rounded p-3">
      <div className="text-xs font-bold tracking-widest text-warn mb-1">ADVERTENCIAS SOBRE LA EVIDENCIA</div>
      <ul className="list-disc pl-5 text-sm text-slate-200 space-y-0.5 m-0">
        {warnings.map((w, i) => <li key={`${w.code}-${i}`}>{w.message}</li>)}
      </ul>
    </div>
  )
}
