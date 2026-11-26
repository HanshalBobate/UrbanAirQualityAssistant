import type {
  ActionRecommendation,
  AqiCategory,
  HourlyAirPoint,
  HousingType,
  InversionRisk,
  VentilationWindow,
} from './types.js';

/**
 * Standard adult daily inhalation volume (~15 m3/day at mixed rest and light activity).
 */
export const DAILY_BREATHING_VOLUME_M3 = 15;

export function classifyUsAqi(aqi: number): AqiCategory {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

/**
 * Converts PM2.5 concentration (ug/m3) to US EPA AQI using standard breakpoints.
 */
export function pm25ToUsAqi(pm25: number): number {
  const c = Math.max(0, Math.floor(pm25 * 10) / 10);
  const breakpoints: Array<[number, number, number, number]> = [
    [0.0, 9.0, 0, 50],
    [9.1, 35.4, 51, 100],
    [35.5, 55.4, 101, 150],
    [55.5, 125.4, 151, 200],
    [125.5, 225.4, 201, 300],
    [225.5, 500.4, 301, 500],
  ];

  for (const [cLow, cHigh, iLow, iHigh] of breakpoints) {
    if (c <= cHigh) {
      return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (c - cLow) + iLow);
    }
  }
  return 500;
}

export function assessInversionRisk(
  pm25: number,
  windSpeedKmh: number,
  temperatureC: number,
  humidityPct: number
): { risk: InversionRisk; reason: string } {
  let score = 0;
  const factors: string[] = [];

  if (windSpeedKmh < 6) {
    score += 3;
    factors.push(`very calm winds (${windSpeedKmh.toFixed(1)} km/h)`);
  } else if (windSpeedKmh < 12) {
    score += 2;
    factors.push(`light winds (${windSpeedKmh.toFixed(1)} km/h)`);
  } else if (windSpeedKmh < 18) {
    score += 1;
  }

  if (temperatureC <= 5) {
    score += 2;
    factors.push(`cold surface air (${temperatureC.toFixed(1)}°C)`);
  } else if (temperatureC <= 12) {
    score += 1;
    factors.push(`cool air (${temperatureC.toFixed(1)}°C)`);
  }

  if (humidityPct >= 75) {
    score += 1;
    factors.push(`high humidity (${Math.round(humidityPct)}%) accelerating haze formation`);
  }

  if (pm25 >= 75) {
    score += 2;
  } else if (pm25 >= 35) {
    score += 1;
  }

  let risk: InversionRisk = 'low';
  if (score >= 6) risk = 'severe';
  else if (score >= 4) risk = 'high';
  else if (score >= 2) risk = 'moderate';

  const reason =
    factors.length > 0
      ? `Driven by ${factors.join(', ')}, pollutants stay trapped near street level instead of dispersing vertically.`
      : `Breezy conditions (${windSpeedKmh.toFixed(1)} km/h) are helping vertical mixing and pollutant dispersion.`;

  return { risk, reason };
}

export function getWindowQuality(usAqi: number): 'safe' | 'caution' | 'avoid' {
  if (usAqi <= 100) return 'safe';
  if (usAqi <= 150) return 'caution';
  return 'avoid';
}

export function findBestVentilationWindow(hourly: HourlyAirPoint[]): VentilationWindow | null {
  if (hourly.length < 3) return null;

  // Consider a 3-hour rolling window to avoid recommending a brief single-hour dip.
  let bestIdx = 0;
  let bestAvgAqi = Infinity;
  let bestAvgPm25 = Infinity;

  for (let i = 0; i <= hourly.length - 3; i++) {
    const slice = hourly.slice(i, i + 3);
    const avgAqi = slice.reduce((acc, p) => acc + p.usAqi, 0) / slice.length;
    if (avgAqi < bestAvgAqi) {
      bestAvgAqi = avgAqi;
      bestAvgPm25 = slice.reduce((acc, p) => acc + p.pm25, 0) / slice.length;
      bestIdx = i;
    }
  }

  const start = hourly[bestIdx];
  const end = hourly[bestIdx + 2];
  const roundedAqi = Math.round(bestAvgAqi);

  let reason = `Lowest 3-hour pollution dip in the next 24h (avg AQI ${roundedAqi}).`;
  if (roundedAqi > 150) {
    reason = `Pollution remains unhealthy all day (best window avg AQI ${roundedAqi}). Keep windows sealed and rely on indoor HEPA filtration instead of cross-ventilating.`;
  } else if (roundedAqi > 100) {
    reason = `Brief moderate-to-USG dip around ${start.hourLabel}–${end.hourLabel} (avg AQI ${roundedAqi}). Limit airing-out to 10–15 minutes with filtration on standby.`;
  } else {
    reason = `Optimal afternoon/mixing window around ${start.hourLabel}–${end.hourLabel} (avg AQI ${roundedAqi}) — ideal for quick cross-ventilation and essential errands.`;
  }

  return {
    startHour: start.hourLabel,
    endHour: end.hourLabel,
    avgAqi: roundedAqi,
    avgPm25: Math.round(bestAvgPm25 * 10) / 10,
    reason,
  };
}

export function computeBaselineDailyExposureUg(
  outdoorPm25: number,
  housingType: HousingType,
  hasAirPurifier: boolean
): number {
  const infiltrationByHousing: Record<HousingType, number> = {
    apartment: 0.48,
    single_family_house: 0.56,
    older_drafty_home: 0.72,
    community_center_school: 0.62,
  };

  // Weighted indoor (85% of winter day) + outdoor (15% of winter day) exposure
  const indoorFactor = infiltrationByHousing[housingType] ?? 0.56;
  const purifierFactor = hasAirPurifier ? 0.65 : 1.0;
  const effectiveConcentration =
    outdoorPm25 * (0.85 * indoorFactor * purifierFactor + 0.15);

  return Math.round(effectiveConcentration * DAILY_BREATHING_VOLUME_M3);
}

export interface AggregatedImpact {
  combinedExposureReductionPct: number;
  projectedDailyExposureUg: number;
  pm25AvoidedUgDay: number;
  co2eAvoidedKgDay: number;
  noxPmEmissionsAvoidedGDay: number;
  monthlyCo2eAvoidedKg: number;
  communityPm25AvoidedKgMonth: number;
  communityCo2eAvoidedTonsMonth: number;
}

/**
 * Combines adopted recommendations using diminishing-returns multiplication for exposure
 * reduction (so stacking 3 actions never claims an unrealistic >100% reduction) and
 * linear sums for prevented emissions, scaled across household/community adoption.
 */
export function combineAdoptedImpacts(
  baselineDailyExposureUg: number,
  adoptedActions: ActionRecommendation[],
  householdSize: number,
  communityHouseholds: number
): AggregatedImpact {
  let remainingExposureRatio = 1.0;
  let co2eAvoidedKgDay = 0;
  let noxPmEmissionsAvoidedGDay = 0;

  for (const action of adoptedActions) {
    const pct = Math.min(85, Math.max(0, action.directImpact.exposureReductionPct));
    remainingExposureRatio *= 1 - pct / 100;
    co2eAvoidedKgDay += Math.max(0, action.directImpact.co2eAvoidedKgDay);
    noxPmEmissionsAvoidedGDay += Math.max(0, action.directImpact.noxPmEmissionsAvoidedGDay);
  }

  const rawReductionPct = (1 - remainingExposureRatio) * 100;
  const combinedExposureReductionPct = Math.min(90, Math.round(rawReductionPct));
  const projectedDailyExposureUg = Math.round(
    baselineDailyExposureUg * (1 - combinedExposureReductionPct / 100)
  );
  const pm25AvoidedUgDay = Math.max(0, baselineDailyExposureUg - projectedDailyExposureUg);

  const safeHouseholds = Math.max(1, communityHouseholds);
  const safeHouseholdSize = Math.max(1, householdSize);

  const monthlyCo2eAvoidedKg = Math.round(co2eAvoidedKgDay * 30 * 10) / 10;
  // Community PM2.5+NOx emissions avoided in kg/month
  const communityPm25AvoidedKgMonth =
    Math.round(((noxPmEmissionsAvoidedGDay * 30 * safeHouseholds) / 1000) * 10) / 10;
  const communityCo2eAvoidedTonsMonth =
    Math.round(((co2eAvoidedKgDay * 30 * safeHouseholds) / 1000) * 100) / 100;

  // Incorporate household size only for per-household personal dose awareness in UI;
  // per-person baseline remains clear and normalized.
  void safeHouseholdSize;

  return {
    combinedExposureReductionPct,
    projectedDailyExposureUg,
    pm25AvoidedUgDay,
    co2eAvoidedKgDay: Math.round(co2eAvoidedKgDay * 10) / 10,
    noxPmEmissionsAvoidedGDay: Math.round(noxPmEmissionsAvoidedGDay * 10) / 10,
    monthlyCo2eAvoidedKg,
    communityPm25AvoidedKgMonth,
    communityCo2eAvoidedTonsMonth,
  };
}
