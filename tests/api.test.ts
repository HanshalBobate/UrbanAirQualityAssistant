import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/index.js';
import { buildFallbackSnapshot } from '../server/airQualityService.js';
import type { LifestyleProfile } from '../shared/types.js';

const app = createApp();

const sampleProfile: LifestyleProfile = {
  mode: 'family',
  householdSize: 4,
  sensitivities: ['infants_toddlers', 'asthma_respiratory'],
  housingType: 'older_drafty_home',
  heatingSource: 'wood_pellet_stove',
  cookingFuel: 'natural_gas',
  commuteMode: 'gas_car',
  dailyCarKm: 20,
  hasAirPurifier: false,
  localChallenges: 'morning school traffic and valley inversion',
};

describe('ClearAir API endpoints', () => {
  it('returns health status and preset winter smog cities', async () => {
    const healthRes = await request(app).get('/api/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.ok).toBe(true);

    const presetsRes = await request(app).get('/api/presets');
    expect(presetsRes.status).toBe(200);
    expect(Array.isArray(presetsRes.body.presets)).toBe(true);
    expect(presetsRes.body.presets.length).toBeGreaterThanOrEqual(5);
  });

  it('rejects invalid /api/air-quality coordinates with 400', async () => {
    const res = await request(app).get('/api/air-quality?lat=bad&lon=74.3');
    expect(res.status).toBe(400);
  });

  it('generates tailored recommendations across all 3 pillars with direct impact', async () => {
    const airQuality = buildFallbackSnapshot('Lahore', 'Pakistan', 31.55, 74.34, 'Asia/Karachi');
    const res = await request(app)
      .post('/api/recommendations')
      .send({ airQuality, profile: sampleProfile });

    expect(res.status).toBe(200);
    expect(res.body.recommendations).toHaveLength(9);

    const categories = new Set(res.body.recommendations.map((r: { category: string }) => r.category));
    expect(categories.has('daily_routine')).toBe(true);
    expect(categories.has('indoor_iaq')).toBe(true);
    expect(categories.has('sustainable_alt')).toBe(true);

    // Tailored to wood stove + older drafty home + no air purifier
    const titles = res.body.recommendations.map((r: { title: string }) => r.title).join(' ');
    expect(titles).toContain('Corsi-Rosenthal');
    expect(titles).toContain('Wood/Coal');

    for (const rec of res.body.recommendations) {
      expect(rec.directImpact.exposureReductionPct).toBeGreaterThan(0);
      expect(rec.directImpact.explanation.length).toBeGreaterThan(20);
      expect(rec.directImpact.communityMultiplierNote.length).toBeGreaterThan(15);
    }
  });

  it('answers contextual follow-up questions via /api/chat', async () => {
    const airQuality = buildFallbackSnapshot('Salt Lake City', 'United States', 40.76, -111.89);
    const res = await request(app).post('/api/chat').send({
      question: 'Can we open our windows today or build a DIY purifier?',
      airQuality,
      profile: sampleProfile,
      adoptedTitles: ['Build a $50 DIY Corsi-Rosenthal MERV-13 Air Purifier'],
      history: [],
    });

    expect(res.status).toBe(200);
    expect(typeof res.body.reply).toBe('string');
    expect(res.body.reply.length).toBeGreaterThan(30);
    expect(res.body.reply).toContain('Salt Lake City');
  });
});
