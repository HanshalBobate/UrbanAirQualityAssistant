import { describe, expect, it } from 'vitest';
import {
  assessInversionRisk,
  classifyUsAqi,
  combineAdoptedImpacts,
  computeBaselineDailyExposureUg,
  computeBlendedGroundPm25,
  computeCalibratedBaselineExposure,
  findBestVentilationWindow,
  pm25ToUsAqi,
} from '../shared/impactMath.js';
import type { ActionRecommendation, GroundStationReading, HourlyAirPoint } from '../shared/types.js';

describe('impactMath', () => {
  it('classifies US AQI categories accurately across breakpoints', () => {
    expect(classifyUsAqi(35)).toBe('Good');
    expect(classifyUsAqi(85)).toBe('Moderate');
    expect(classifyUsAqi(135)).toBe('Unhealthy for Sensitive Groups');
    expect(classifyUsAqi(180)).toBe('Unhealthy');
    expect(classifyUsAqi(260)).toBe('Very Unhealthy');
    expect(classifyUsAqi(350)).toBe('Hazardous');
  });

  it('converts PM2.5 to US AQI consistently', () => {
    expect(pm25ToUsAqi(9.0)).toBe(50);
    expect(pm25ToUsAqi(35.4)).toBe(100);
    expect(pm25ToUsAqi(150)).toBeGreaterThan(200);
  });

  it('detects severe winter thermal inversion risk when cold, calm, and high PM2.5', () => {
    const severe = assessInversionRisk(140, 3.5, 1.0, 82);
    expect(severe.risk).toBe('severe');
    expect(severe.reason).toContain('very calm winds');

    const low = assessInversionRisk(12, 22, 16, 45);
    expect(low.risk).toBe('low');
  });

  it('identifies the cleanest 3-hour rolling ventilation window', () => {
    const hourly: HourlyAirPoint[] = [
      { time: '2026-11-26T08:00', hourLabel: '8 AM', usAqi: 210, pm25: 135, windSpeedKmh: 3, temperatureC: 5, windowQuality: 'avoid' },
      { time: '2026-11-26T09:00', hourLabel: '9 AM', usAqi: 195, pm25: 120, windSpeedKmh: 4, temperatureC: 7, windowQuality: 'avoid' },
      { time: '2026-11-26T13:00', hourLabel: '1 PM', usAqi: 88, pm25: 30, windSpeedKmh: 12, temperatureC: 14, windowQuality: 'safe' },
      { time: '2026-11-26T14:00', hourLabel: '2 PM', usAqi: 80, pm25: 26, windSpeedKmh: 13, temperatureC: 15, windowQuality: 'safe' },
      { time: '2026-11-26T15:00', hourLabel: '3 PM', usAqi: 84, pm25: 28, windSpeedKmh: 12, temperatureC: 15, windowQuality: 'safe' },
      { time: '2026-11-26T20:00', hourLabel: '8 PM', usAqi: 185, pm25: 110, windSpeedKmh: 3, temperatureC: 6, windowQuality: 'avoid' },
    ];

    const best = findBestVentilationWindow(hourly);
    expect(best).not.toBeNull();
    expect(best?.startHour).toBe('1 PM');
    expect(best?.endHour).toBe('3 PM');
    expect(best?.avgAqi).toBe(84);
  });

  it('calibrates exposure baseline using real indoor PM2.5 monitor and blends nearby ground stations', () => {
    const calibrated = computeCalibratedBaselineExposure(100, 'older_drafty_home', false, 25);
    expect(calibrated.calibratedBySensor).toBe(true);
    expect(calibrated.infiltrationRatio).toBe(0.25);
    // (0.85 * 25 + 0.15 * 100) * 15 = 36.25 * 15 = 544
    expect(calibrated.baselineDailyExposureUg).toBe(544);

    const stations: GroundStationReading[] = [
      { id: 's1', name: 'Station A', provider: 'sensor-community', distanceKm: 1.5, pm25: 120, observedAt: '' },
      { id: 's2', name: 'Station B', provider: 'openaq', distanceKm: 6.0, pm25: 90, observedAt: '' },
    ];
    const blended = computeBlendedGroundPm25(80, stations);
    expect(blended.stationCount).toBe(2);
    expect(blended.blendedPm25).toBeGreaterThan(95);
    expect(blended.blendedPm25).toBeLessThan(120);
  });

  it('computes baseline exposure and stacks adopted actions with diminishing returns', () => {
    const draftyNoPurifier = computeBaselineDailyExposureUg(100, 'older_drafty_home', false);
    const apartmentWithPurifier = computeBaselineDailyExposureUg(100, 'apartment', true);
    expect(draftyNoPurifier).toBeGreaterThan(apartmentWithPurifier);

    const mockRecs: ActionRecommendation[] = [
      {
        id: '1',
        category: 'indoor_iaq',
        title: 'CR Box',
        summary: '',
        tailoredWhy: '',
        steps: [],
        effort: 'upgrade',
        costEstimate: '$50',
        directImpact: {
          exposureReductionPct: 58,
          pm25AvoidedUgDay: 500,
          co2eAvoidedKgDay: 0,
          noxPmEmissionsAvoidedGDay: 0,
          explanation: '',
          communityMultiplierNote: '',
        },
      },
      {
        id: '2',
        category: 'daily_routine',
        title: 'Shift Errands',
        summary: '',
        tailoredWhy: '',
        steps: [],
        effort: 'quick_win',
        costEstimate: '$0',
        directImpact: {
          exposureReductionPct: 28,
          pm25AvoidedUgDay: 250,
          co2eAvoidedKgDay: 2.5,
          noxPmEmissionsAvoidedGDay: 4.0,
          explanation: '',
          communityMultiplierNote: '',
        },
      },
      {
        id: '3',
        category: 'sustainable_alt',
        title: 'Pause Wood Burn',
        summary: '',
        tailoredWhy: '',
        steps: [],
        effort: 'habit_shift',
        costEstimate: '$2',
        directImpact: {
          exposureReductionPct: 30,
          pm25AvoidedUgDay: 280,
          co2eAvoidedKgDay: 8.5,
          noxPmEmissionsAvoidedGDay: 42.0,
          explanation: '',
          communityMultiplierNote: '',
        },
      },
    ];

    const combined = combineAdoptedImpacts(1000, mockRecs, 4, 100);
    expect(combined.combinedExposureReductionPct).toBe(79);
    expect(combined.projectedDailyExposureUg).toBe(210);
    expect(combined.pm25AvoidedUgDay).toBe(790);
    expect(combined.co2eAvoidedKgDay).toBe(11);
    expect(combined.noxPmEmissionsAvoidedGDay).toBe(46);
    expect(combined.communityPm25AvoidedKgMonth).toBeCloseTo(138, 1);
    expect(combined.communityCo2eAvoidedTonsMonth).toBeCloseTo(33, 1);
  });
});
