import { useEffect } from 'react';
import { Printer, ShieldAlert, Wind, X } from 'lucide-react';
import type { ActionRecommendation, AirQualitySnapshot } from '@shared/types';

interface PrintableGuideModalProps {
  open: boolean;
  airQuality: AirQualitySnapshot | null;
  adoptedActions: ActionRecommendation[];
  onClose: () => void;
}

export function PrintableGuideModal({
  open,
  airQuality,
  adoptedActions,
  onClose,
}: PrintableGuideModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="printable-guide-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs print:static print:bg-white print:p-0"
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl print:max-h-none print:overflow-visible print:border-0 print:p-0 print:shadow-none">
        {/* Non-print Action Bar */}
        <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3 print:hidden">
          <div className="flex items-center gap-2">
            <Wind className="h-4 w-4 text-sky-600" aria-hidden="true" />
            <h3 id="printable-guide-title" className="text-base font-bold text-slate-900">
              1-Page Printable DIY Purifier & Emergency Smog Sheet
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save PDF
            </button>
            <button
              type="button"
              aria-label="Close printable guide dialog"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable 1-Page Sheet */}
        <div className="space-y-4 text-slate-900">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-slate-900 pb-3">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">
                ClearAir AI — Winter Smog Emergency & DIY Clean-Air Guide
              </h1>
              <p className="text-xs text-slate-600">
                Location: <strong>{airQuality?.locationName ?? 'Local Neighborhood'}</strong> •
                US AQI: <strong>{airQuality?.current.usAqi ?? '—'}</strong> (
                {airQuality?.current.aqiCategory ?? '—'}) • Cleanest 3h Window:{' '}
                <strong>
                  {airQuality?.bestVentilationWindow
                    ? `${airQuality.bestVentilationWindow.startHour}–${airQuality.bestVentilationWindow.endHour}`
                    : 'Mid-afternoon'}
                </strong>
              </p>
            </div>
            <span className="rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-bold uppercase">
              Fridge / Classroom Poster
            </span>
          </header>

          {/* Two-Column Core Sheet */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* DIY Corsi-Rosenthal Box */}
            <div className="rounded-xl border border-slate-300 p-4">
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-indigo-900">
                1. $50 DIY Corsi-Rosenthal Air Purifier
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Cuts bedroom/classroom PM2.5 by <strong>60–75%</strong> in 45 minutes.
              </p>
              <div className="mt-2.5 text-xs">
                <strong>Materials:</strong>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-700">
                  <li>Four 20×20×1" (or 2") <strong>MERV-13</strong> pleated furnace filters</li>
                  <li>One standard 20" square <strong>box fan</strong></li>
                  <li>1 roll of duct tape + the fan&apos;s cardboard box</li>
                </ul>
              </div>
              <div className="mt-2.5 text-xs">
                <strong>5-Minute Assembly:</strong>
                <ol className="mt-1 list-decimal space-y-1 pl-4 text-slate-700">
                  <li>
                    Tape the 4 filters into an open square cube with <strong>airflow arrows pointing INWARD</strong>.
                  </li>
                  <li>Tape a 20×20" piece of cardboard onto the bottom as a sealed floor.</li>
                  <li>
                    Tape the box fan on top blowing <strong>UPWARD</strong> (exhausting clean air out).
                  </li>
                  <li>
                    Tape a 2-inch cardboard &ldquo;shroud&rdquo; ring over the fan&apos;s corners so air doesn&apos;t leak backward.
                  </li>
                  <li>Run continuously on Medium in the sleeping room with doors/windows closed.</li>
                </ol>
              </div>
            </div>

            {/* Emergency Smog Action Thresholds */}
            <div className="rounded-xl border border-slate-300 p-4">
              <h2 className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-rose-900">
                <ShieldAlert className="h-4 w-4 text-rose-600" />
                2. Severe Smog Action Thresholds
              </h2>
              <div className="mt-2.5 space-y-2 text-xs">
                <div className="rounded-lg bg-amber-50 p-2 border border-amber-200">
                  <strong>AQI 101–150 (Sensitive Groups):</strong> Move vigorous kids&apos; sports
                  to shortest afternoon dip; keep rescue inhalers accessible; avoid roadside walks.
                </div>
                <div className="rounded-lg bg-orange-50 p-2 border border-orange-200">
                  <strong>AQI 151–200 (Unhealthy):</strong> Cancel outdoor PE/playgrounds; wear
                  well-fitted <strong>N95/KF94</strong> masks outside; keep windows sealed; car vents
                  on <strong>Recirculate</strong>.
                </div>
                <div className="rounded-lg bg-rose-50 p-2 border border-rose-200">
                  <strong>AQI 201+ (Very Unhealthy / Emergency):</strong> Run HEPA/CR-Box on
                  High before bedtime; zero indoor combustion (no candles, incense, wood fires); use
                  electric kettle/induction + range hood when cooking; open clean-air refuge rooms.
                </div>
              </div>
            </div>
          </div>

          {/* Household Adopted Plan */}
          <div className="rounded-xl border border-slate-300 p-4">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-emerald-900">
              3. Our Household / Community Adopted Commitments ({adoptedActions.length})
            </h2>
            {adoptedActions.length === 0 ? (
              <p className="mt-1.5 text-xs text-slate-600">
                Adopt choices in the dashboard to list your customized daily commitments here.
              </p>
            ) : (
              <ul className="mt-2 grid gap-2 sm:grid-cols-2 text-xs">
                {adoptedActions.map((act) => (
                  <li key={act.id} className="rounded-lg bg-slate-50 p-2 border border-slate-200">
                    <div className="font-bold text-slate-900">{act.title}</div>
                    <div className="mt-0.5 text-[11px] text-emerald-800">
                      Impact: -{act.directImpact.exposureReductionPct}% PM2.5 dose •{' '}
                      {act.directImpact.co2eAvoidedKgDay} kg CO₂e/day avoided
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
