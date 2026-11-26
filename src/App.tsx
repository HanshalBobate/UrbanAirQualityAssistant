import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  Cpu,
  Globe,
  KeyRound,
  Leaf,
  Printer,
  ShieldCheck,
  Sparkles,
  Sun,
  Wind,
} from 'lucide-react';
import type {
  ActionCategory,
  ActionPlanResponse,
  AirQualitySnapshot,
  AlertEvaluationResult,
  CommunityPledge,
  LifestyleProfile,
  PledgeCategory,
  PresetCity,
  SavedHouseholdProfile,
  SmogAlertSubscription,
  SupportedLanguage,
} from '@shared/types';
import {
  createCommunityPledge,
  deleteAlertSubscription,
  evaluateAlertSubscriptions,
  fetchActionPlan,
  fetchAirQuality,
  fetchAlerts,
  fetchHealth,
  fetchPledges,
  fetchPresetCities,
  joinCommunityPledge,
  saveAlertSubscription,
} from './api';
import { LANGUAGE_OPTIONS, TRANSLATIONS } from './i18n/translations';
import { AirQualityHero } from './components/AirQualityHero';
import { LifestyleForm } from './components/LifestyleForm';
import { ImpactLedger } from './components/ImpactLedger';
import { RecommendationCard } from './components/RecommendationCard';
import { CommunityPledgesSection } from './components/CommunityPledgesSection';
import { AdvisorChat } from './components/AdvisorChat';
import { ApiKeyModal } from './components/ApiKeyModal';
import { AlertsModal } from './components/AlertsModal';
import { PrintableGuideModal } from './components/PrintableGuideModal';

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
  measuredIndoorPm25: null,
  localChallenges: 'Morning school drop-off idling and stagnant winter haze',
};

const STORAGE_KEYS = {
  apiKey: 'clearair_gemini_key',
  profile: 'clearair_active_profile',
  adoptedIds: 'clearair_adopted_ids',
  savedProfiles: 'clearair_saved_profiles',
  location: 'clearair_last_location',
  language: 'clearair_language',
  joinedPledges: 'clearair_joined_pledges',
};

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [presets, setPresets] = useState<PresetCity[]>([]);
  const [airQuality, setAirQuality] = useState<AirQualitySnapshot | null>(null);
  const [loadingAir, setLoadingAir] = useState(true);

  const [language, setLanguage] = useState<SupportedLanguage>(
    () => (localStorage.getItem(STORAGE_KEYS.language) as SupportedLanguage) || 'en'
  );
  const t = TRANSLATIONS[language] ?? TRANSLATIONS.en;

  const [profile, setProfile] = useState<LifestyleProfile>(() =>
    readJsonStorage<LifestyleProfile>(STORAGE_KEYS.profile, DEFAULT_PROFILE)
  );
  const [savedProfiles, setSavedProfiles] = useState<SavedHouseholdProfile[]>(() =>
    readJsonStorage<SavedHouseholdProfile[]>(STORAGE_KEYS.savedProfiles, [])
  );

  const [plan, setPlan] = useState<ActionPlanResponse | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const [adoptedIds, setAdoptedIds] = useState<string[]>(() =>
    readJsonStorage<string[]>(STORAGE_KEYS.adoptedIds, [])
  );
  const [activeTab, setActiveTab] = useState<'all' | ActionCategory>('all');

  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem(STORAGE_KEYS.apiKey) || ''
  );
  const [serverGeminiConfigured, setServerGeminiConfigured] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Morning Smog Alerts
  const [alerts, setAlerts] = useState<SmogAlertSubscription[]>([]);
  const [triggeredAlerts, setTriggeredAlerts] = useState<AlertEvaluationResult[]>([]);
  const [alertsOpen, setAlertsOpen] = useState(false);

  // Community Pledges & Printable Guide
  const [pledges, setPledges] = useState<CommunityPledge[]>([]);
  const [joinedPledgeIds, setJoinedPledgeIds] = useState<string[]>(() =>
    readJsonStorage<string[]>(STORAGE_KEYS.joinedPledges, [])
  );
  const [printableOpen, setPrintableOpen] = useState(false);
  const [highlightedPledgeId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('pledge');
  });

  // Persist profile, adoptedIds, savedProfiles, language, joinedPledges
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.adoptedIds, JSON.stringify(adoptedIds));
  }, [adoptedIds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.savedProfiles, JSON.stringify(savedProfiles));
  }, [savedProfiles]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.language, language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.joinedPledges, JSON.stringify(joinedPledgeIds));
  }, [joinedPledgeIds]);

  const checkAlertTriggers = useCallback(async (aq: AirQualitySnapshot) => {
    try {
      const evals = await evaluateAlertSubscriptions(aq);
      const fired = evals.filter((e) => e.triggered);
      setTriggeredAlerts(fired);

      if (
        fired.length > 0 &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        new Notification(`ClearAir Smog Alert: ${aq.locationName}`, {
          body: `${fired[0].subscription.label}: ${fired[0].reasons.join(' & ')}`,
        });
      }
    } catch {
      // Non-fatal
    }
  }, []);

  const runPlan = useCallback(
    async (
      aq: AirQualitySnapshot,
      prof: LifestyleProfile,
      keyOverride?: string,
      langOverride?: SupportedLanguage
    ) => {
      setGeneratingPlan(true);
      try {
        const nextPlan = await fetchActionPlan({
          airQuality: aq,
          profile: prof,
          apiKey: keyOverride ?? apiKey,
          language: langOverride ?? language,
        });
        setPlan(nextPlan);
        setAdoptedIds((prev) => {
          const valid = prev.filter((id) =>
            nextPlan.recommendations.some((r) => r.id === id)
          );
          return valid.length > 0
            ? valid
            : nextPlan.recommendations.slice(0, 3).map((r) => r.id);
        });
      } finally {
        setGeneratingPlan(false);
      }
    },
    [apiKey, language]
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
      localStorage.setItem(STORAGE_KEYS.location, JSON.stringify(loc));
      setLoadingAir(true);
      try {
        const aq = await fetchAirQuality(loc);
        setAirQuality(aq);
        await Promise.all([runPlan(aq, profile), checkAlertTriggers(aq)]);
      } finally {
        setLoadingAir(false);
      }
    },
    [profile, runPlan, checkAlertTriggers]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [health, presetList, alertList, pledgeList] = await Promise.all([
          fetchHealth(),
          fetchPresetCities(),
          fetchAlerts(),
          fetchPledges(),
        ]);
        if (!mounted) return;
        setServerGeminiConfigured(health.geminiConfigured);
        setPresets(presetList);
        setAlerts(alertList);
        setPledges(pledgeList);

        const savedLoc = readJsonStorage<{
          latitude: number;
          longitude: number;
          name: string;
          country: string;
          region?: string;
          timezone?: string;
        } | null>(STORAGE_KEYS.location, null);

        const initial = savedLoc ?? presetList[0] ?? {
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
        await Promise.all([
          runPlan(aq, readJsonStorage(STORAGE_KEYS.profile, DEFAULT_PROFILE)),
          checkAlertTriggers(aq),
        ]);
      } catch {
        if (mounted) setLoadingAir(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [runPlan, checkAlertTriggers]);

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
    if (nextKey) localStorage.setItem(STORAGE_KEYS.apiKey, nextKey);
    else localStorage.removeItem(STORAGE_KEYS.apiKey);
    if (airQuality) {
      void runPlan(airQuality, profile, nextKey, language);
    }
  };

  const handleLanguageChange = (nextLang: SupportedLanguage) => {
    setLanguage(nextLang);
    if (airQuality) {
      void runPlan(airQuality, profile, apiKey, nextLang);
    }
  };

  const handleSaveProfileAs = (name: string) => {
    const entry: SavedHouseholdProfile = {
      id: `prof-${Date.now()}`,
      name,
      profile,
      adoptedIds,
      updatedAt: new Date().toISOString(),
    };
    setSavedProfiles((prev) => [entry, ...prev]);
  };

  const handleLoadSavedProfile = (saved: SavedHouseholdProfile) => {
    setProfile(saved.profile);
    if (saved.adoptedIds.length > 0) setAdoptedIds(saved.adoptedIds);
    if (airQuality) {
      void runPlan(airQuality, saved.profile, apiKey, language);
    }
  };

  const handleCreateAlert = async (input: Parameters<typeof saveAlertSubscription>[0]) => {
    const created = await saveAlertSubscription(input);
    setAlerts((prev) => [created, ...prev]);
    if (airQuality) await checkAlertTriggers(airQuality);
  };

  const handleDeleteAlert = async (id: string) => {
    await deleteAlertSubscription(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    setTriggeredAlerts((prev) => prev.filter((e) => e.subscription.id !== id));
  };

  const handleJoinPledge = async (id: string) => {
    const updated = await joinCommunityPledge(id);
    setPledges((prev) => prev.map((p) => (p.id === id ? updated : p)));
    setJoinedPledgeIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleCreatePledge = async (input: {
    category: PledgeCategory;
    title: string;
    description: string;
    city: string;
    organizer: string;
    targetHouseholds: number;
  }) => {
    const created = await createCommunityPledge(input);
    setPledges((prev) => [created, ...prev]);
    setJoinedPledgeIds((prev) => [...prev, created.id]);
  };

  return (
    <div dir={t.dir} className="min-h-screen bg-slate-50 text-slate-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-slate-900 focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-emerald-600 text-white shadow-xs">
              <Wind className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
                {t.appName}
              </h1>
              <p className="hidden text-xs text-slate-500 lg:block">{t.tagline}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Engine Badge */}
            <div
              className={`hidden items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold xl:inline-flex ${
                plan?.engine === 'gemini-live'
                  ? 'border-sky-200 bg-sky-50 text-sky-800'
                  : 'border-slate-200 bg-slate-100 text-slate-700'
              }`}
            >
              {plan?.engine === 'gemini-live' ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-sky-600" />
                  Gemini Live
                </>
              ) : (
                <>
                  <Cpu className="h-3.5 w-3.5 text-slate-500" />
                  Local Advisor
                </>
              )}
            </div>

            {/* Language Selector */}
            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
              <Globe className="h-3.5 w-3.5 text-slate-500" />
              <select
                aria-label="Language"
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
                className="bg-transparent outline-none"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.native}
                  </option>
                ))}
              </select>
            </div>

            {/* Morning Alerts Button */}
            <button
              type="button"
              onClick={() => setAlertsOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                triggeredAlerts.length > 0
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <BellRing className="h-3.5 w-3.5 text-amber-600" />
              {t.morningAlerts}
              {alerts.length > 0 && (
                <span className="rounded-full bg-slate-900 px-1.5 py-0.2 text-[10px] text-white">
                  {alerts.length}
                </span>
              )}
            </button>

            {/* Printable Guide Button */}
            <button
              type="button"
              onClick={() => setPrintableOpen(true)}
              className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
            >
              <Printer className="h-3.5 w-3.5 text-slate-600" />
              {t.printableGuide}
            </button>

            {/* Gemini Key Button */}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50"
            >
              <KeyRound className="h-3.5 w-3.5 text-sky-600" />
              {apiKey || serverGeminiConfigured ? t.geminiConnected : t.connectGemini}
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main id="main-content" className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 print:hidden">
        {/* Triggered Morning Alert Banner */}
        {triggeredAlerts.length > 0 && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950 shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <BellRing className="h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <strong>{triggeredAlerts[0].subscription.label} Triggered:</strong>{' '}
                {triggeredAlerts[0].reasons.join(' • ')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAlertsOpen(true)}
              className="rounded-lg bg-amber-900 px-3 py-1 text-[11px] font-semibold text-white hover:bg-amber-800"
            >
              Manage Alerts
            </button>
          </div>
        )}

        <AirQualityHero
          airQuality={airQuality}
          presets={presets}
          loading={loadingAir}
          onSelectLocation={selectLocation}
          t={t}
        />

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Sidebar: Profile Customizer */}
          <div className="lg:col-span-4 xl:col-span-3">
            <LifestyleForm
              profile={profile}
              outdoorPm25={airQuality?.current.pm25 ?? 50}
              savedProfiles={savedProfiles}
              onLoadProfile={handleLoadSavedProfile}
              onSaveProfileAs={handleSaveProfileAs}
              onDeleteSavedProfile={(id) =>
                setSavedProfiles((prev) => prev.filter((p) => p.id !== id))
              }
              onChange={setProfile}
              onGenerate={() => airQuality && void runPlan(airQuality, profile)}
              generating={generatingPlan}
              t={t}
            />
          </div>

          {/* Right Main Column */}
          <div className="space-y-6 lg:col-span-8 xl:col-span-9">
            {plan && (
              <>
                {/* Situation Brief */}
                <section className="rounded-2xl border border-sky-200/80 bg-white p-5 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-800">
                      <Sparkles className="h-4 w-4 text-sky-600" />
                      {t.tailoredBrief}
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
                  infiltrationRatio={plan.infiltrationRatio}
                  exposureCalibratedBySensor={plan.exposureCalibratedBySensor}
                  adoptedActions={adoptedActions}
                  householdSize={profile.householdSize}
                  onOpenPrintableGuide={() => setPrintableOpen(true)}
                  t={t}
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
                      {t.allChoices} ({plan.recommendations.length})
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
                      {t.lowEmissionRoutines}
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
                      {t.indoorAirHacks}
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
                      {t.sustainableAlts}
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

            {/* Shareable Neighborhood & School Pledges */}
            <CommunityPledgesSection
              pledges={pledges}
              currentCity={airQuality?.locationName ?? 'Lahore'}
              highlightedPledgeId={highlightedPledgeId}
              joinedPledgeIds={joinedPledgeIds}
              onJoin={handleJoinPledge}
              onCreate={handleCreatePledge}
              t={t}
            />

            {/* Interactive GenAI Chat */}
            <AdvisorChat
              airQuality={airQuality}
              profile={profile}
              adoptedTitles={adoptedActions.map((a) => a.title)}
              apiKey={apiKey}
              language={language}
              t={t}
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

      <AlertsModal
        open={alertsOpen}
        airQuality={airQuality}
        alerts={alerts}
        onCreate={handleCreateAlert}
        onDelete={handleDeleteAlert}
        onClose={() => setAlertsOpen(false)}
      />

      <PrintableGuideModal
        open={printableOpen}
        airQuality={airQuality}
        adoptedActions={adoptedActions}
        onClose={() => setPrintableOpen(false)}
      />
    </div>
  );
}
