import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Leaf,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react';
import type { ActionRecommendation } from '@shared/types';

interface RecommendationCardProps {
  action: ActionRecommendation;
  adopted: boolean;
  onToggleAdopt: (id: string) => void;
}

const CATEGORY_META = {
  daily_routine: {
    label: 'Low-Emission Routine',
    icon: Sun,
    badge: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  indoor_iaq: {
    label: 'Indoor Air Hack',
    icon: ShieldCheck,
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  sustainable_alt: {
    label: 'Sustainable Alternative',
    icon: Leaf,
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
} as const;

const EFFORT_LABELS = {
  quick_win: 'Quick Win',
  habit_shift: 'Habit Shift',
  upgrade: 'Smart Upgrade',
} as const;

export function RecommendationCard({
  action,
  adopted,
  onToggleAdopt,
}: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = CATEGORY_META[action.category];
  const Icon = meta.icon;

  return (
    <article
      className={`flex flex-col justify-between rounded-2xl border p-5 transition ${
        adopted
          ? 'border-emerald-300 bg-emerald-50/25 shadow-sm'
          : 'border-slate-200/80 bg-white shadow-xs hover:border-slate-300'
      }`}
    >
      <div>
        {/* Top Meta */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.badge}`}
            >
              <Icon className="h-3 w-3" />
              {meta.label}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
              {EFFORT_LABELS[action.effort]}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
              {action.costEstimate}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onToggleAdopt(action.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
              adopted
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {adopted ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Adopted
              </>
            ) : (
              <>
                <Circle className="h-3.5 w-3.5" />
                Adopt Choice
              </>
            )}
          </button>
        </div>

        {/* Title & Summary */}
        <h3 className="mt-3 text-base font-bold text-slate-900">{action.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{action.summary}</p>

        {/* Tailored Why */}
        <div className="mt-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
          <span className="font-semibold text-slate-900">Why this fits you: </span>
          {action.tailoredWhy}
        </div>

        {/* Direct Impact Highlight */}
        <div className="mt-3 rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-900">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            Direct Impact of This Choice
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-white/90 px-2 py-1.5 shadow-2xs">
              <div className="text-sm font-extrabold text-emerald-700">
                -{action.directImpact.exposureReductionPct}%
              </div>
              <div className="text-[10px] font-medium text-slate-500">
                PM2.5 Dose (-{action.directImpact.pm25AvoidedUgDay} µg/d)
              </div>
            </div>
            <div className="rounded-lg bg-white/90 px-2 py-1.5 shadow-2xs">
              <div className="text-sm font-extrabold text-sky-700">
                {action.directImpact.co2eAvoidedKgDay} kg
              </div>
              <div className="text-[10px] font-medium text-slate-500">CO₂e / day avoided</div>
            </div>
            <div className="rounded-lg bg-white/90 px-2 py-1.5 shadow-2xs">
              <div className="text-sm font-extrabold text-indigo-700">
                {action.directImpact.noxPmEmissionsAvoidedGDay} g
              </div>
              <div className="text-[10px] font-medium text-slate-500">NOₓ + PM / day cut</div>
            </div>
          </div>

          <p className="mt-2.5 text-xs leading-relaxed text-emerald-950">
            {action.directImpact.explanation}
          </p>

          <div className="mt-2 flex items-start gap-1.5 border-t border-emerald-200/60 pt-2 text-[11px] text-emerald-900/90">
            <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
            <span>
              <strong>Community ripple:</strong> {action.directImpact.communityMultiplierNote}
            </span>
          </div>
        </div>
      </div>

      {/* Expandable Steps */}
      <div className="mt-3 border-t border-slate-100 pt-2.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900"
        >
          <span>Action Checklist ({action.steps.length} steps)</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expanded && (
          <ol className="mt-2 space-y-1.5 pl-4 text-xs text-slate-600 list-decimal">
            {action.steps.map((step, idx) => (
              <li key={idx} className="leading-relaxed">
                {step}
              </li>
            ))}
          </ol>
        )}
      </div>
    </article>
  );
}
