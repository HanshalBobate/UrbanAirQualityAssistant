import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import {
  PRESET_CITIES,
  fetchAirQualitySnapshot,
  searchLocations,
} from './airQualityService.js';
import { askAdvisorChat, generateActionPlan } from './advisorService.js';
import { LocalDataStore } from './storageService.js';
import type {
  AirQualitySnapshot,
  ChatMessage,
  LifestyleProfile,
  PledgeCategory,
  SmogAlertSubscription,
  SupportedLanguage,
} from '../shared/types.js';

function createRateLimiter(maxRequests: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= maxRequests) {
      res.status(429).json({
        error: 'Too many requests. Please wait a moment before generating another AI response.',
      });
      return;
    }
    recent.push(now);
    hits.set(ip, recent);
    next();
  };
}

export function createApp(options?: { storePath?: string }) {
  const app = express();
  const store = new LocalDataStore(options?.storePath);
  const aiRateLimit = createRateLimiter(30, 60 * 1000);

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  });
  app.use(cors());
  app.use(express.json({ limit: '512kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      geminiConfigured: Boolean((process.env.GEMINI_API_KEY || '').trim()),
      openAqConfigured: Boolean((process.env.OPENAQ_API_KEY || '').trim()),
      purpleAirConfigured: Boolean((process.env.PURPLEAIR_API_KEY || '').trim()),
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    });
  });

  app.get('/api/presets', (_req, res) => {
    res.json({ presets: PRESET_CITIES });
  });

  app.get('/api/locations/search', async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (!q) {
      res.json({ results: [] });
      return;
    }
    const results = await searchLocations(q);
    res.json({ results });
  });

  app.get('/api/air-quality', async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const name = String(req.query.name ?? 'Selected City');
    const country = String(req.query.country ?? '');
    const region = req.query.region ? String(req.query.region) : undefined;
    const timezone = req.query.timezone ? String(req.query.timezone) : undefined;

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      res.status(400).json({
        error: 'Valid numeric lat (-90..90) and lon (-180..180) query parameters are required.',
      });
      return;
    }

    const snapshot = await fetchAirQualitySnapshot({
      latitude: lat,
      longitude: lon,
      name: name.slice(0, 120),
      country: country.slice(0, 80),
      region: region?.slice(0, 80),
      timezone: timezone?.slice(0, 64),
    });
    res.json(snapshot);
  });

  app.post('/api/recommendations', aiRateLimit, async (req, res) => {
    const { airQuality, profile, apiKey, language } = req.body as {
      airQuality?: AirQualitySnapshot;
      profile?: LifestyleProfile;
      apiKey?: string;
      language?: SupportedLanguage;
    };

    if (!airQuality || !airQuality.current || !profile) {
      res.status(400).json({ error: 'airQuality and profile payloads are required.' });
      return;
    }

    const headerKey = req.header('x-gemini-api-key');
    const plan = await generateActionPlan(
      airQuality,
      profile,
      apiKey || headerKey,
      language || 'en'
    );
    res.json(plan);
  });

  app.post('/api/chat', aiRateLimit, async (req, res) => {
    const { question, airQuality, profile, adoptedTitles, history, apiKey, language } = req.body as {
      question?: string;
      airQuality?: AirQualitySnapshot;
      profile?: LifestyleProfile;
      adoptedTitles?: string[];
      history?: ChatMessage[];
      apiKey?: string;
      language?: SupportedLanguage;
    };

    if (!question?.trim() || !airQuality || !profile) {
      res.status(400).json({ error: 'question, airQuality, and profile are required.' });
      return;
    }
    if (question.trim().length > 1500) {
      res.status(400).json({ error: 'Question must be 1500 characters or fewer.' });
      return;
    }

    const headerKey = req.header('x-gemini-api-key');
    const result = await askAdvisorChat({
      question: question.trim(),
      air: airQuality,
      profile,
      adoptedTitles: (adoptedTitles ?? []).slice(0, 15),
      history: (history ?? []).slice(-10),
      apiKeyOverride: apiKey || headerKey,
      language: language || 'en',
    });

    res.json(result);
  });

  // Morning Smog & Inversion Alert Subscriptions
  app.get('/api/alerts', (_req, res) => {
    res.json({ alerts: store.listAlerts() });
  });

  app.post('/api/alerts', (req, res) => {
    const body = req.body as Partial<SmogAlertSubscription>;
    if (
      !body.locationName ||
      !Number.isFinite(body.latitude) ||
      !Number.isFinite(body.longitude)
    ) {
      res.status(400).json({ error: 'locationName, latitude, and longitude are required.' });
      return;
    }

    const sub = store.upsertAlert({
      id: body.id,
      label: body.label || `${body.locationName} Morning Smog Alert`,
      locationName: body.locationName,
      latitude: Number(body.latitude),
      longitude: Number(body.longitude),
      aqiThreshold: Number(body.aqiThreshold ?? 150),
      alertOnInversion: body.alertOnInversion ?? true,
      morningTime: body.morningTime || '07:00',
      channel: body.channel || 'browser',
      contact: body.contact,
      enabled: body.enabled ?? true,
    });
    res.status(201).json({ alert: sub });
  });

  app.delete('/api/alerts/:id', (req, res) => {
    const removed = store.deleteAlert(req.params.id);
    if (!removed) {
      res.status(404).json({ error: 'Alert subscription not found.' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/alerts/evaluate', (req, res) => {
    const { airQuality } = req.body as { airQuality?: AirQualitySnapshot };
    if (!airQuality || !airQuality.current) {
      res.status(400).json({ error: 'airQuality snapshot is required.' });
      return;
    }
    const evaluations = store.evaluateAlerts(airQuality);
    res.json({ evaluations });
  });

  // Shareable Community & School Pledges
  app.get('/api/pledges', (_req, res) => {
    res.json({ pledges: store.listPledges() });
  });

  app.post('/api/pledges', (req, res) => {
    const body = req.body as {
      category?: PledgeCategory;
      title?: string;
      description?: string;
      city?: string;
      organizer?: string;
      targetHouseholds?: number;
    };

    if (!body.title?.trim() || !body.description?.trim() || !body.city?.trim()) {
      res.status(400).json({ error: 'title, description, and city are required.' });
      return;
    }

    const pledge = store.createPledge({
      category: body.category || 'no_idling_school',
      title: body.title,
      description: body.description,
      city: body.city,
      organizer: body.organizer || 'Neighborhood Group',
      targetHouseholds: body.targetHouseholds,
    });
    res.status(201).json({ pledge });
  });

  app.post('/api/pledges/:id/join', (req, res) => {
    const pledge = store.joinPledge(req.params.id);
    if (!pledge) {
      res.status(404).json({ error: 'Pledge not found.' });
      return;
    }
    res.json({ pledge });
  });

  // Serve production build if present
  const distDir = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}

const isMainModule =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop() || '');

if (isMainModule) {
  const port = Number(process.env.PORT || 3001);
  const app = createApp();
  app.listen(port, () => {
    console.log(`ClearAir API server listening on http://localhost:${port}`);
  });
}
