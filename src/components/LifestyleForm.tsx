import { Sparkles, Users, Home } from 'lucide-react';
import type {
  CommuteMode,
  CookingFuel,
  HeatingSource,
  HousingType,
  LifestyleProfile,
  SensitivityGroup,
} from '@shared/types';

interface LifestyleFormProps {
  profile: LifestyleProfile;
  onChange: (next: LifestyleProfile) => void;
  onGenerate: () => void;
  generating: boolean;
}

const SENSITIVITY_OPTIONS: Array<{ id: SensitivityGroup; label: string }> = [
  { id: 'infants_toddlers', label: 'Infants / Toddlers' },
  { id: 'asthma_respiratory', label: 'Asthma / Respiratory' },
  { id: 'elderly', label: 'Older Adults (65+)' },
  { id: 'pregnant', label: 'Pregnant' },
  { id: 'outdoor_workers', label: 'Outdoor Workers' },
  { id: 'pets', label: 'Indoor Pets' },
];

export function LifestyleForm({
  profile,
  onChange,
  onGenerate,
  generating,
}: LifestyleFormProps) {
  const toggleSensitivity = (id: SensitivityGroup) => {
    const exists = profile.sensitivities.includes(id);
    const next = exists
      ? profile.sensitivities.filter((s) => s !== id)
      : [...profile.sensitivities, id];
    onChange({ ...profile, sensitivities: next });
  };

  return (
    <aside className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
        <div>
          <h2 className="text-base font-bold text-slate-900">Tailor to Your Lifestyle</h2>
          <p className="text-xs text-slate-500">
            Personalize routines, indoor hacks & emission swaps.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {/* Family vs Community Mode */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Planning For
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...profile,
                  mode: 'family',
                  householdSize: profile.mode === 'community' ? 4 : profile.householdSize,
                })
              }
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                profile.mode === 'family'
                  ? 'border-sky-600 bg-sky-50 text-sky-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Home className="h-3.5 w-3.5" />
              Family Home
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...profile,
                  mode: 'community',
                  householdSize: profile.mode === 'family' ? 50 : profile.householdSize,
                })
              }
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                profile.mode === 'community'
                  ? 'border-sky-600 bg-sky-50 text-sky-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Community / School
            </button>
          </div>
        </div>

        {/* Sensitive Groups */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Sensitive Groups Present
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SENSITIVITY_OPTIONS.map((opt) => {
              const active = profile.sensitivities.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleSensitivity(opt.id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    active
                      ? 'border-sky-600 bg-sky-600 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Housing & Heating */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Building / Home Type
            </label>
            <select
              value={profile.housingType}
              onChange={(e) =>
                onChange({ ...profile, housingType: e.target.value as HousingType })
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-sky-500 focus:bg-white"
            >
              <option value="apartment">Apartment / Condo</option>
              <option value="single_family_house">Single-Family House</option>
              <option value="older_drafty_home">Older / Drafty Home</option>
              <option value="community_center_school">School / Community Hall</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Primary Winter Heating
            </label>
            <select
              value={profile.heatingSource}
              onChange={(e) =>
                onChange({ ...profile, heatingSource: e.target.value as HeatingSource })
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-sky-500 focus:bg-white"
            >
              <option value="natural_gas">Natural Gas Furnace / Boiler</option>
              <option value="electric_heat_pump">Electric / Heat Pump</option>
              <option value="wood_pellet_stove">Wood / Pellet Stove or Fireplace</option>
              <option value="coal_biomass">Coal / Biomass Heater</option>
              <option value="district_heating">District Heating</option>
            </select>
          </div>
        </div>

        {/* Cooking & Commute */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Cooking Fuel
            </label>
            <select
              value={profile.cookingFuel}
              onChange={(e) =>
                onChange({ ...profile, cookingFuel: e.target.value as CookingFuel })
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-sky-500 focus:bg-white"
            >
              <option value="natural_gas">Natural Gas Stove</option>
              <option value="lpg_wood">LPG Cylinder / Solid Fuel</option>
              <option value="induction_electric">Induction / Electric</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Primary Daily Commute
            </label>
            <select
              value={profile.commuteMode}
              onChange={(e) =>
                onChange({ ...profile, commuteMode: e.target.value as CommuteMode })
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-sky-500 focus:bg-white"
            >
              <option value="gas_car">Gasoline / Diesel Car</option>
              <option value="ev_hybrid">EV / Plug-in Hybrid</option>
              <option value="public_transit">Bus / Metro / Rail</option>
              <option value="walk_bike">Walk / Bike</option>
              <option value="remote_flexible">Mostly Work / Study From Home</option>
            </select>
          </div>
        </div>

        {/* Daily Car Distance */}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Daily Household Driving</span>
            <span className="text-sky-700">{profile.dailyCarKm} km/day</span>
          </div>
          <input
            type="range"
            min={0}
            max={60}
            step={2}
            value={profile.dailyCarKm}
            onChange={(e) => onChange({ ...profile, dailyCarKm: Number(e.target.value) })}
            className="w-full accent-sky-600"
          />
        </div>

        {/* Air Purifier Checkbox */}
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-800">
          <span>Already own a HEPA air purifier?</span>
          <input
            type="checkbox"
            checked={profile.hasAirPurifier}
            onChange={(e) => onChange({ ...profile, hasAirPurifier: e.target.checked })}
            className="h-4 w-4 rounded accent-sky-600"
          />
        </label>

        {/* Local Challenges */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            Local Smog Challenges (Optional)
          </label>
          <textarea
            rows={2}
            value={profile.localChallenges}
            onChange={(e) => onChange({ ...profile, localChallenges: e.target.value })}
            placeholder="e.g., morning school-gate idling, nearby leaf burning, dusty highway..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-sky-500 focus:bg-white"
          />
        </div>

        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4 text-sky-400" />
          {generating ? 'Synthesizing Tailored Plan...' : 'Regenerate Tailored Plan'}
        </button>
      </div>
    </aside>
  );
}
