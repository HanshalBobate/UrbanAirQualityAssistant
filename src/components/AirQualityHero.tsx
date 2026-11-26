import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  CloudFog,
  MapPin,
  Search,
  Thermometer,
  Wind,
} from 'lucide-react';
import type { AirQualitySnapshot, CitySearchResult, PresetCity } from '@shared/types';
import { searchCities } from '../api';

interface AirQualityHeroProps {
  airQuality: AirQualitySnapshot | null;
  presets: PresetCity[];
  loading: boolean;
  onSelectLocation: (loc: {
    latitude: number;
    longitude: number;
    name: string;
    country: string;
    region?: string;
    timezone?: string;
  }) => void;
}

function getAqiColors(aqi: number) {
  if (aqi <= 50)
    return {
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      ring: 'ring-emerald-500/30 bg-emerald-600 text-white',
      bar: 'bg-emerald-500',
    };
  if (aqi <= 100)
    return {
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      ring: 'ring-amber-500/30 bg-amber-500 text-white',
      bar: 'bg-amber-400',
    };
  if (aqi <= 150)
    return {
      badge: 'bg-orange-100 text-orange-800 border-orange-200',
      ring: 'ring-orange-500/30 bg-orange-500 text-white',
      bar: 'bg-orange-500',
    };
  if (aqi <= 200)
    return {
      badge: 'bg-rose-100 text-rose-800 border-rose-200',
      ring: 'ring-rose-500/30 bg-rose-600 text-white',
      bar: 'bg-rose-500',
    };
  if (aqi <= 300)
    return {
      badge: 'bg-purple-100 text-purple-900 border-purple-200',
      ring: 'ring-purple-500/30 bg-purple-700 text-white',
      bar: 'bg-purple-600',
    };
  return {
    badge: 'bg-red-950 text-red-100 border-red-800',
    ring: 'ring-red-900/40 bg-red-900 text-white',
    bar: 'bg-red-800',
  };
}

export function AirQualityHero({
  airQuality,
  presets,
  loading,
  onSelectLocation,
}: AirQualityHeroProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CitySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const hits = await searchCities(trimmed);
        setResults(hits);
        setDropdownOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  const current = airQuality?.current;
  const colors = getAqiColors(current?.usAqi ?? 100);
  const maxHourlyAqi = Math.max(
    180,
    ...(airQuality?.hourly.map((h) => h.usAqi) ?? [180])
  );

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      {/* Location Search & Presets */}
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setDropdownOpen(true)}
              placeholder="Search any city or neighborhood (e.g., Lahore, Denver, Warsaw)..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20"
            />
            {searching && (
              <span className="absolute right-3 text-xs text-slate-400">Searching...</span>
            )}
          </div>

          {dropdownOpen && results.length > 0 && (
            <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              {results.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => {
                    onSelectLocation({
                      latitude: city.latitude,
                      longitude: city.longitude,
                      name: city.name,
                      country: city.country,
                      region: city.admin1,
                      timezone: city.timezone,
                    });
                    setQuery(`${city.name}, ${city.country}`);
                    setDropdownOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-3.5 py-2 text-left text-sm hover:bg-sky-50"
                >
                  <span className="font-medium text-slate-800">
                    {city.name}
                    {city.admin1 ? `, ${city.admin1}` : ''}
                  </span>
                  <span className="text-xs text-slate-500">{city.country}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-slate-500">Winter Smog Hotspots:</span>
          {presets.map((p) => {
            const active = airQuality?.locationName === p.name;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setQuery('');
                  setDropdownOpen(false);
                  onSelectLocation({
                    latitude: p.latitude,
                    longitude: p.longitude,
                    name: p.name,
                    country: p.country,
                    timezone: p.timezone,
                  });
                }}
                title={p.note}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  active
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Snapshot Grid */}
      {loading || !airQuality || !current ? (
        <div className="flex h-44 items-center justify-center text-sm text-slate-500">
          Loading live air quality & thermal inversion telemetry...
        </div>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-12">
          {/* Left: AQI & Key Pollutants */}
          <div className="flex flex-col justify-between gap-4 lg:col-span-5">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-22 w-22 shrink-0 flex-col items-center justify-center rounded-2xl ring-4 ${colors.ring}`}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider opacity-90">
                  US AQI
                </span>
                <span className="text-3xl font-extrabold leading-none">{current.usAqi}</span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="flex items-center gap-1.5 text-lg font-bold text-slate-900">
                    <MapPin className="h-4 w-4 text-sky-600" />
                    {airQuality.locationName}, {airQuality.country}
                  </h2>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colors.badge}`}
                  >
                    {current.aqiCategory}
                  </span>
                </div>

                <div className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <span className="block text-slate-500">PM2.5</span>
                    <span className="font-bold text-slate-900">{current.pm25} µg/m³</span>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <span className="block text-slate-500">PM10</span>
                    <span className="font-bold text-slate-900">{current.pm10} µg/m³</span>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <span className="block text-slate-500">NO₂</span>
                    <span className="font-bold text-slate-900">{current.no2} µg/m³</span>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <Thermometer className="h-3.5 w-3.5 text-slate-400" />
                    {current.temperatureC}°C ({current.humidityPct}% RH)
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Wind className="h-3.5 w-3.5 text-slate-400" />
                    {current.windSpeedKmh} km/h wind
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Source: {current.source === 'open-meteo' ? 'Open-Meteo Live' : 'Offline Profile'}
                  </span>
                </div>
              </div>
            </div>

            {/* Thermal Inversion & Best Window Callouts */}
            <div className="space-y-2.5">
              <div
                className={`rounded-xl border px-3.5 py-2.5 text-xs ${
                  current.inversionRisk === 'severe' || current.inversionRisk === 'high'
                    ? 'border-amber-200 bg-amber-50/80 text-amber-950'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  <CloudFog className="h-4 w-4 text-amber-600" />
                  <span>
                    Thermal Inversion Risk:{' '}
                    <span className="uppercase">{current.inversionRisk}</span>
                  </span>
                </div>
                <p className="mt-1 leading-relaxed opacity-90">{current.inversionReason}</p>
              </div>

              {airQuality.bestVentilationWindow && (
                <div className="rounded-xl border border-sky-200 bg-sky-50/75 px-3.5 py-2.5 text-xs text-sky-950">
                  <div className="flex items-center gap-1.5 font-semibold text-sky-900">
                    <Clock className="h-4 w-4 text-sky-600" />
                    <span>
                      Cleanest 3h Window: {airQuality.bestVentilationWindow.startHour} –{' '}
                      {airQuality.bestVentilationWindow.endHour} (Avg AQI{' '}
                      {airQuality.bestVentilationWindow.avgAqi})
                    </span>
                  </div>
                  <p className="mt-1 leading-relaxed text-sky-900/90">
                    {airQuality.bestVentilationWindow.reason}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: 24-Hour Smog & Inversion Timeline */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-4 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  24-Hour Smog & Boundary-Layer Timeline
                </h3>
                <p className="text-xs text-slate-500">
                  Plan outdoor errands & brief ventilation during lower-AQI afternoon mixing dips.
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-medium text-slate-600">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" /> Safer (&le;100)
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-xs bg-amber-400" /> Caution (101–150)
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-xs bg-rose-500" /> Avoid (&gt;150)
                </span>
              </div>
            </div>

            <div className="mt-4 flex h-36 items-end gap-1 pt-4">
              {airQuality.hourly.slice(0, 24).map((pt, i) => {
                const heightPct = Math.max(10, Math.round((pt.usAqi / maxHourlyAqi) * 100));
                const barColor =
                  pt.windowQuality === 'safe'
                    ? 'bg-emerald-500 hover:bg-emerald-600'
                    : pt.windowQuality === 'caution'
                    ? 'bg-amber-400 hover:bg-amber-500'
                    : 'bg-rose-500 hover:bg-rose-600';
                return (
                  <div
                    key={pt.time + i}
                    className="group relative flex h-full flex-1 flex-col items-center justify-end"
                  >
                    <div className="pointer-events-none absolute -top-7 z-10 hidden whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-white shadow group-hover:block">
                      {pt.hourLabel}: AQI {pt.usAqi} ({pt.pm25} µg/m³)
                    </div>
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-sm transition-all ${barColor}`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-1.5 flex justify-between text-[10px] font-medium text-slate-400">
              {airQuality.hourly
                .slice(0, 24)
                .filter((_, idx) => idx % 4 === 0)
                .map((pt) => (
                  <span key={pt.time}>{pt.hourLabel}</span>
                ))}
            </div>

            {current.usAqi >= 151 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>
                  Severe smog episode: Keep bedroom windows sealed and run MERV-13/HEPA filtration
                  continuously.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
