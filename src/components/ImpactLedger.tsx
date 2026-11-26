import { useState } from 'react';
import { BarChart3, Gauge, Globe2, HeartPulse, Printer, Users } from 'lucide-react';
import type { ActionRecommendation } from '@shared/types';
import { combineAdoptedImpacts } from '@shared/impactMath';
import type { TranslationStrings } from '../i18n/translations';

interface ImpactLedgerProps {
  baselineDailyExposureUg: number;
  infiltrationRatio: number;
  exposureCalibratedBySensor: boolean;
  adoptedActions: ActionRecommendation[];
  householdSize: number;
  onOpenPrintableGuide: () => void;
  t: TranslationStrings;
}

const COMMUNITY_SCALES = [10, 50, 100, 250, 500, 1000];

export function ImpactLedger({
  baselineDailyExposureUg,
  infiltrationRatio,
  exposureCalibratedBySensor,
  adoptedActions,
  householdSize,
  onOpenPrintableGuide,
  t,
}: ImpactLedgerProps) {
  const [communityHouseholds, setCommunityHouseholds] = useState(100);

  const impact = combineAdoptedImpacts(
    baselineDailyExposureUg,
    adoptedActions,
    householdSize,
    communityHouseholds
  );

  const remainingBarPct = Math.max(8, 100 - impact.combinedExposureReductionPct);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 p-5 text-white shadow-md sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-300">
            <BarChart3 className="h-4 w-4" />
            {t.directImpactLedger}
          </div>
          <h2 className="mt-0.5 text-lg font-bold">
            What Your {adoptedActions.length} Adopted{' '}
            {adoptedActions.length === 1 ? 'Choice' : 'Choices'} Actually Achieve
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${
              exposureCalibratedBySensor
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                : 'border-white/15 bg-white/10 text-sky-100'
            }`}
          >
            <Gauge className="h-3.5 w-3.5" />
            {exposureCalibratedBySensor
              ? `Sensor-Calibrated (I/O ${infiltrationRatio})`
              : `Modeled I/O ${infiltrationRatio}`}
          </span>

          <button
            type="button"
            onClick={onOpenPrintableGuide}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            <Printer className="h-3.5 w-3.5" />
            {t.printableGuide}
          </button>
        </div>
      </div>

      {/* Personal Exposure Reduction Bar */}
      <div className="mt-5 grid gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 lg:col-span-6">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-slate-200">
              <HeartPulse className="h-4 w-4 text-emerald-400" />
              24-Hour Personal PM2.5 Inhaled Dose
            </span>
            <span className="font-bold text-emerald-400">
              -{impact.combinedExposureReductionPct}% ({impact.pm25AvoidedUgDay} µg/day spared)
            </span>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            <div>
              <div className="mb-1 flex justify-between text-slate-400">
                <span>Without changes (Baseline)</span>
                <span className="font-mono font-semibold text-slate-200">
                  {baselineDailyExposureUg} µg/day
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-full rounded-full bg-rose-400/80" />
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-slate-300">
                <span>With your adopted choices</span>
                <span className="font-mono font-semibold text-emerald-300">
                  {impact.projectedDailyExposureUg} µg/day
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  style={{ width: `${remainingBarPct}%` }}
                  className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                />
              </div>
            </div>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-slate-300">
            Calculated from ~15 m³/day breathing volume,{' '}
            {exposureCalibratedBySensor
              ? 'your measured indoor PM2.5 monitor'
              : 'building infiltration factor'}
            , and diminishing-returns exposure stacking (capped at 90%).
          </p>
        </div>

        {/* Emissions Prevented + Community Multiplier */}
        <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/5 p-4 lg:col-span-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white/5 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-sky-200">
                <Globe2 className="h-3.5 w-3.5" />
                Household CO₂e Cut
              </div>
              <div className="mt-1 text-xl font-extrabold text-white">
                {impact.monthlyCo2eAvoidedKg} kg
                <span className="ml-1 text-xs font-normal text-slate-300">/mo</span>
              </div>
              <div className="text-[11px] text-slate-400">
                {impact.co2eAvoidedKgDay} kg/day avoided
              </div>
            </div>

            <div className="rounded-lg bg-white/5 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-200">
                <Users className="h-3.5 w-3.5" />
                Local Smog Pollutants Cut
              </div>
              <div className="mt-1 text-xl font-extrabold text-white">
                {impact.noxPmEmissionsAvoidedGDay} g
                <span className="ml-1 text-xs font-normal text-slate-300">/day</span>
              </div>
              <div className="text-[11px] text-slate-400">NOₓ & primary PM2.5 avoided</div>
            </div>
          </div>

          {/* Community Ripple Slider */}
          <div className="mt-3 border-t border-white/10 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-sky-200">
                Neighborhood Ripple ({communityHouseholds} households):
              </span>
              <div className="flex flex-wrap gap-1">
                {COMMUNITY_SCALES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCommunityHouseholds(n)}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                      communityHouseholds === n
                        ? 'bg-sky-500 text-white'
                        : 'bg-white/10 text-slate-300 hover:bg-white/20'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-2 text-xs text-slate-200">
              If <strong>{communityHouseholds} local households</strong> adopt this same plan, the
              community keeps{' '}
              <strong className="text-emerald-300">
                {impact.communityPm25AvoidedKgMonth} kg/month
              </strong>{' '}
              of local NOₓ + smoke particulates and{' '}
              <strong className="text-sky-300">
                {impact.communityCo2eAvoidedTonsMonth} tons/month
              </strong>{' '}
              of CO₂e out of your winter airshed.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
