import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/index.js';
import { buildFallbackSnapshot } from '../server/airQualityService.js';
import type { LifestyleProfile } from '../shared/types.js';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clearair-test-'));
const tempStorePath = path.join(tempDir, 'store.json');
const app = createApp({ storePath: tempStorePath });

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

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
  measuredIndoorPm25: 55,
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

  it('rejects invalid /api/air-quality coordinates with 400 and sets security headers', async () => {
    const res = await request(app).get('/api/air-quality?lat=bad&lon=74.3');
    expect(res.status).toBe(400);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');

    const outOfRange = await request(app).get('/api/air-quality?lat=120&lon=74.3');
    expect(outOfRange.status).toBe(400);
  });

  it('rejects oversized chat questions with 400', async () => {
    const airQuality = buildFallbackSnapshot('Nagpur', 'India', 21.1458, 79.0882);
    const res = await request(app).post('/api/chat').send({
      question: 'a'.repeat(1600),
      airQuality,
      profile: sampleProfile,
    });
    expect(res.status).toBe(400);
  });

  it('generates sensor-calibrated and multilingual recommendations across all 3 pillars', async () => {
    const airQuality = buildFallbackSnapshot('Nagpur', 'India', 21.1458, 79.0882, 'Asia/Kolkata');
    const res = await request(app)
      .post('/api/recommendations')
      .send({ airQuality, profile: sampleProfile, language: 'ur' });

    expect(res.status).toBe(200);
    expect(res.body.recommendations).toHaveLength(9);
    expect(res.body.exposureCalibratedBySensor).toBe(true);
    expect(res.body.infiltrationRatio).toBeGreaterThan(0);
    expect(res.body.situationBrief).toContain('اردو');

    const categories = new Set(res.body.recommendations.map((r: { category: string }) => r.category));
    expect(categories.has('daily_routine')).toBe(true);
    expect(categories.has('indoor_iaq')).toBe(true);
    expect(categories.has('sustainable_alt')).toBe(true);

    const titles = res.body.recommendations.map((r: { title: string }) => r.title).join(' ');
    expect(titles).toContain('Corsi-Rosenthal');
    expect(titles).toContain('Wood/Coal');
  });

  it('persists and evaluates morning smog & inversion alert subscriptions', async () => {
    const createRes = await request(app).post('/api/alerts').send({
      label: 'Morning Kids Walk Alert',
      locationName: 'Nagpur',
      latitude: 21.1458,
      longitude: 79.0882,
      aqiThreshold: 150,
      alertOnInversion: true,
      morningTime: '07:00',
      channel: 'browser',
    });

    expect(createRes.status).toBe(201);
    const alertId = createRes.body.alert.id;

    const listRes = await request(app).get('/api/alerts');
    expect(listRes.status).toBe(200);
    expect(listRes.body.alerts.some((a: { id: string }) => a.id === alertId)).toBe(true);

    const severeSnapshot = buildFallbackSnapshot('Nagpur', 'India', 21.1458, 79.0882);
    const evalRes = await request(app)
      .post('/api/alerts/evaluate')
      .send({ airQuality: severeSnapshot });

    expect(evalRes.status).toBe(200);
    expect(evalRes.body.evaluations[0].triggered).toBe(true);
    expect(evalRes.body.evaluations[0].reasons.length).toBeGreaterThanOrEqual(1);

    const delRes = await request(app).delete(`/api/alerts/${alertId}`);
    expect(delRes.status).toBe(200);
  });

  it('lists, creates, and joins shareable community pledges', async () => {
    const listRes = await request(app).get('/api/pledges');
    expect(listRes.status).toBe(200);
    expect(listRes.body.pledges.length).toBeGreaterThanOrEqual(4);

    const createRes = await request(app).post('/api/pledges').send({
      category: 'no_idling_school',
      title: 'Maple Elementary Clean Gate Week',
      description: 'Turn off engines while waiting in pickup lane.',
      city: 'Salt Lake City',
      organizer: 'Maple PTA',
      targetHouseholds: 80,
    });
    expect(createRes.status).toBe(201);
    const pledgeId = createRes.body.pledge.id;
    expect(createRes.body.pledge.joinedHouseholds).toBe(1);

    const joinRes = await request(app).post(`/api/pledges/${pledgeId}/join`);
    expect(joinRes.status).toBe(200);
    expect(joinRes.body.pledge.joinedHouseholds).toBe(2);
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
