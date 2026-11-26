import type {
  AirQualitySnapshot,
  CitySearchResult,
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
    id: 'lahore',
    label: 'Lahore, PK (Severe Winter Smog)',
    name: 'Lahore',
    country: 'Pakistan',
    latitude: 31.5497,
    longitude: 74.3436,
    timezone: 'Asia/Karachi',
    note: 'Frequent winter thermal inversions + crop & traffic particulates',
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
  lahore: { pm25: 168, pm10: 240, no2: 64, o3: 24, co: 1600, temp: 11, humidity: 78, wind: 4.1 },
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
    // Typical winter diurnal inversion curve: higher morning/late-night, lower 13:00-16:00
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
    hourly,
    bestVentilationWindow: findBestVentilationWindow(hourly),
  };
}

export async function searchLocations(query: string): Promise<CitySearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

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
      return data.results.map((r) => ({
        id: String(r.id),
        name: r.name,
        admin1: r.admin1,
        country: r.country ?? 'Unknown',
        latitude: r.latitude,
        longitude: r.longitude,
        timezone: r.timezone,
      }));
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

    const [aqRes, wxRes] = await Promise.all([
      fetch(aqUrl, { signal: AbortSignal.timeout(6000) }),
      fetch(wxUrl, { signal: AbortSignal.timeout(6000) }),
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

    return {
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
      hourly,
      bestVentilationWindow: findBestVentilationWindow(hourly),
    };
  } catch {
    return buildFallbackSnapshot(name, country, latitude, longitude, timezone, region);
  }
}
