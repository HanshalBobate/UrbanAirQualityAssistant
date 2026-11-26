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
import type { AirQualitySnapshot, ChatMessage, LifestyleProfile } from '../shared/types.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      geminiConfigured: Boolean((process.env.GEMINI_API_KEY || '').trim()),
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

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      res.status(400).json({ error: 'Valid numeric lat and lon query parameters are required.' });
      return;
    }

    const snapshot = await fetchAirQualitySnapshot({
      latitude: lat,
      longitude: lon,
      name,
      country,
      region,
      timezone,
    });
    res.json(snapshot);
  });

  app.post('/api/recommendations', async (req, res) => {
    const { airQuality, profile, apiKey } = req.body as {
      airQuality?: AirQualitySnapshot;
      profile?: LifestyleProfile;
      apiKey?: string;
    };

    if (!airQuality || !airQuality.current || !profile) {
      res.status(400).json({ error: 'airQuality and profile payloads are required.' });
      return;
    }

    const headerKey = req.header('x-gemini-api-key');
    const plan = await generateActionPlan(airQuality, profile, apiKey || headerKey);
    res.json(plan);
  });

  app.post('/api/chat', async (req, res) => {
    const { question, airQuality, profile, adoptedTitles, history, apiKey } = req.body as {
      question?: string;
      airQuality?: AirQualitySnapshot;
      profile?: LifestyleProfile;
      adoptedTitles?: string[];
      history?: ChatMessage[];
      apiKey?: string;
    };

    if (!question?.trim() || !airQuality || !profile) {
      res.status(400).json({ error: 'question, airQuality, and profile are required.' });
      return;
    }

    const headerKey = req.header('x-gemini-api-key');
    const result = await askAdvisorChat({
      question: question.trim(),
      air: airQuality,
      profile,
      adoptedTitles: adoptedTitles ?? [],
      history: history ?? [],
      apiKeyOverride: apiKey || headerKey,
    });

    res.json(result);
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
