export type AqiCategory =
  | 'Good'
  | 'Moderate'
  | 'Unhealthy for Sensitive Groups'
  | 'Unhealthy'
  | 'Very Unhealthy'
  | 'Hazardous';

export type InversionRisk = 'low' | 'moderate' | 'high' | 'severe';

export type SupportedLanguage = 'en' | 'ur' | 'hi' | 'pl' | 'es';

export interface HourlyAirPoint {
  time: string;
  hourLabel: string;
  usAqi: number;
  pm25: number;
  windSpeedKmh: number;
  temperatureC: number;
  windowQuality: 'safe' | 'caution' | 'avoid';
}

export interface VentilationWindow {
  startHour: string;
  endHour: string;
  avgAqi: number;
  avgPm25: number;
  reason: string;
}

export interface GroundStationReading {
  id: string;
  name: string;
  provider: 'sensor-community' | 'openaq' | 'purpleair';
  distanceKm: number;
  pm25: number;
  pm10?: number;
  observedAt: string;
}

export interface AirQualitySnapshot {
  locationName: string;
  region?: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    usAqi: number;
    pm25: number;
    pm10: number;
    no2: number;
    o3: number;
    co: number;
    temperatureC: number;
    humidityPct: number;
    windSpeedKmh: number;
    inversionRisk: InversionRisk;
    inversionReason: string;
    aqiCategory: AqiCategory;
    observedAt: string;
    source: 'open-meteo' | 'preset-fallback';
  };
  groundStations: GroundStationReading[];
  hourly: HourlyAirPoint[];
  bestVentilationWindow: VentilationWindow | null;
}

export type SensitivityGroup =
  | 'infants_toddlers'
  | 'elderly'
  | 'asthma_respiratory'
  | 'pregnant'
  | 'outdoor_workers'
  | 'pets';

export type HousingType =
  | 'apartment'
  | 'single_family_house'
  | 'older_drafty_home'
  | 'community_center_school';

export type HeatingSource =
  | 'electric_heat_pump'
  | 'natural_gas'
  | 'wood_pellet_stove'
  | 'coal_biomass'
  | 'district_heating';

export type CookingFuel = 'induction_electric' | 'natural_gas' | 'lpg_wood';

export type CommuteMode =
  | 'gas_car'
  | 'ev_hybrid'
  | 'public_transit'
  | 'walk_bike'
  | 'remote_flexible';

export interface LifestyleProfile {
  mode: 'family' | 'community';
  householdSize: number;
  sensitivities: SensitivityGroup[];
  housingType: HousingType;
  heatingSource: HeatingSource;
  cookingFuel: CookingFuel;
  commuteMode: CommuteMode;
  dailyCarKm: number;
  hasAirPurifier: boolean;
  measuredIndoorPm25?: number | null;
  localChallenges: string;
}

export interface SavedHouseholdProfile {
  id: string;
  name: string;
  profile: LifestyleProfile;
  adoptedIds: string[];
  updatedAt: string;
}

export type ActionCategory = 'daily_routine' | 'indoor_iaq' | 'sustainable_alt';
export type EffortLevel = 'quick_win' | 'habit_shift' | 'upgrade';

export interface DirectImpact {
  exposureReductionPct: number;
  pm25AvoidedUgDay: number;
  co2eAvoidedKgDay: number;
  noxPmEmissionsAvoidedGDay: number;
  explanation: string;
  communityMultiplierNote: string;
}

export interface ActionRecommendation {
  id: string;
  category: ActionCategory;
  title: string;
  summary: string;
  tailoredWhy: string;
  steps: string[];
  effort: EffortLevel;
  costEstimate: string;
  directImpact: DirectImpact;
}

export interface ActionPlanResponse {
  engine: 'gemini-live' | 'local-advisor';
  modelName: string;
  generatedAt: string;
  situationBrief: string;
  alertLevel: 'normal' | 'elevated' | 'severe' | 'emergency';
  baselineDailyExposureUg: number;
  infiltrationRatio: number;
  exposureCalibratedBySensor: boolean;
  recommendations: ActionRecommendation[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface CitySearchResult {
  id: string;
  name: string;
  admin1?: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

export interface PresetCity {
  id: string;
  label: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  note: string;
}

export interface SmogAlertSubscription {
  id: string;
  label: string;
  locationName: string;
  latitude: number;
  longitude: number;
  aqiThreshold: number;
  alertOnInversion: boolean;
  morningTime: string;
  channel: 'browser' | 'email_digest';
  contact?: string;
  enabled: boolean;
  createdAt: string;
}

export interface AlertEvaluationResult {
  subscription: SmogAlertSubscription;
  triggered: boolean;
  reasons: string[];
  currentAqi: number;
  inversionRisk: InversionRisk;
}

export type PledgeCategory =
  | 'no_idling_school'
  | 'merv13_coop'
  | 'zero_burning'
  | 'clean_air_refuge';

export interface CommunityPledge {
  id: string;
  category: PledgeCategory;
  title: string;
  description: string;
  city: string;
  organizer: string;
  targetHouseholds: number;
  joinedHouseholds: number;
  co2eSavedKgPerHouseholdDay: number;
  noxPmSavedGPerHouseholdDay: number;
  createdAt: string;
}
