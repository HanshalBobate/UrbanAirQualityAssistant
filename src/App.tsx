import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Cpu,
  KeyRound,
  Leaf,
  ShieldCheck,
  Sparkles,
  Sun,
  Wind,
} from 'lucide-react';
import type {
  ActionCategory,
  ActionPlanResponse,
  AirQualitySnapshot,
  LifestyleProfile,
  PresetCity,
} from '@shared/types';
import {
  fetchActionPlan,
  fetchAirQuality,
  fetchHealth,
  fetchPresetCities,
} from './api';
import { AirQualityHero } from './components/AirQualityHero';
import { LifestyleForm } from './components/LifestyleForm';
import { ImpactLedger } from './components/ImpactLedger';
import { RecommendationCard } from './components/RecommendationCard';
import { AdvisorChat } from './components/AdvisorChat';
import { ApiKeyModal } from './components/ApiKeyModal';

const DEFAULT_PROFILE: LifestyleProfile = {
  mode: 'family',
  householdSize: 4,
  sensitivities: ['infants_toddlers', 'asthma_respiratory'],
  housingType: 'apartment',
  heatingSource: 'natural_gas',
  cookingFuel: 'natural_gas',
  commuteMode: 'gas_car',
  dailyCarKm: 16,
  hasAirPurifier: false,
  localChallenges: 'Morning school drop-off idling and stagnant winter haze',
};

const STORAGE_KEY = 'clearair_gemini_key';

export default function App() {
  const [presets, setPresets] = useState<PresetCity[]>([]);
  const [airQuality, setAirQuality] = useState<AirQualitySnapshot | null>(null);
  const [loadingAir, setLoadingAir] = useState(true);

  const [profile, setProfile] = useState<LifestyleProfile>(DEFAULT_PROFILE);
  const [plan, setPlan] = useState<ActionPlanResponse | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const [adoptedIds, setAdoptedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | ActionCategory>('all');

  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem(STORAGE_KEY) || '');
  const [serverGeminiConfigured, setServerGeminiConfigured] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const runPlan = useCallback(
    async (aq: AirQualitySnapshot, prof: LifestyleProfile, keyOverride?: string) => {
      setGeneratingPlan(true);
      try {
        const nextPlan = await fetchActionPlan({
          airQuality: aq,
          profile: prof,
          apiKey: keyOverride ?? apiKey,
        });
        setPlan(nextPlan);
        // Pre-adopt the highest-impact quick win in each category if none selected yet
        setAdoptedIds(
          nextPlan.recommendations.slice(0, 3).map((r) => r.id)
        );
      } finally {
        setGeneratingPlan(false);
      }
    },
    [apiKey]
  );

  const selectLocation = useCallback(
    async (loc: {
      latitude: number;
      longitude: number;
      name: string;
      country: string;
      region?: string;
      timezone?: string;
    }) => {
      setLoadingAir(true);
      try {
        const aq = await fetchAirQuality(loc);
        setAirQuality(aq);
        await runPlan(aq, profile);
      } finally {
        setLoadingAir(false);
      }
    },
    [profile, runPlan]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [health, presetList] = await Promise.all([
          fetchHealth(),
          fetchPresetCities(),
        ]);
        if (!mounted) return;
        setServerGeminiConfigured(health.geminiConfigured);
        setPresets(presetList);

        const initial = presetList[0] ?? {
          name: 'Lahore',
          country: 'Pakistan',
          latitude: 31.5497,
          longitude: 74.3436,
          timezone: 'Asia/Karachi',
        };
        const aq = await fetchAirQuality(initial);
        if (!mounted) return;
        setAirQuality(aq);
        setLoadingAir(false);
        await runPlan(aq, DEFAULT_PROFILE);
      } catch {
        if (mounted) setLoadingAir(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [runPlan]);

  const toggleAdopt = (id: string) => {
    setAdoptedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const adoptedActions = useMemo(
    () => (plan?.recommendations ?? []).filter((r) => adoptedIds.includes(r.id)),
    [plan, adoptedIds]
  );

  const filteredRecs = useMemo(() => {
    const all = plan?.recommendations ?? [];
    if (activeTab === 'all') return all;
    return all.filter((r) => r.category === activeTab);
  }, [plan, activeTab]);

  const handleSaveApiKey = (nextKey: string) => {
    setApiKey(nextKey);
    if (nextKey) localStorage.setItem(STORAGE_KEY, nextKey);
    else localStorage.removeItem(STORAGE_KEY);
    if (airQuality) {
      void runPlan(airQuality, profile, nextKey);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-emerald-600 text-white shadow-xs">
              <Wind className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
                ClearAir AI
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block">
                Winter Smog & Urban Air Quality Assistant for Families & Communities
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`hidden items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold sm:inline-flex ${
                plan?.engine === 'gemini-live'
                  ? 'border-sky-200 bg-sky-50 text-sky-800'
                  : 'border-slate-200 bg-slate-100 text-slate-700'
              }`}
            >
              {plan?.engine === 'gemini-live' ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-sky-600" />
                  Gemini Live ({plan.modelName})
                </>
              ) : (
                <>
                  <Cpu className="h-3.5 w-3.5 text-slate-500" />
                  Local Advisor Mode
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50"
            >
              <KeyRound className="h-3.5 w-3.5 text-sky-600" />
              {apiKey || serverGeminiConfigured ? 'Gemini Connected' : 'Connect Gemini Key'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <AirQualityHero
          airQuality={airQuality}
          presets={presets}
          loading={loadingAir}
          onSelectLocation={selectLocation}
        />

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Sidebar: Profile Customizer */}
          <div className="lg:col-span-4 xl:col-span-3">
            <LifestyleForm
              profile={profile}
              onChange={setProfile}
              onGenerate={() => airQuality && void runPlan(airQuality, profile)}
              generating={generatingPlan}
            />
          </div>

          {/* Right Main Column: Brief, Impact Ledger, Recommendations, Chat */}
          <div className="space-y-6 lg:col-span-8 xl:col-span-9">
            {plan && (
              <>
                {/* Situation Brief */}
                <section className="rounded-2xl border border-sky-200/80 bg-white p-5 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-800">
                      <Sparkles className="h-4 w-4 text-sky-600" />
                      Tailored Daily Action Brief
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Engine: {plan.modelName}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    {plan.situationBrief}
                  </p>
                </section>

                {/* Direct Impact Ledger */}
                <ImpactLedger
                  baselineDailyExposureUg={plan.baselineDailyExposureUg}
                  adoptedActions={adoptedActions}
                  householdSize={profile.householdSize}
                />

                {/* Category Filter Tabs */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('all')}
                      className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                        activeTab === 'all'
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      All Choices ({plan.recommendations.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('daily_routine')}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                        activeTab === 'daily_routine'
                          ? 'bg-sky-600 text-white'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Sun className="h-3.5 w-3.5" />
                      Low-Emission Routines
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('indoor_iaq')}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                        activeTab === 'indoor_iaq'
                          ? 'bg-indigo-600 text-white'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Indoor Air Quality Hacks
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('sustainable_alt')}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                        activeTab === 'sustainable_alt'
                          ? 'bg-emerald-600 text-white'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Leaf className="h-3.5 w-3.5" />
                      Sustainable Alternatives
                    </button>
                  </div>
                </div>

                {/* Recommendations Grid */}
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredRecs.map((rec) => (
                    <RecommendationCard
                      key={rec.id}
                      action={rec}
                      adopted={adoptedIds.includes(rec.id)}
                      onToggleAdopt={toggleAdopt}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Interactive GenAI Chat */}
            <AdvisorChat
              airQuality={airQuality}
              profile={profile}
              adoptedTitles={adoptedActions.map((a) => a.title)}
              apiKey={apiKey}
            />
          </div>
        </div>
      </main>

      <ApiKeyModal
        open={settingsOpen}
        currentKey={apiKey}
        serverConfigured={serverGeminiConfigured}
        onSave={handleSaveApiKey}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
