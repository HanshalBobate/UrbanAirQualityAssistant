import type {
  ActionPlanResponse,
  AirQualitySnapshot,
  ChatMessage,
  CitySearchResult,
  LifestyleProfile,
  PresetCity,
} from '@shared/types';

export async function fetchHealth(): Promise<{
  ok: boolean;
  geminiConfigured: boolean;
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
    }),
  });
  if (!res.ok) throw new Error('Chat request failed');
  return res.json();
}
