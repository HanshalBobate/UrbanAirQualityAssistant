import fs from 'node:fs';
import path from 'node:path';
import type {
  AlertEvaluationResult,
  AirQualitySnapshot,
  CommunityPledge,
  PledgeCategory,
  SmogAlertSubscription,
} from '../shared/types.js';

interface PersistedData {
  alerts: SmogAlertSubscription[];
  pledges: CommunityPledge[];
}

const DEFAULT_PLEDGES: CommunityPledge[] = [
  {
    id: 'pledge-school-no-idle',
    category: 'no_idling_school',
    title: 'No-Idling School Drop-Off Lane',
    description:
      'Parents and school buses turn off ignitions within 200 m of school gates during winter morning & afternoon pickup.',
    city: 'Lahore',
    organizer: 'Model Town Parent Clean-Air Circle',
    targetHouseholds: 150,
    joinedHouseholds: 64,
    co2eSavedKgPerHouseholdDay: 0.7,
    noxPmSavedGPerHouseholdDay: 3.2,
    createdAt: '2026-11-20T08:00:00.000Z',
  },
  {
    id: 'pledge-merv13-coop',
    category: 'merv13_coop',
    title: 'Neighborhood Bulk MERV-13 Filter Co-op',
    description:
      'Pool orders for 20×20" MERV-13 filters & box fans to build $50 Corsi-Rosenthal purifiers for classrooms and senior bedrooms.',
    city: 'Salt Lake City',
    organizer: 'West Valley Clean Air Co-op',
    targetHouseholds: 100,
    joinedHouseholds: 41,
    co2eSavedKgPerHouseholdDay: 0.2,
    noxPmSavedGPerHouseholdDay: 1.5,
    createdAt: '2026-11-21T10:30:00.000Z',
  },
  {
    id: 'pledge-zero-leaf-burn',
    category: 'zero_burning',
    title: 'Zero Leaf & Yard-Waste Burning Street Pledge',
    description:
      'Compost or mulch winter leaves and dry brush instead of open burning during stagnant thermal inversions.',
    city: 'Kraków',
    organizer: 'Nowa Huta Eco-Neighbors',
    targetHouseholds: 200,
    joinedHouseholds: 88,
    co2eSavedKgPerHouseholdDay: 1.8,
    noxPmSavedGPerHouseholdDay: 16.5,
    createdAt: '2026-11-22T12:00:00.000Z',
  },
  {
    id: 'pledge-clean-refuge-room',
    category: 'clean_air_refuge',
    title: 'Community Clean-Air Refuge Room (AQI > 200)',
    description:
      'Equip a local library or community hall room with dual HEPA/CR-Box units as a daytime sanctuary for seniors & infants.',
    city: 'New Delhi',
    organizer: 'South Block Residents Welfare Assoc.',
    targetHouseholds: 120,
    joinedHouseholds: 53,
    co2eSavedKgPerHouseholdDay: 0.5,
    noxPmSavedGPerHouseholdDay: 4.0,
    createdAt: '2026-11-23T09:15:00.000Z',
  },
];

export class LocalDataStore {
  private filePath: string;
  private data: PersistedData;

  constructor(filePath?: string) {
    this.filePath =
      filePath ?? path.resolve(process.cwd(), 'data', 'clearair-store.json');
    this.data = this.load();
  }

  private load(): PersistedData {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<PersistedData>;
        return {
          alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
          pledges:
            Array.isArray(parsed.pledges) && parsed.pledges.length > 0
              ? parsed.pledges
              : [...DEFAULT_PLEDGES],
        };
      }
    } catch {
      // Fall back to fresh default store if file is malformed
    }
    return {
      alerts: [],
      pledges: [...DEFAULT_PLEDGES],
    };
  }

  private save() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  listAlerts(): SmogAlertSubscription[] {
    return this.data.alerts;
  }

  upsertAlert(input: Omit<SmogAlertSubscription, 'id' | 'createdAt'> & { id?: string }): SmogAlertSubscription {
    const existingIdx = input.id
      ? this.data.alerts.findIndex((a) => a.id === input.id)
      : -1;

    const sub: SmogAlertSubscription = {
      id: input.id || `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: input.label.trim() || `${input.locationName} Morning Alert`,
      locationName: input.locationName,
      latitude: input.latitude,
      longitude: input.longitude,
      aqiThreshold: Math.min(400, Math.max(50, Math.round(input.aqiThreshold))),
      alertOnInversion: Boolean(input.alertOnInversion),
      morningTime: input.morningTime || '07:00',
      channel: input.channel || 'browser',
      contact: input.contact?.trim() || undefined,
      enabled: input.enabled ?? true,
      createdAt:
        existingIdx >= 0 ? this.data.alerts[existingIdx].createdAt : new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      this.data.alerts[existingIdx] = sub;
    } else {
      this.data.alerts.unshift(sub);
    }
    this.save();
    return sub;
  }

  deleteAlert(id: string): boolean {
    const before = this.data.alerts.length;
    this.data.alerts = this.data.alerts.filter((a) => a.id !== id);
    if (this.data.alerts.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  evaluateAlerts(snapshot: AirQualitySnapshot): AlertEvaluationResult[] {
    return this.data.alerts
      .filter((a) => a.enabled)
      .map((sub) => {
        const reasons: string[] = [];
        if (snapshot.current.usAqi >= sub.aqiThreshold) {
          reasons.push(
            `US AQI is ${snapshot.current.usAqi} (exceeds your ${sub.aqiThreshold} threshold)`
          );
        }
        if (
          sub.alertOnInversion &&
          (snapshot.current.inversionRisk === 'high' ||
            snapshot.current.inversionRisk === 'severe')
        ) {
          reasons.push(
            `Thermal inversion risk is ${snapshot.current.inversionRisk.toUpperCase()}`
          );
        }

        return {
          subscription: sub,
          triggered: reasons.length > 0,
          reasons,
          currentAqi: snapshot.current.usAqi,
          inversionRisk: snapshot.current.inversionRisk,
        };
      });
  }

  listPledges(): CommunityPledge[] {
    return this.data.pledges;
  }

  createPledge(input: {
    category: PledgeCategory;
    title: string;
    description: string;
    city: string;
    organizer: string;
    targetHouseholds?: number;
  }): CommunityPledge {
    const impactDefaults: Record<
      PledgeCategory,
      { co2e: number; noxPm: number }
    > = {
      no_idling_school: { co2e: 0.7, noxPm: 3.2 },
      merv13_coop: { co2e: 0.2, noxPm: 1.5 },
      zero_burning: { co2e: 1.8, noxPm: 16.5 },
      clean_air_refuge: { co2e: 0.5, noxPm: 4.0 },
    };
    const defaults = impactDefaults[input.category] ?? { co2e: 0.6, noxPm: 3.0 };

    const pledge: CommunityPledge = {
      id: `pledge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category: input.category,
      title: input.title.trim(),
      description: input.description.trim(),
      city: input.city.trim(),
      organizer: input.organizer.trim() || 'Community Member',
      targetHouseholds: Math.max(10, Math.round(input.targetHouseholds || 100)),
      joinedHouseholds: 1,
      co2eSavedKgPerHouseholdDay: defaults.co2e,
      noxPmSavedGPerHouseholdDay: defaults.noxPm,
      createdAt: new Date().toISOString(),
    };

    this.data.pledges.unshift(pledge);
    this.save();
    return pledge;
  }

  joinPledge(id: string): CommunityPledge | null {
    const pledge = this.data.pledges.find((p) => p.id === id);
    if (!pledge) return null;
    pledge.joinedHouseholds += 1;
    this.save();
    return pledge;
  }
}
