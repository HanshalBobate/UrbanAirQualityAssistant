import type {
  ActionPlanResponse,
  AirQualitySnapshot,
  AlertEvaluationResult,
  ChatMessage,
  CitySearchResult,
  CommunityPledge,
  LifestyleProfile,
  PledgeCategory,
  PresetCity,
  SmogAlertSubscription,
  SupportedLanguage,
} from '@shared/types';

export async function fetchHealth(): Promise<{
  ok: boolean;
  geminiConfigured: boolean;
  openAqConfigured: boolean;
  purpleAirConfigured: boolean;
  model: string;
}> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchPresetCities(): Promise<PresetCity[]> {
  const res = await fetch('/api/presets');
  if (!res.ok) throw new Error('Failed to load presets');
  const data = (await res.json()) as { presets: PresetCity[] };
  return data.presets;
}

export async function searchCities(query: string): Promise<CitySearchResult[]> {
  const res = await fetch(`/api/locations/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Location search failed');
  const data = (await res.json()) as { results: CitySearchResult[] };
  return data.results;
}

export async function fetchAirQuality(params: {
  latitude: number;
  longitude: number;
  name: string;
  country: string;
  region?: string;
  timezone?: string;
}): Promise<AirQualitySnapshot> {
  const url = new URL('/api/air-quality', window.location.origin);
  url.searchParams.set('lat', String(params.latitude));
  url.searchParams.set('lon', String(params.longitude));
  url.searchParams.set('name', params.name);
  url.searchParams.set('country', params.country);
  if (params.region) url.searchParams.set('region', params.region);
  if (params.timezone) url.searchParams.set('timezone', params.timezone);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to fetch air quality');
  return res.json();
}

export async function fetchActionPlan(params: {
  airQuality: AirQualitySnapshot;
  profile: LifestyleProfile;
  apiKey?: string;
  language?: SupportedLanguage;
}): Promise<ActionPlanResponse> {
  const res = await fetch('/api/recommendations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(params.apiKey ? { 'x-gemini-api-key': params.apiKey } : {}),
    },
    body: JSON.stringify({
      airQuality: params.airQuality,
      profile: params.profile,
      language: params.language ?? 'en',
    }),
  });
  if (!res.ok) throw new Error('Failed to generate recommendations');
  return res.json();
}

export async function sendAdvisorChat(params: {
  question: string;
  airQuality: AirQualitySnapshot;
  profile: LifestyleProfile;
  adoptedTitles: string[];
  history: ChatMessage[];
  apiKey?: string;
  language?: SupportedLanguage;
}): Promise<{ reply: string; engine: 'gemini-live' | 'local-advisor' }> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(params.apiKey ? { 'x-gemini-api-key': params.apiKey } : {}),
    },
    body: JSON.stringify({
      question: params.question,
      airQuality: params.airQuality,
      profile: params.profile,
      adoptedTitles: params.adoptedTitles,
      history: params.history,
      language: params.language ?? 'en',
    }),
  });
  if (!res.ok) throw new Error('Chat request failed');
  return res.json();
}

export async function fetchAlerts(): Promise<SmogAlertSubscription[]> {
  const res = await fetch('/api/alerts');
  if (!res.ok) throw new Error('Failed to load alerts');
  const data = (await res.json()) as { alerts: SmogAlertSubscription[] };
  return data.alerts;
}

export async function saveAlertSubscription(
  sub: Omit<SmogAlertSubscription, 'id' | 'createdAt'> & { id?: string }
): Promise<SmogAlertSubscription> {
  const res = await fetch('/api/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub),
  });
  if (!res.ok) throw new Error('Failed to save alert');
  const data = (await res.json()) as { alert: SmogAlertSubscription };
  return data.alert;
}

export async function deleteAlertSubscription(id: string): Promise<void> {
  const res = await fetch(`/api/alerts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete alert');
}

export async function evaluateAlertSubscriptions(
  airQuality: AirQualitySnapshot
): Promise<AlertEvaluationResult[]> {
  const res = await fetch('/api/alerts/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ airQuality }),
  });
  if (!res.ok) throw new Error('Failed to evaluate alerts');
  const data = (await res.json()) as { evaluations: AlertEvaluationResult[] };
  return data.evaluations;
}

export async function fetchPledges(): Promise<CommunityPledge[]> {
  const res = await fetch('/api/pledges');
  if (!res.ok) throw new Error('Failed to load pledges');
  const data = (await res.json()) as { pledges: CommunityPledge[] };
  return data.pledges;
}

export async function createCommunityPledge(input: {
  category: PledgeCategory;
  title: string;
  description: string;
  city: string;
  organizer: string;
  targetHouseholds?: number;
}): Promise<CommunityPledge> {
  const res = await fetch('/api/pledges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to create pledge');
  const data = (await res.json()) as { pledge: CommunityPledge };
  return data.pledge;
}

export async function joinCommunityPledge(id: string): Promise<CommunityPledge> {
  const res = await fetch(`/api/pledges/${encodeURIComponent(id)}/join`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to join pledge');
  const data = (await res.json()) as { pledge: CommunityPledge };
  return data.pledge;
}
