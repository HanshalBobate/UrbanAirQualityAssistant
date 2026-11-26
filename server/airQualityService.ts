import type {
  AirQualitySnapshot,
  CitySearchResult,
  GroundStationReading,
  HourlyAirPoint,
  PresetCity,
} from '../shared/types.js';
import {
  assessInversionRisk,
  classifyUsAqi,
  findBestVentilationWindow,
  getWindowQuality,
  pm25ToUsAqi,
} from '../shared/impactMath.js';

export const PRESET_CITIES: PresetCity[] = [
  {
    id: 'nagpur',
    label: 'Nagpur, IN (Winter Haze & Urban Traffic)',
    name: 'Nagpur',
    country: 'India',
    latitude: 21.1458,
    longitude: 79.0882,
    timezone: 'Asia/Kolkata',
    note: 'Winter surface inversions + road dust, traffic, and biomass smoke',
  },
  {
    id: 'delhi',
    label: 'New Delhi, IN (Severe Winter Inversion)',
    name: 'New Delhi',
    country: 'India',
    latitude: 28.6139,
    longitude: 77.209,
    timezone: 'Asia/Kolkata',
    note: 'Cold stagnant nights trap vehicle, dust, and biomass emissions',
  },
  {
    id: 'slc',
    label: 'Salt Lake City, US (Valley Inversion)',
    name: 'Salt Lake City',
    country: 'United States',
    latitude: 40.7608,
    longitude: -111.891,
    timezone: 'America/Denver',
    note: 'Mountain-basin winter cold pools trap PM2.5 for days',
  },
  {
    id: 'krakow',
    label: 'Kraków, PL (Coal & Wood Heating Basin)',
    name: 'Kraków',
    country: 'Poland',
    latitude: 50.0647,
    longitude: 19.945,
    timezone: 'Europe/Warsaw',
    note: 'Valley topography + solid-fuel heating spikes during frost',
  },
  {
    id: 'beijing',
    label: 'Beijing, CN (Winter Haze Watch)',
    name: 'Beijing',
    country: 'China',
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 'Asia/Shanghai',
    note: 'Regional heating & calm winter anticyclones',
  },
  {
    id: 'london',
    label: 'London, UK (Urban NO2 & Woodsmoke)',
    name: 'London',
    country: 'United Kingdom',
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: 'Europe/London',
    note: 'Winter road corridors and residential wood-burning peaks',
  },
];

interface FallbackBaseline {
  pm25: number;
  pm10: number;
  no2: number;
  o3: number;
  co: number;
  temp: number;
  humidity: number;
  wind: number;
}

const FALLBACK_BASELINES: Record<string, FallbackBaseline> = {
  nagpur: { pm25: 84, pm10: 138, no2: 46, o3: 32, co: 1150, temp: 16, humidity: 62, wind: 4.8 },
  'new delhi': { pm25: 195, pm10: 295, no2: 72, o3: 28, co: 1850, temp: 12, humidity: 76, wind: 3.8 },
  'salt lake city': { pm25: 54, pm10: 78, no2: 46, o3: 32, co: 750, temp: -2, humidity: 79, wind: 4.5 },
  kraków: { pm25: 76, pm10: 108, no2: 49, o3: 26, co: 1100, temp: 1, humidity: 82, wind: 5.2 },
  beijing: { pm25: 88, pm10: 132, no2: 55, o3: 29, co: 1200, temp: -1, humidity: 64, wind: 5.8 },
  london: { pm25: 29, pm10: 44, no2: 52, o3: 34, co: 520, temp: 6, humidity: 81, wind: 9.4 },
};

function formatHourLabel(isoTime: string): string {
  const match = isoTime.match(/T(\d{2}):/);
  if (!match) return isoTime;
  const h = Number(match[1]);
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

/**
 * Fetches nearby physical ground-station PM2.5 sensors using:
 * 1) Sensor.Community (keyless public citizen-science network)
 * 2) OpenAQ v3 (when OPENAQ_API_KEY is configured)
 * 3) PurpleAir (when PURPLEAIR_API_KEY is configured)
 */
export async function fetchNearbyGroundStations(
  latitude: number,
  longitude: number
): Promise<GroundStationReading[]> {
  const stations: GroundStationReading[] = [];

  // 1. Sensor.Community keyless public area lookup (25 km radius)
  try {
    const scUrl = `https://data.sensor.community/airrohr/v1/filter/area=${latitude.toFixed(
      4
    )},${longitude.toFixed(4)},25`;
    const res = await fetch(scUrl, {
      headers: { 'User-Agent': 'ClearAirAI/1.0 (urban-air-quality-assistant)' },
      signal: AbortSignal.timeout(4500),
    });
    if (res.ok) {
      const items = (await res.json()) as Array<{
        id: number;
        timestamp: string;
        location?: { id: number; latitude?: string; longitude?: string; country?: string };
        sensordatavalues?: Array<{ value_type: string; value: string }>;
      }>;

      const seenLocations = new Set<number>();
      for (const item of items) {
        const locId = item.location?.id;
        if (!locId || seenLocations.has(locId)) continue;
        const p2 = item.sensordatavalues?.find((v) => v.value_type === 'P2');
        const p1 = item.sensordatavalues?.find((v) => v.value_type === 'P1');
        const pm25 = p2 ? Number(p2.value) : NaN;
        if (!Number.isFinite(pm25) || pm25 < 0 || pm25 > 1200) continue;

        const stLat = Number(item.location?.latitude ?? latitude);
        const stLon = Number(item.location?.longitude ?? longitude);
        seenLocations.add(locId);

        stations.push({
          id: `sc-${locId}`,
          name: `Sensor.Community #${locId}`,
          provider: 'sensor-community',
          distanceKm: haversineKm(latitude, longitude, stLat, stLon),
          pm25: Math.round(pm25 * 10) / 10,
          pm10: p1 && Number.isFinite(Number(p1.value)) ? Math.round(Number(p1.value) * 10) / 10 : undefined,
          observedAt: item.timestamp,
        });
        if (stations.length >= 6) break;
      }
    }
  } catch {
    // Graceful skip if Sensor.Community is unreachable or slow
  }

  // 2. OpenAQ v3 (if OPENAQ_API_KEY is configured)
  const openAqKey = (process.env.OPENAQ_API_KEY || '').trim();
  if (openAqKey) {
    try {
      const url = new URL('https://api.openaq.org/v3/locations');
      url.searchParams.set('coordinates', `${latitude.toFixed(4)},${longitude.toFixed(4)}`);
      url.searchParams.set('radius', '25000');
      url.searchParams.set('limit', '5');
      url.searchParams.set('parameters_id', '2'); // PM2.5
      const res = await fetch(url, {
        headers: { 'X-API-Key': openAqKey },
        signal: AbortSignal.timeout(4500),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          results?: Array<{
            id: number;
            name?: string;
            distance?: number;
            coordinates?: { latitude: number; longitude: number };
            datetimeLast?: { utc?: string };
            sensors?: Array<{
              parameter?: { name?: string };
              latest?: { value?: number };
            }>;
          }>;
        };
        for (const loc of data.results ?? []) {
          const pmSensor = loc.sensors?.find(
            (s) => s.parameter?.name?.toLowerCase() === 'pm25' && typeof s.latest?.value === 'number'
          );
          if (!pmSensor || typeof pmSensor.latest?.value !== 'number') continue;
          stations.push({
            id: `openaq-${loc.id}`,
            name: loc.name || `OpenAQ #${loc.id}`,
            provider: 'openaq',
            distanceKm: loc.distance
              ? Math.round((loc.distance / 1000) * 10) / 10
              : haversineKm(
                  latitude,
                  longitude,
                  loc.coordinates?.latitude ?? latitude,
                  loc.coordinates?.longitude ?? longitude
                ),
            pm25: Math.round(pmSensor.latest.value * 10) / 10,
            observedAt: loc.datetimeLast?.utc ?? new Date().toISOString(),
          });
        }
      }
    } catch {
      // Graceful skip
    }
  }

  // 3. PurpleAir (if PURPLEAIR_API_KEY is configured)
  const purpleAirKey = (process.env.PURPLEAIR_API_KEY || '').trim();
  if (purpleAirKey) {
    try {
      const delta = 0.22; // ~24 km bounding box
      const url = new URL('https://api.purpleair.com/v1/sensors');
      url.searchParams.set('fields', 'name,latitude,longitude,pm2.5_10minute,last_seen');
      url.searchParams.set('location_type', '0'); // outdoor
      url.searchParams.set('nwlat', String(latitude + delta));
      url.searchParams.set('nwlng', String(longitude - delta));
      url.searchParams.set('selat', String(latitude - delta));
      url.searchParams.set('selng', String(longitude + delta));

      const res = await fetch(url, {
        headers: { 'X-API-Key': purpleAirKey },
        signal: AbortSignal.timeout(4500),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          fields?: string[];
          data?: Array<Array<string | number>>;
        };
        for (const row of (data.data ?? []).slice(0, 5)) {
          const [sensorId, sensorName, stLat, stLon, pm25Val, lastSeen] = row;
          const pm25 = Number(pm25Val);
          if (!Number.isFinite(pm25)) continue;
          stations.push({
            id: `pa-${sensorId}`,
            name: String(sensorName || `PurpleAir #${sensorId}`),
            provider: 'purpleair',
            distanceKm: haversineKm(latitude, longitude, Number(stLat), Number(stLon)),
            pm25: Math.round(pm25 * 10) / 10,
            observedAt: lastSeen ? new Date(Number(lastSeen) * 1000).toISOString() : new Date().toISOString(),
          });
        }
      }
    } catch {
      // Graceful skip
    }
  }

  return stations.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 8);
}

export function buildFallbackSnapshot(
  name: string,
  country: string,
  latitude: number,
  longitude: number,
  timezone = 'UTC',
  region?: string
): AirQualitySnapshot {
  const key = name.toLowerCase();
  const base: FallbackBaseline = FALLBACK_BASELINES[key] ?? {
    pm25: 68,
    pm10: 102,
    no2: 48,
    o3: 30,
    co: 950,
    temp: 4,
    humidity: 76,
    wind: 5.5,
  };

  const now = new Date();
  const hourly: HourlyAirPoint[] = [];

  for (let offset = 0; offset < 24; offset++) {
    const dt = new Date(now.getTime() + offset * 3600 * 1000);
    const hour = dt.getHours();
    const afternoonBreak = hour >= 12 && hour <= 16 ? 0.62 : hour >= 20 || hour <= 8 ? 1.18 : 0.92;
    const pm25 = Math.round(base.pm25 * afternoonBreak * 10) / 10;
    const usAqi = pm25ToUsAqi(pm25);
    const windSpeedKmh = Math.round(base.wind * (hour >= 12 && hour <= 16 ? 1.7 : 0.85) * 10) / 10;
    const temperatureC = Math.round((base.temp + (hour >= 12 && hour <= 16 ? 5 : -1.5)) * 10) / 10;
    const iso = dt.toISOString().slice(0, 13) + ':00';

    hourly.push({
      time: iso,
      hourLabel: formatHourLabel(iso),
      usAqi,
      pm25,
      windSpeedKmh,
      temperatureC,
      windowQuality: getWindowQuality(usAqi),
    });
  }

  const currentUsAqi = pm25ToUsAqi(base.pm25);
  const inversion = assessInversionRisk(base.pm25, base.wind, base.temp, base.humidity);

  return {
    locationName: name,
    region,
    country,
    latitude,
    longitude,
    timezone,
    current: {
      usAqi: currentUsAqi,
      pm25: base.pm25,
      pm10: base.pm10,
      no2: base.no2,
      o3: base.o3,
      co: base.co,
      temperatureC: base.temp,
      humidityPct: base.humidity,
      windSpeedKmh: base.wind,
      inversionRisk: inversion.risk,
      inversionReason: inversion.reason,
      aqiCategory: classifyUsAqi(currentUsAqi),
      observedAt: now.toISOString(),
      source: 'preset-fallback',
    },
    groundStations: [],
    hourly,
    bestVentilationWindow: findBestVentilationWindow(hourly),
  };
}

const AIR_CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;

const airQualityCache = new Map<string, { expiresAt: number; value: AirQualitySnapshot }>();
const locationSearchCache = new Map<string, { expiresAt: number; value: CitySearchResult[] }>();

export async function searchLocations(query: string): Promise<CitySearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = trimmed.toLowerCase();
  const cached = locationSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name', trimmed);
    url.searchParams.set('count', '6');
    url.searchParams.set('language', 'en');
    url.searchParams.set('format', 'json');

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
    const data = (await res.json()) as {
      results?: Array<{
        id: number;
        name: string;
        admin1?: string;
        country?: string;
        latitude: number;
        longitude: number;
        timezone?: string;
      }>;
    };

    if (data.results && data.results.length > 0) {
      const mapped = data.results.map((r) => ({
        id: String(r.id),
        name: r.name,
        admin1: r.admin1,
        country: r.country ?? 'Unknown',
        latitude: r.latitude,
        longitude: r.longitude,
        timezone: r.timezone,
      }));
      locationSearchCache.set(cacheKey, {
        expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
        value: mapped,
      });
      return mapped;
    }
  } catch {
    // Fall back to local preset city matching when offline or blocked.
  }

  const lower = trimmed.toLowerCase();
  return PRESET_CITIES.filter(
    (c) =>
      c.name.toLowerCase().includes(lower) ||
      c.country.toLowerCase().includes(lower) ||
      c.label.toLowerCase().includes(lower)
  ).map((c) => ({
    id: c.id,
    name: c.name,
    country: c.country,
    latitude: c.latitude,
    longitude: c.longitude,
    timezone: c.timezone,
  }));
}

export async function fetchAirQualitySnapshot(params: {
  latitude: number;
  longitude: number;
  name: string;
  country: string;
  region?: string;
  timezone?: string;
}): Promise<AirQualitySnapshot> {
  const { latitude, longitude, name, country, region, timezone } = params;
  const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cached = airQualityCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.value,
      locationName: name,
      country,
      region,
    };
  }

  try {
    const aqUrl = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
    aqUrl.searchParams.set('latitude', String(latitude));
    aqUrl.searchParams.set('longitude', String(longitude));
    aqUrl.searchParams.set(
      'current',
      'us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,carbon_monoxide'
    );
    aqUrl.searchParams.set('hourly', 'pm2_5,us_aqi');
    aqUrl.searchParams.set('forecast_days', '2');
    aqUrl.searchParams.set('timezone', 'auto');

    const wxUrl = new URL('https://api.open-meteo.com/v1/forecast');
    wxUrl.searchParams.set('latitude', String(latitude));
    wxUrl.searchParams.set('longitude', String(longitude));
    wxUrl.searchParams.set('current', 'temperature_2m,relative_humidity_2m,wind_speed_10m');
    wxUrl.searchParams.set('hourly', 'temperature_2m,wind_speed_10m');
    wxUrl.searchParams.set('forecast_days', '2');
    wxUrl.searchParams.set('timezone', 'auto');

    const [aqRes, wxRes, groundStations] = await Promise.all([
      fetch(aqUrl, { signal: AbortSignal.timeout(6000) }),
      fetch(wxUrl, { signal: AbortSignal.timeout(6000) }),
      fetchNearbyGroundStations(latitude, longitude),
    ]);

    if (!aqRes.ok || !wxRes.ok) {
      throw new Error(`Open-Meteo HTTP error: aq=${aqRes.status} wx=${wxRes.status}`);
    }

    const aqData = (await aqRes.json()) as {
      timezone?: string;
      current?: {
        time?: string;
        us_aqi?: number;
        pm2_5?: number;
        pm10?: number;
        nitrogen_dioxide?: number;
        ozone?: number;
        carbon_monoxide?: number;
      };
      hourly?: {
        time: string[];
        pm2_5: Array<number | null>;
        us_aqi: Array<number | null>;
      };
    };

    const wxData = (await wxRes.json()) as {
      current?: {
        temperature_2m?: number;
        relative_humidity_2m?: number;
        wind_speed_10m?: number;
      };
      hourly?: {
        time: string[];
        temperature_2m: Array<number | null>;
        wind_speed_10m: Array<number | null>;
      };
    };

    const pm25 = Number(aqData.current?.pm2_5 ?? 0);
    const usAqi = Math.round(Number(aqData.current?.us_aqi ?? pm25ToUsAqi(pm25)));
    const pm10 = Number(aqData.current?.pm10 ?? pm25 * 1.4);
    const no2 = Number(aqData.current?.nitrogen_dioxide ?? 0);
    const o3 = Number(aqData.current?.ozone ?? 0);
    const co = Number(aqData.current?.carbon_monoxide ?? 0);

    const temperatureC = Number(wxData.current?.temperature_2m ?? 10);
    const humidityPct = Number(wxData.current?.relative_humidity_2m ?? 65);
    const windSpeedKmh = Number(wxData.current?.wind_speed_10m ?? 8);

    const times = aqData.hourly?.time ?? [];
    const currentTime = aqData.current?.time ?? times[0] ?? '';
    let startIdx = times.findIndex((t) => t >= currentTime);
    if (startIdx < 0) startIdx = 0;

    const hourly: HourlyAirPoint[] = [];
    for (let i = startIdx; i < Math.min(startIdx + 24, times.length); i++) {
      const hPm25 = Number(aqData.hourly?.pm2_5[i] ?? pm25);
      const hAqi = Math.round(Number(aqData.hourly?.us_aqi[i] ?? pm25ToUsAqi(hPm25)));
      const hWind = Number(wxData.hourly?.wind_speed_10m[i] ?? windSpeedKmh);
      const hTemp = Number(wxData.hourly?.temperature_2m[i] ?? temperatureC);
      hourly.push({
        time: times[i],
        hourLabel: formatHourLabel(times[i]),
        usAqi: hAqi,
        pm25: Math.round(hPm25 * 10) / 10,
        windSpeedKmh: Math.round(hWind * 10) / 10,
        temperatureC: Math.round(hTemp * 10) / 10,
        windowQuality: getWindowQuality(hAqi),
      });
    }

    const inversion = assessInversionRisk(pm25, windSpeedKmh, temperatureC, humidityPct);

    const snapshot: AirQualitySnapshot = {
      locationName: name,
      region,
      country,
      latitude,
      longitude,
      timezone: aqData.timezone ?? timezone ?? 'UTC',
      current: {
        usAqi,
        pm25: Math.round(pm25 * 10) / 10,
        pm10: Math.round(pm10 * 10) / 10,
        no2: Math.round(no2 * 10) / 10,
        o3: Math.round(o3 * 10) / 10,
        co: Math.round(co),
        temperatureC: Math.round(temperatureC * 10) / 10,
        humidityPct: Math.round(humidityPct),
        windSpeedKmh: Math.round(windSpeedKmh * 10) / 10,
        inversionRisk: inversion.risk,
        inversionReason: inversion.reason,
        aqiCategory: classifyUsAqi(usAqi),
        observedAt: currentTime || new Date().toISOString(),
        source: 'open-meteo',
      },
      groundStations,
      hourly,
      bestVentilationWindow: findBestVentilationWindow(hourly),
    };

    airQualityCache.set(cacheKey, {
      expiresAt: Date.now() + AIR_CACHE_TTL_MS,
      value: snapshot,
    });
    return snapshot;
  } catch {
    return buildFallbackSnapshot(name, country, latitude, longitude, timezone, region);
  }
}
