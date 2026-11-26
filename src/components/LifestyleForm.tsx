import { useState } from 'react';
import { BookmarkPlus, Gauge, Home, Sparkles, Trash2, Users } from 'lucide-react';
import type {
  CommuteMode,
  CookingFuel,
  HeatingSource,
  HousingType,
  LifestyleProfile,
  SavedHouseholdProfile,
  SensitivityGroup,
} from '@shared/types';
import type { TranslationStrings } from '../i18n/translations';

interface LifestyleFormProps {
  profile: LifestyleProfile;
  outdoorPm25: number;
  savedProfiles: SavedHouseholdProfile[];
  onLoadProfile: (saved: SavedHouseholdProfile) => void;
  onSaveProfileAs: (name: string) => void;
  onDeleteSavedProfile: (id: string) => void;
  onChange: (next: LifestyleProfile) => void;
  onGenerate: () => void;
  generating: boolean;
  t: TranslationStrings;
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
  outdoorPm25,
  savedProfiles,
  onLoadProfile,
  onSaveProfileAs,
  onDeleteSavedProfile,
  onChange,
  onGenerate,
  generating,
  t,
}: LifestyleFormProps) {
  const [newProfileName, setNewProfileName] = useState('');
  const [showSaveRow, setShowSaveRow] = useState(false);

  const toggleSensitivity = (id: SensitivityGroup) => {
    const exists = profile.sensitivities.includes(id);
    const next = exists
      ? profile.sensitivities.filter((s) => s !== id)
      : [...profile.sensitivities, id];
    onChange({ ...profile, sensitivities: next });
  };

  const ioRatio =
    typeof profile.measuredIndoorPm25 === 'number' && outdoorPm25 > 0
      ? Math.round((profile.measuredIndoorPm25 / outdoorPm25) * 100) / 100
      : null;

  return (
    <aside className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
        <div>
          <h2 className="text-base font-bold text-slate-900">{t.tailorTitle}</h2>
          <p className="text-xs text-slate-500">{t.tailorSubtitle}</p>
        </div>
      </div>

      {/* Saved Profiles Switcher */}
      <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
            {t.savedProfiles} ({savedProfiles.length})
          </span>
          <button
            type="button"
            onClick={() => setShowSaveRow((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:text-sky-900"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            {t.saveProfileBtn}
          </button>
        </div>

        {showSaveRow && (
          <div className="mt-2 flex gap-1.5">
            <input
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="e.g., Grandma's Apt / School"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs"
            />
            <button
              type="button"
              onClick={() => {
                if (!newProfileName.trim()) return;
                onSaveProfileAs(newProfileName.trim());
                setNewProfileName('');
                setShowSaveRow(false);
              }}
              className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white"
            >
              Save
            </button>
          </div>
        )}

        {savedProfiles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {savedProfiles.map((sp) => (
              <div
                key={sp.id}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px]"
              >
                <button
                  type="button"
                  onClick={() => onLoadProfile(sp)}
                  className="font-medium text-slate-800 hover:text-sky-700"
                >
                  {sp.name}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSavedProfile(sp.id)}
                  title="Delete saved profile"
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
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
              {t.familyHome}
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
              {t.communitySchool}
            </button>
          </div>
        </div>

        {/* Optional Indoor Sensor Calibration */}
        <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-3">
          <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-indigo-950">
            <Gauge className="h-3.5 w-3.5 text-indigo-600" />
            {t.indoorSensorLabel}
          </label>
          <input
            type="number"
            min={0}
            max={999}
            step={1}
            value={profile.measuredIndoorPm25 ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              onChange({
                ...profile,
                measuredIndoorPm25: raw === '' ? null : Math.max(0, Number(raw)),
              });
            }}
            placeholder={t.indoorSensorPlaceholder}
            className="w-full rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
          />
          {ioRatio !== null && (
            <div className="mt-1.5 text-[11px] font-medium text-indigo-900">
              {t.ioRatioLabel}: <strong>{ioRatio}</strong>{' '}
              {ioRatio <= 0.4
                ? '(Well-sealed / filtered)'
                : ioRatio <= 0.7
                ? '(Moderate infiltration)'
                : '(High smog leakage)'}
            </div>
          )}
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
          {generating ? t.synthesizingPlan : t.regeneratePlan}
        </button>
      </div>
    </aside>
  );
}
