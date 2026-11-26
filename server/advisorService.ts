import { GoogleGenAI, Type } from '@google/genai';
import type {
  ActionPlanResponse,
  ActionRecommendation,
  AirQualitySnapshot,
  ChatMessage,
  LifestyleProfile,
  SupportedLanguage,
} from '../shared/types.js';
import {
  computeBlendedGroundPm25,
  computeCalibratedBaselineExposure,
} from '../shared/impactMath.js';

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const MODEL_CANDIDATES = Array.from(
  new Set([DEFAULT_MODEL, 'gemini-3.8-flash', 'gemini-2.5-flash'])
);

async function generateWithFallbackModels<T>(
  runner: (model: string) => Promise<T>
): Promise<{ result: T; modelUsed: string }> {
  let lastError: unknown;
  for (const model of MODEL_CANDIDATES) {
    try {
      const result = await runner(model);
      return { result, modelUsed: model };
    } catch (err) {
      lastError = err;
      const msg = (err as Error)?.message ?? String(err);
      if (msg.includes('NOT_FOUND') || msg.includes('404') || msg.includes('no longer available')) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  ur: 'Urdu (اردو)',
  hi: 'Hindi (हिन्दी)',
  pl: 'Polish (Polski)',
  es: 'Spanish (Español)',
};

const BRIEF_TEMPLATES: Record<SupportedLanguage, string> = {
  en: '',
  ur: 'اردو خلاصہ: ',
  hi: 'हिन्दी सारांश: ',
  pl: 'Podsumowanie (PL): ',
  es: 'Resumen (ES): ',
};

function getAlertLevel(usAqi: number): ActionPlanResponse['alertLevel'] {
  if (usAqi >= 250) return 'emergency';
  if (usAqi >= 151) return 'severe';
  if (usAqi >= 101) return 'elevated';
  return 'normal';
}

function formatSensitivities(profile: LifestyleProfile): string {
  const labels: Record<string, string> = {
    infants_toddlers: 'infants/toddlers',
    elderly: 'older adults',
    asthma_respiratory: 'asthma/respiratory sensitivities',
    pregnant: 'pregnant household members',
    outdoor_workers: 'outdoor workers',
    pets: 'indoor pets',
  };
  if (!profile.sensitivities.length) return 'general healthy household';
  return profile.sensitivities.map((s) => labels[s] ?? s).join(', ');
}

function clampImpact(
  rec: ActionRecommendation,
  baselineExposureUg: number
): ActionRecommendation {
  const exposureReductionPct = Math.min(
    80,
    Math.max(0, Math.round(rec.directImpact.exposureReductionPct))
  );
  const computedUg = Math.round((baselineExposureUg * exposureReductionPct) / 100);
  const pm25AvoidedUgDay =
    rec.directImpact.pm25AvoidedUgDay > 0
      ? Math.min(baselineExposureUg, Math.round(rec.directImpact.pm25AvoidedUgDay))
      : computedUg;

  return {
    ...rec,
    directImpact: {
      ...rec.directImpact,
      exposureReductionPct,
      pm25AvoidedUgDay,
      co2eAvoidedKgDay: Math.max(0, Math.round(rec.directImpact.co2eAvoidedKgDay * 10) / 10),
      noxPmEmissionsAvoidedGDay: Math.max(
        0,
        Math.round(rec.directImpact.noxPmEmissionsAvoidedGDay * 10) / 10
      ),
    },
  };
}

export function buildLocalActionPlan(
  air: AirQualitySnapshot,
  profile: LifestyleProfile,
  language: SupportedLanguage = 'en'
): ActionPlanResponse {
  const { current, bestVentilationWindow, locationName, groundStations } = air;
  const blended = computeBlendedGroundPm25(current.pm25, groundStations ?? []);
  const effectiveOutdoorPm25 = blended.blendedPm25;

  const baselineInfo = computeCalibratedBaselineExposure(
    effectiveOutdoorPm25,
    profile.housingType,
    profile.hasAirPurifier,
    profile.measuredIndoorPm25
  );
  const baselineExposureUg = baselineInfo.baselineDailyExposureUg;
  const alertLevel = getAlertLevel(current.usAqi);
  const sensitivityText = formatSensitivities(profile);
  const isSevere = current.usAqi >= 151;
  const windowLabel = bestVentilationWindow
    ? `${bestVentilationWindow.startHour}–${bestVentilationWindow.endHour} (avg AQI ${bestVentilationWindow.avgAqi})`
    : '1:00 PM–4:00 PM afternoon break';

  const recs: ActionRecommendation[] = [];

  // 1. Daily Routine: Timing & Inversion Avoidance
  recs.push({
    id: 'routine-window-shift',
    category: 'daily_routine',
    title: isSevere
      ? `Shift Errands & Movement to ${bestVentilationWindow?.startHour ?? '2 PM'}–${bestVentilationWindow?.endHour ?? '4 PM'}`
      : `Time Outdoor Walks Around the ${windowLabel} Window`,
    summary: isSevere
      ? `Avoid morning and post-sunset cold traps in ${locationName}; move unavoidable errands to the afternoon mixing window and move exercise indoors.`
      : `Schedule outdoor play, dog walks, or errands during the afternoon dispersal dip when boundary-layer mixing lowers street-level PM2.5.`,
    tailoredWhy: `${locationName} sits at AQI ${current.usAqi} (effective outdoor PM2.5 ${effectiveOutdoorPm25} µg/m³${
      blended.stationCount > 0 ? ` blended with ${blended.stationCount} local ground sensors` : ''
    }) with ${current.inversionRisk} thermal inversion risk (${current.windSpeedKmh} km/h wind, ${current.temperatureC}°C). Protecting ${sensitivityText} requires avoiding peak morning/evening stagnation.`,
    steps: [
      bestVentilationWindow
        ? `Target essential outdoor trips between ${bestVentilationWindow.startHour} and ${bestVentilationWindow.endHour}.`
        : 'Consolidate outdoor errands into midday hours when solar warming lifts the inversion layer.',
      isSevere
        ? 'Replace outdoor cardio or playground time with indoor stretching/play; wear a well-fitted N95/KF94 mask if stepping out.'
        : 'Keep vigorous outdoor exertion short during caution hours and monitor breathing comfort.',
      'Check hourly AQI before school drop-off or evening dog walks.',
    ],
    effort: 'quick_win',
    costEstimate: '$0',
    directImpact: {
      exposureReductionPct: isSevere ? 28 : 18,
      pm25AvoidedUgDay: Math.round(baselineExposureUg * (isSevere ? 0.28 : 0.18)),
      co2eAvoidedKgDay: 0.4,
      noxPmEmissionsAvoidedGDay: 0.5,
      explanation: `Avoiding peak inversion hours cuts your short-term outdoor PM2.5 spike by 35–50% because afternoon mixing dilutes ground-level smog, lowering daily inhaled dose by ~${Math.round(baselineExposureUg * (isSevere ? 0.28 : 0.18))} µg/person.`,
      communityMultiplierNote:
        'If 100 local families shift errands away from morning rush hours, street-canyon congestion and cold-start idle plumes drop noticeably around schools.',
    },
  });

  // 2. Daily Routine: Commute / Cold-Start Engine Swap
  const isGasCommuter = profile.commuteMode === 'gas_car';
  const carKm = Math.max(4, profile.dailyCarKm || 12);
  const savedCo2 = isGasCommuter ? Math.round(carKm * 0.21 * 10) / 10 : 0.8;
  const savedNoxPm = isGasCommuter ? Math.round(carKm * 0.38 * 10) / 10 : 1.1;

  recs.push({
    id: 'routine-commute-swap',
    category: 'daily_routine',
    title: isGasCommuter
      ? `Eliminate Cold-Start Car Trips (${carKm} km/day Carpool, Transit, or WFH)`
      : 'Batch Trips & Enforce a Zero-Idling Routine',
    summary: isGasCommuter
      ? `Cold winter engines emit up to 4x more PM and NOx in the first 3 km. Swap 3+ weekly solo drives for transit, carpooling, or remote work on high-AQI days.`
      : `Keep trip-chaining active so engines stay warm and never idle while waiting at school gates or storefronts.`,
    tailoredWhy: `With ${current.no2} µg/m³ NO₂ and ${current.inversionRisk} inversion risk in ${locationName}, tailpipe exhaust lingers at breathing height for children and commuters.`,
    steps: [
      isGasCommuter
        ? 'Trigger a work-from-home or transit day whenever morning AQI exceeds 150.'
        : 'Combine grocery, pharmacy, and school runs into one continuous loop.',
      'Turn off the ignition if stopped for more than 10 seconds — modern starters use less fuel than 10 seconds of idling.',
      'Walk or cycle only on low-traffic side streets away from arterial diesel buses.',
    ],
    effort: 'habit_shift',
    costEstimate: isGasCommuter ? 'Saves ~$35–70/mo in fuel' : '$0',
    directImpact: {
      exposureReductionPct: isGasCommuter ? 14 : 8,
      pm25AvoidedUgDay: Math.round(baselineExposureUg * (isGasCommuter ? 0.14 : 0.08)),
      co2eAvoidedKgDay: savedCo2,
      noxPmEmissionsAvoidedGDay: savedNoxPm,
      explanation: `Skipping or consolidating a ${carKm} km winter drive avoids ~${savedCo2} kg CO₂e and ~${savedNoxPm} g of NOₓ + exhaust/brake PM2.5 right inside the stagnant street layer, while cutting in-cabin traffic exposure.`,
      communityMultiplierNote: `Across 100 households, cutting daily solo winter driving removes ~${Math.round(savedCo2 * 100)} kg CO₂e/day and ~${Math.round(savedNoxPm * 100)} g/day of street-level NOₓ/PM.`,
    },
  });

  // 3. Daily Routine: Sensitivity & Mask Protocol
  recs.push({
    id: 'routine-sensitivity-shield',
    category: 'daily_routine',
    title:
      profile.mode === 'community'
        ? 'Activate Clean-Air Alert Protocol for Vulnerable Members'
        : `Protect Sensitive Lungs (${sensitivityText}) Outdoors`,
    summary:
      profile.mode === 'community'
        ? 'Distribute morning AQI alerts and move community gatherings or youth sports indoors whenever AQI > 150.'
        : 'Keep fitted N95/KF94 respirators by the door and run a 2-minute nasal saline / jacket-off routine after returning home.',
    tailoredWhy: `Tailored for ${sensitivityText}: fine PM2.5 (${effectiveOutdoorPm25} µg/m³) penetrates deep into alveoli and worsens airway inflammation during cold winter air.`,
    steps: [
      'Stage N95/KN95/KF94 masks (child-sized if applicable) in coat pockets and school backpacks.',
      'Switch car climate control to Recirculate mode during traffic delays to reduce cabin PM2.5 by ~60%.',
      'Leave outdoor coats/shoes in the entryway and wash hands/face upon returning inside.',
    ],
    effort: 'quick_win',
    costEstimate: '~$1–2 per reusable respirator',
    directImpact: {
      exposureReductionPct: isSevere ? 24 : 15,
      pm25AvoidedUgDay: Math.round(baselineExposureUg * (isSevere ? 0.24 : 0.15)),
      co2eAvoidedKgDay: 0,
      noxPmEmissionsAvoidedGDay: 0,
      explanation: `A well-sealed N95/KF94 filters >94% of PM2.5 during outdoor transit, and cabin recirculation prevents traffic-tunnel spikes—cutting total 24-hour inhaled dose by ~${Math.round(baselineExposureUg * (isSevere ? 0.24 : 0.15))} µg.`,
      communityMultiplierNote:
        'School and neighborhood mask-lending baskets ensure outdoor workers and families without spare masks stay protected during sudden smog spikes.',
    },
  });

  // 4. Indoor IAQ Hack: Filtration / Corsi-Rosenthal Box
  const needsPurifier = !profile.hasAirPurifier;
  recs.push({
    id: 'iaq-filtration-box',
    category: 'indoor_iaq',
    title: needsPurifier
      ? 'Build a $50 DIY Corsi-Rosenthal MERV-13 Air Purifier'
      : 'Create a Positive-Pressure Clean-Air Sleeping Sanctuary',
    summary: needsPurifier
      ? 'Tape four 20×20" MERV-13 furnace filters to a 20" box fan with a cardboard shroud to rival a $300 HEPA purifier.'
      : 'Concentrate your existing purifier in the main bedroom overnight on Medium-High with the door closed to guarantee 8+ hours of clean lung recovery.',
    tailoredWhy: baselineInfo.calibratedBySensor
      ? `Your indoor sensor shows ${profile.measuredIndoorPm25} µg/m³ (I/O infiltration ratio ${baselineInfo.infiltrationRatio}), proving outdoor smog is entering indoors—active filtration directly slashes this sleeping dose.`
      : `In ${profile.housingType.replace(/_/g, ' ')} housing during AQI ${current.usAqi}, outdoor PM2.5 infiltrates indoors at ~${Math.round(baselineInfo.infiltrationRatio * 100)}% of street levels without dedicated filtration.`,
    steps: needsPurifier
      ? [
          'Source four MERV-13 (or F7/ePM1) pleated filters and one 20-inch box fan + duct tape.',
          'Build a 4-filter cube with a cardboard base and a 2-inch inner cardboard shroud on the fan face.',
          'Run continuously in the main bedroom/living area at Medium speed for quiet, high-CADR filtration.',
        ]
      : [
          'Move your purifier 30 cm away from walls in the bedroom used by sensitive members.',
          'Run on High for 45 minutes before bedtime, then Medium overnight (avoid Auto mode if its optical sensor lags).',
          'Vacuum the outer pre-filter weekly so airflow stays high.',
        ],
    effort: needsPurifier ? 'upgrade' : 'quick_win',
    costEstimate: needsPurifier ? '~$50–65 DIY (filters last 6 mos)' : '~$0.10/day electricity',
    directImpact: {
      exposureReductionPct: needsPurifier ? 58 : 42,
      pm25AvoidedUgDay: Math.round(baselineExposureUg * (needsPurifier ? 0.58 : 0.42)),
      co2eAvoidedKgDay: 0,
      noxPmEmissionsAvoidedGDay: 0,
      explanation: `Continuous MERV-13 or HEPA filtration delivers 4–6 air changes per hour in a sealed bedroom, cutting indoor PM2.5 by ~60–75% and sparing each person ~${Math.round(baselineExposureUg * (needsPurifier ? 0.58 : 0.42))} µg/day of fine particulates.`,
      communityMultiplierNote:
        'Community groups can bulk-order 40-packs of MERV-13 filters and host 1-hour weekend build workshops for classrooms and seniors.',
    },
  });

  // 5. Indoor IAQ Hack: Seal Drafts & Micro-Ventilation
  recs.push({
    id: 'iaq-seal-and-vent',
    category: 'indoor_iaq',
    title: 'Weatherstrip Drafty Sashes & Run Damp-Dust Protocol',
    summary:
      'Seal winter window leaks with removable foam tape/door sweeps and wet-mop floors so settled indoor soot never gets kicked back into the air.',
    tailoredWhy: `${profile.housingType === 'older_drafty_home' ? 'Older/drafty buildings leak up to 72% of outdoor smog indoors' : 'Winter pressure differences pull cold smoggy air through window and door gaps'} (current I/O ratio: ${baselineInfo.infiltrationRatio}).`,
    steps: [
      'Press removable V-strip or foam weatherstripping along leaky bedroom window sashes and place a rolled towel/door sweep under exterior doors.',
      bestVentilationWindow && bestVentilationWindow.avgAqi <= 125
        ? `Only crack opposite windows for 10 minutes between ${bestVentilationWindow.startHour}–${bestVentilationWindow.endHour} to flush CO₂.`
        : 'Keep windows closed during AQI > 150; crack a single window briefly only if CO₂ feels stuffy while running filtration.',
      'Damp-mop and wipe sills with a wet microfiber cloth instead of dry sweeping or non-HEPA vacuuming.',
    ],
    effort: 'quick_win',
    costEstimate: '~$8–15 weatherstripping',
    directImpact: {
      exposureReductionPct: profile.housingType === 'older_drafty_home' ? 26 : 16,
      pm25AvoidedUgDay: Math.round(
        baselineExposureUg * (profile.housingType === 'older_drafty_home' ? 0.26 : 0.16)
      ),
      co2eAvoidedKgDay: 1.4,
      noxPmEmissionsAvoidedGDay: 0.4,
      explanation: `Cutting uncontrolled outdoor air leakage reduces indoor PM2.5 infiltration by ~20–30% AND lowers winter heating demand (saving ~1.4 kg CO₂e/day).`,
      communityMultiplierNote:
        'A neighborhood weatherization kit-share helps renters and elderly households seal drafty apartments before cold snaps hit.',
    },
  });

  // 6. Indoor IAQ Hack: Clean Cooking & Zero Indoor Combustion
  const hasGasOrWoodCook = profile.cookingFuel !== 'induction_electric';
  recs.push({
    id: 'iaq-clean-cooking',
    category: 'indoor_iaq',
    title: hasGasOrWoodCook
      ? 'Eliminate Kitchen PM2.5 & NO₂ Spikes (Hood + Lid + Electric Kettle)'
      : 'Keep Indoor Air Zero-Combustion (No Candles, Incense, or Smoke)',
    summary: hasGasOrWoodCook
      ? 'Gas/LPG cooking in sealed winter homes can spike indoor NO₂ above outdoor smog levels. Use back burners, vent hood on high, lids, and electric appliances.'
      : 'Prevent secondary indoor particulate spikes from scented candles, incense, mosquito coils, or unvented space heaters.',
    tailoredWhy: `With outdoor NO₂ at ${current.no2} µg/m³ and windows kept shut for winter smog, any indoor combustion builds up rapidly inside closed rooms.`,
    steps: [
      hasGasOrWoodCook
        ? 'Turn on your ducted range hood 5 minutes before lighting the stove and leave it on 15 minutes after.'
        : 'Use electric kettles, pressure cookers, or air fryers to keep cooking temperatures below oil smoke points.',
      hasGasOrWoodCook
        ? 'Boil water in an electric kettle and simmer stews in a slow cooker/rice cooker instead of open gas flames.'
        : 'Swap paraffin candles and incense for LED warm lights or simmering citrus peel in water.',
      'Cook on back burners with tight lids to capture steam and ultrafine cooking aerosols.',
    ],
    effort: 'quick_win',
    costEstimate: '$0 (or ~$25 portable induction hotplate)',
    directImpact: {
      exposureReductionPct: hasGasOrWoodCook ? 22 : 12,
      pm25AvoidedUgDay: Math.round(baselineExposureUg * (hasGasOrWoodCook ? 0.22 : 0.12)),
      co2eAvoidedKgDay: hasGasOrWoodCook ? 0.9 : 0.2,
      noxPmEmissionsAvoidedGDay: hasGasOrWoodCook ? 2.4 : 0.3,
      explanation: `Using lids, back burners, and electric kettles slashes indoor cooking NO₂ and ultrafine PM2.5 peaks by up to 65%, keeping sealed winter indoor air breathable.`,
      communityMultiplierNote:
        'Lending $50 portable single-burner induction cooktops through a local library lets families test clean electric cooking without kitchen remodeling.',
    },
  });

  // 7. Sustainable Alternative: Heating / Clean Energy Shift
  const isSolidFuelHeat =
    profile.heatingSource === 'wood_pellet_stove' || profile.heatingSource === 'coal_biomass';
  recs.push({
    id: 'sustain-clean-heating',
    category: 'sustainable_alt',
    title: isSolidFuelHeat
      ? 'Replace Smog-Day Wood/Coal Fires with Electric Heat or Zoned Heating'
      : 'Lower Winter Thermostat 1.5°C & Zone-Heat Occupied Rooms',
    summary: isSolidFuelHeat
      ? 'Residential wood and coal smoke are top contributors to winter PM2.5 inversions. Pause fireplace/stove burning on orange/red AQI days and heat only occupied rooms electrically.'
      : 'Trim wasted fossil heating load during peak inversion nights using thermal curtains and zoned electric throws.',
    tailoredWhy: isSolidFuelHeat
      ? `One wood-burning fireplace emits as much PM2.5 in an evening as dozens of cars, directly feeding ${locationName}'s stagnant inversion layer.`
      : `Reducing residential combustion heating lowers regional winter NOₓ and primary particulate formation across ${locationName}.`,
    steps: [
      isSolidFuelHeat
        ? 'Adopt a strict "No-Burn on AQI > 100" pledge; use an efficient oil-filled electric radiator or heat pump in the occupied living room.'
        : 'Set thermostat to 19°C (66°F) during the day and 17°C overnight; close thermal curtains at dusk.',
      isSolidFuelHeat
        ? 'When burning is unavoidable, burn only dry (<20% moisture) seasoned wood—never trash, painted wood, or damp logs.'
        : 'Bleed radiators / clean heat-pump filters to maintain peak winter efficiency.',
      'Explore utility rebates for cold-climate heat pumps or community clean-heating grants.',
    ],
    effort: 'habit_shift',
    costEstimate: isSolidFuelHeat ? '~$1–3/day electric offset' : 'Saves ~$18–35/mo',
    directImpact: {
      exposureReductionPct: isSolidFuelHeat ? 30 : 6,
      pm25AvoidedUgDay: Math.round(baselineExposureUg * (isSolidFuelHeat ? 0.3 : 0.06)),
      co2eAvoidedKgDay: isSolidFuelHeat ? 8.5 : 2.8,
      noxPmEmissionsAvoidedGDay: isSolidFuelHeat ? 42.0 : 1.9,
      explanation: isSolidFuelHeat
        ? 'Pausing a single residential wood/coal fire prevents ~42 g/day of direct smoke PM2.5 + NOₓ from saturating your own home and neighboring yards.'
        : 'Dropping space-heating fuel burn by ~12% saves ~2.8 kg CO₂e/day and reduces neighborhood combustion NOₓ during calm inversion nights.',
      communityMultiplierNote: isSolidFuelHeat
        ? 'If just 100 homes pause wood/coal burning on severe smog days, the neighborhood avoids >4.2 kg of raw smoke PM2.5 every single day.'
        : 'If 100 homes trim night heating waste together, local gas/district peak demand drops ~280 kg CO₂e/day.',
    },
  });

  // 8. Sustainable Alternative: Zero-Burn Waste & Local Advocacy
  recs.push({
    id: 'sustain-zero-burn-community',
    category: 'sustainable_alt',
    title:
      profile.mode === 'community'
        ? 'Launch a Neighborhood "Zero-Burn & School-Gate Clean Air" Pledge'
        : 'Compost/Mulch Yard Waste & Report Open Trash Burning',
    summary:
      profile.mode === 'community'
        ? 'Organize shared green-waste collection, anti-idling signs at school pickup lanes, and a community clean-air room.'
        : 'Never burn leaves or household waste in winter; mulch or compost locally and support municipal clean-air hotlines.',
    tailoredWhy: `Open biomass/leaf burning creates dense plumes of carcinogenic PAHs and PM2.5 that stay pinned below the ${locationName} inversion lid${profile.localChallenges ? ` (addressing: ${profile.localChallenges})` : ''}.`,
    steps: [
      'Bag or compost winter leaves and garden trimmings into mulch instead of burning piles.',
      profile.mode === 'community'
        ? 'Coordinate with local schools or community halls to set up a MERV-13 filtered "Clean Air Refuge Room" during AQI > 200 episodes.'
        : 'Share your town/city open-burning reporting link on your neighborhood chat group.',
      'Pool grocery/hardware deliveries with neighbors once a week to cut local delivery-van traffic.',
    ],
    effort: 'habit_shift',
    costEstimate: '$0',
    directImpact: {
      exposureReductionPct: 10,
      pm25AvoidedUgDay: Math.round(baselineExposureUg * 0.1),
      co2eAvoidedKgDay: 1.8,
      noxPmEmissionsAvoidedGDay: 16.5,
      explanation:
        'Eliminating even a small weekly yard/trash burn or consolidating local deliveries prevents concentrated bursts of primary PM2.5 and black carbon.',
      communityMultiplierNote:
        '100 participating households prevent ~1.65 kg/day of open-smoke particulates and build visible clean-air norms around schools and clinics.',
    },
  });

  // 9. Sustainable Alternative: Shared Clean Mobility / Filter Co-op
  recs.push({
    id: 'sustain-shared-mobility-coop',
    category: 'sustainable_alt',
    title:
      profile.mode === 'community'
        ? 'Coordinate a Bulk MERV-13 Filter Co-op & Walking-Bus Carpool'
        : 'Join a School/Work Carpool & Support Clean Transit Corridors',
    summary:
      profile.mode === 'community'
        ? 'Cut per-family clean-air costs by 40% via wholesale MERV-13 filter buys while rotating EV/low-emission carpools.'
        : 'Pair up with one neighboring family for school/work commutes and shift recurring errands to electric micro-mobility or transit.',
    tailoredWhy: `Pooling resources turns individual winter coping into durable emissions reduction for ${locationName}.`,
    steps: [
      'Match with 1–2 nearby households on the same school or transit route to halve peak-hour vehicle trips.',
      'Order MERV-13 replacement filters in multi-packs with neighbors to keep indoor protection affordable all winter.',
      'Share daily AQI dispersion windows so everyone schedules errands together during cleaner afternoon hours.',
    ],
    effort: 'upgrade',
    costEstimate: 'Saves 25–40% on commute & filters',
    directImpact: {
      exposureReductionPct: 9,
      pm25AvoidedUgDay: Math.round(baselineExposureUg * 0.09),
      co2eAvoidedKgDay: 2.2,
      noxPmEmissionsAvoidedGDay: 3.1,
      explanation:
        'Halving one household commute via shared rides cuts tailpipe + brake-wear emissions in half and funds affordable indoor filtration through shared savings.',
      communityMultiplierNote:
        'At 100 households, a shared carpool and filter co-op eliminates ~220 kg CO₂e/day and equips dozens of bedrooms with clean air.',
    },
  });

  const prefix = BRIEF_TEMPLATES[language] ?? '';
  const situationBrief = `${prefix}${locationName} is experiencing ${current.aqiCategory} air quality (US AQI ${current.usAqi}, outdoor PM2.5 ${effectiveOutdoorPm25} µg/m³${
    blended.stationCount > 0 ? ` across ${blended.stationCount} nearby ground sensors` : ''
  }) with ${current.inversionRisk} thermal inversion risk. ${current.inversionReason} ${
    baselineInfo.calibratedBySensor
      ? `Calibrated to your indoor sensor (${profile.measuredIndoorPm25} µg/m³, I/O ratio ${baselineInfo.infiltrationRatio}). `
      : ''
  }${
    bestVentilationWindow
      ? `Your cleanest 3-hour window today is ${bestVentilationWindow.startHour}–${bestVentilationWindow.endHour} (avg AQI ${bestVentilationWindow.avgAqi}).`
      : ''
  } Below are tailored routines, indoor air quality hacks, and sustainable alternatives for your ${
    profile.mode === 'community' ? 'community group' : 'family'
  } (${sensitivityText}).`;

  return {
    engine: 'local-advisor',
    modelName: 'ClearAir Local Rule & Exposure Engine',
    generatedAt: new Date().toISOString(),
    situationBrief,
    alertLevel,
    baselineDailyExposureUg: baselineExposureUg,
    infiltrationRatio: baselineInfo.infiltrationRatio,
    exposureCalibratedBySensor: baselineInfo.calibratedBySensor,
    recommendations: recs.map((r) => clampImpact(r, baselineExposureUg)),
  };
}

const RECOMMENDATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    situationBrief: {
      type: Type.STRING,
      description:
        'Concise 2-4 sentence summary of the local winter smog, thermal inversion risk, ventilation window, and what matters most for this household/community.',
    },
    recommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          category: {
            type: Type.STRING,
            enum: ['daily_routine', 'indoor_iaq', 'sustainable_alt'],
          },
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          tailoredWhy: { type: Type.STRING },
          steps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          effort: {
            type: Type.STRING,
            enum: ['quick_win', 'habit_shift', 'upgrade'],
          },
          costEstimate: { type: Type.STRING },
          directImpact: {
            type: Type.OBJECT,
            properties: {
              exposureReductionPct: { type: Type.NUMBER },
              pm25AvoidedUgDay: { type: Type.NUMBER },
              co2eAvoidedKgDay: { type: Type.NUMBER },
              noxPmEmissionsAvoidedGDay: { type: Type.NUMBER },
              explanation: { type: Type.STRING },
              communityMultiplierNote: { type: Type.STRING },
            },
            required: [
              'exposureReductionPct',
              'pm25AvoidedUgDay',
              'co2eAvoidedKgDay',
              'noxPmEmissionsAvoidedGDay',
              'explanation',
              'communityMultiplierNote',
            ],
          },
        },
        required: [
          'id',
          'category',
          'title',
          'summary',
          'tailoredWhy',
          'steps',
          'effort',
          'costEstimate',
          'directImpact',
        ],
      },
    },
  },
  required: ['situationBrief', 'recommendations'],
};

export async function generateActionPlan(
  air: AirQualitySnapshot,
  profile: LifestyleProfile,
  apiKeyOverride?: string,
  language: SupportedLanguage = 'en'
): Promise<ActionPlanResponse> {
  const apiKey = (apiKeyOverride || process.env.GEMINI_API_KEY || '').trim();
  const blended = computeBlendedGroundPm25(air.current.pm25, air.groundStations ?? []);
  const baselineInfo = computeCalibratedBaselineExposure(
    blended.blendedPm25,
    profile.housingType,
    profile.hasAirPurifier,
    profile.measuredIndoorPm25
  );
  const baselineExposureUg = baselineInfo.baselineDailyExposureUg;

  if (!apiKey) {
    return buildLocalActionPlan(air, profile, language);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const targetLang = LANGUAGE_NAMES[language] ?? 'English';
    const prompt = `You are ClearAir AI, an environmental health & sustainable living advisor helping families and communities navigate severe winter smog and urban air pollution.

OUTPUT LANGUAGE: Write ALL user-facing text fields (situationBrief, title, summary, tailoredWhy, steps, costEstimate, explanation, communityMultiplierNote) naturally in ${targetLang}. Keep JSON keys and enum values ("daily_routine", "indoor_iaq", "sustainable_alt", "quick_win", "habit_shift", "upgrade") strictly in English.

LOCATION & LIVE AIR QUALITY:
- City: ${air.locationName}, ${air.country} (Lat ${air.latitude.toFixed(2)}, Lon ${air.longitude.toFixed(2)})
- US AQI: ${air.current.usAqi} (${air.current.aqiCategory})
- Modeled PM2.5: ${air.current.pm25} µg/m³ | Ground-blended PM2.5: ${blended.blendedPm25} µg/m³ (${blended.stationCount} nearby sensors)
- PM10: ${air.current.pm10} µg/m³, NO2: ${air.current.no2} µg/m³, O3: ${air.current.o3} µg/m³
- Weather: ${air.current.temperatureC}°C, ${air.current.humidityPct}% humidity, ${air.current.windSpeedKmh} km/h wind
- Thermal Inversion Risk: ${air.current.inversionRisk} (${air.current.inversionReason})
- Best 3-hour window in next 24h: ${
      air.bestVentilationWindow
        ? `${air.bestVentilationWindow.startHour}–${air.bestVentilationWindow.endHour} (avg AQI ${air.bestVentilationWindow.avgAqi})`
        : 'Unavailable'
    }
- Baseline daily inhaled PM2.5 estimate: ${baselineExposureUg} µg/person/day (I/O ratio: ${baselineInfo.infiltrationRatio}, sensor-calibrated: ${baselineInfo.calibratedBySensor}${
      baselineInfo.calibratedBySensor ? `, measured indoor PM2.5: ${profile.measuredIndoorPm25} µg/m³` : ''
    })

HOUSEHOLD / COMMUNITY PROFILE:
- Mode: ${profile.mode} (${profile.householdSize} ${profile.mode === 'community' ? 'households' : 'people'})
- Sensitive groups: ${formatSensitivities(profile)}
- Housing type: ${profile.housingType} (already has air purifier: ${profile.hasAirPurifier})
- Heating source: ${profile.heatingSource}, Cooking fuel: ${profile.cookingFuel}
- Commute: ${profile.commuteMode}, daily car distance: ${profile.dailyCarKm} km
- Local challenges: ${profile.localChallenges || 'None specified'}

TASK:
Generate exactly 9 tailored, practical, scientifically accurate recommendations:
- 3 with category "daily_routine" (low-emission daily routines & exposure timing)
- 3 with category "indoor_iaq" (practical indoor air quality hacks, filtration, sealing, clean cooking)
- 3 with category "sustainable_alt" (sustainable alternatives & community-scale emission cuts)

REQUIREMENTS:
- Reference the exact city, AQI/PM2.5, inversion risk, best hourly window, indoor sensor calibration if present, and user's specific housing/heating/cooking/commute/sensitivities.
- Keep numerical directImpact realistic:
  - exposureReductionPct between 5 and 70 per action
  - pm25AvoidedUgDay proportional to baseline ${baselineExposureUg} µg/day
  - co2eAvoidedKgDay realistic (0 to 12 kg/day)
  - noxPmEmissionsAvoidedGDay realistic (0 to 50 g/day)
- In directImpact.explanation, clearly explain the physical/health mechanism and numbers in plain language.
- In directImpact.communityMultiplierNote, explain the collective impact if 100 local households adopt the action.`;

    const { result: response, modelUsed } = await generateWithFallbackModels((model) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: RECOMMENDATION_SCHEMA,
          temperature: 0.4,
        },
      })
    );

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    const parsed = JSON.parse(text) as {
      situationBrief: string;
      recommendations: ActionRecommendation[];
    };

    if (!Array.isArray(parsed.recommendations) || parsed.recommendations.length === 0) {
      throw new Error('Invalid recommendation array from Gemini');
    }

    return {
      engine: 'gemini-live',
      modelName: modelUsed,
      generatedAt: new Date().toISOString(),
      situationBrief: parsed.situationBrief,
      alertLevel: getAlertLevel(air.current.usAqi),
      baselineDailyExposureUg: baselineExposureUg,
      infiltrationRatio: baselineInfo.infiltrationRatio,
      exposureCalibratedBySensor: baselineInfo.calibratedBySensor,
      recommendations: parsed.recommendations.map((r, idx) =>
        clampImpact(
          {
            ...r,
            id: r.id || `gemini-rec-${idx + 1}`,
          },
          baselineExposureUg
        )
      ),
    };
  } catch (err) {
    console.warn('Gemini generation fell back to local advisor:', (err as Error).message);
    return buildLocalActionPlan(air, profile, language);
  }
}

export async function askAdvisorChat(params: {
  question: string;
  air: AirQualitySnapshot;
  profile: LifestyleProfile;
  adoptedTitles: string[];
  history: ChatMessage[];
  apiKeyOverride?: string;
  language?: SupportedLanguage;
}): Promise<{ reply: string; engine: 'gemini-live' | 'local-advisor' }> {
  const {
    question,
    air,
    profile,
    adoptedTitles,
    history,
    apiKeyOverride,
    language = 'en',
  } = params;
  const apiKey = (apiKeyOverride || process.env.GEMINI_API_KEY || '').trim();
  const targetLang = LANGUAGE_NAMES[language] ?? 'English';

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const recentHistory = history
        .slice(-6)
        .map((m) => `${m.role === 'user' ? 'User' : 'Advisor'}: ${m.content}`)
        .join('\n');

      const prompt = `You are ClearAir AI, a concise, empathetic, evidence-based air quality & sustainable living advisor.
Reply strictly in ${targetLang}.
Current Context:
- City: ${air.locationName}, ${air.country} | US AQI: ${air.current.usAqi} (${air.current.aqiCategory}) | PM2.5: ${air.current.pm25} µg/m³ | NO2: ${air.current.no2} µg/m³ | Ground sensors nearby: ${air.groundStations?.length ?? 0}
- Weather & Inversion: ${air.current.temperatureC}°C, ${air.current.windSpeedKmh} km/h wind, inversion risk: ${air.current.inversionRisk}
- Best 3h window: ${air.bestVentilationWindow ? `${air.bestVentilationWindow.startHour}-${air.bestVentilationWindow.endHour} (avg AQI ${air.bestVentilationWindow.avgAqi})` : 'N/A'}
- Household/Community: ${profile.mode}, sensitivities: ${formatSensitivities(profile)}, housing: ${profile.housingType}, measured indoor PM2.5: ${profile.measuredIndoorPm25 ?? 'not provided'}, heating: ${profile.heatingSource}, cooking: ${profile.cookingFuel}, commute: ${profile.commuteMode}, hasPurifier: ${profile.hasAirPurifier}
- Actions already adopted today: ${adoptedTitles.length ? adoptedTitles.join('; ') : 'None yet'}

Conversation so far:
${recentHistory || '(new conversation)'}

User Question: ${question}

Respond in clear, structured markdown (short paragraphs or 3-5 bullet points). Explicitly explain the direct health/exposure or emissions impact of any recommendation you give. Keep it practical and grounded.`;

      const { result } = await generateWithFallbackModels((model) =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: { temperature: 0.45 },
        })
      );

      if (result.text) {
        return { reply: result.text.trim(), engine: 'gemini-live' };
      }
    } catch (err) {
      console.warn('Gemini chat fell back to local advisor:', (err as Error).message);
    }
  }

  const q = question.toLowerCase();
  const win = air.bestVentilationWindow;
  const lines: string[] = [];

  if (q.includes('window') || q.includes('ventilat') || q.includes('open') || q.includes('walk') || q.includes('outside')) {
    lines.push(
      `In **${air.locationName}** right now (AQI **${air.current.usAqi}**, PM2.5 **${air.current.pm25} µg/m³**), inversion risk is **${air.current.inversionRisk}**.`
    );
    if (win && win.avgAqi <= 140) {
      lines.push(
        `- **Best timing:** Aim for **${win.startHour}–${win.endHour}** (projected avg AQI ${win.avgAqi}). Do a brisk 10–15 minute cross-ventilation only during that dip, then reseal.`
      );
    } else {
      lines.push(
        `- **Keep windows closed:** Pollution stays elevated across the next 24h (lowest window avg AQI ${win?.avgAqi ?? air.current.usAqi}). Rely on HEPA/MERV-13 filtration indoors rather than opening windows.`
      );
    }
    lines.push(
      `- **Direct impact:** Avoiding peak morning/evening stagnation cuts short-term inhaled PM2.5 by ~25–40%.`
    );
  } else if (q.includes('diy') || q.includes('corsi') || q.includes('purifier') || q.includes('filter') || q.includes('indoor')) {
    lines.push(
      `For your **${profile.housingType.replace(/_/g, ' ')}**${
        profile.measuredIndoorPm25 != null
          ? ` (measured indoor PM2.5: **${profile.measuredIndoorPm25} µg/m³**)`
          : ''
      }, a DIY **Corsi-Rosenthal Box** (~$50–65) is the highest-impact indoor upgrade:`
    );
    lines.push(
      `- **How to build:** Tape four 20×20" MERV-13 filters into a cube with a cardboard floor and a 20" box fan taped on top (add an inner cardboard shroud so air doesn't backflow at the corners).`
    );
    lines.push(
      `- **Direct impact:** Delivers ~4–6 air changes/hour in a standard bedroom, cutting indoor PM2.5 by **60–75%** within 45 minutes.`
    );
  } else if (q.includes('school') || q.includes('child') || q.includes('kid') || q.includes('asthma') || q.includes('mask') || q.includes('elder')) {
    lines.push(
      `For **${formatSensitivities(profile)}** at AQI **${air.current.usAqi}**:`
    );
    lines.push(
      `- **Outdoors:** ${air.current.usAqi >= 151 ? 'Move recess/sports indoors and use a snug child/adult KF94 or N95 mask during transit.' : 'Keep outdoor play moderate and avoid busy road intersections.'}`
    );
    lines.push(
      `- **In transit:** Switch car vents to **Recirculate** (cuts cabin traffic PM2.5 by ~60%) and avoid idling at pickup gates.`
    );
    lines.push(
      `- **Direct impact:** Combining clean-room sleeping filtration + masked commutes reduces 24-hour lung particulate dose by over half.`
    );
  } else {
    lines.push(
      `Here is tailored guidance for **${air.locationName}** (US AQI **${air.current.usAqi}**, PM2.5 **${air.current.pm25} µg/m³**, ${air.current.inversionRisk} inversion risk):`
    );
    lines.push(
      `- **Daily timing:** ${win ? `Best outdoor/errand window is **${win.startHour}–${win.endHour}** (avg AQI ${win.avgAqi}).` : 'Prefer mid-afternoon errands when mixing improves.'}`
    );
    lines.push(
      `- **Indoor air:** Keep combustion sources off inside (hood on high over ${profile.cookingFuel.replace(/_/g, ' ')} cooking) and run MERV-13/HEPA filtration in bedrooms.`
    );
    lines.push(
      `- **Direct impact:** ${adoptedTitles.length > 0 ? `Your ${adoptedTitles.length} adopted actions are already actively lowering exposure and emissions.` : 'Adopt 2–3 actions in the dashboard to see your exact µg/day PM2.5 and kg CO₂e reduction.'}`
    );
    lines.push(
      `\n*Tip: Add a free Gemini API key in Settings (top-right) for unrestricted live GenAI replies in ${targetLang}.*`
    );
  }

  return { reply: lines.join('\n'), engine: 'local-advisor' };
}
