# ClearAir AI — Winter Smog & Urban Air Quality Assistant

A GenAI-powered assistant helping families and communities navigate severe winter smog and urban air pollution with tailored low-emission daily routines, indoor air quality (IAQ) hacks, sustainable alternatives, and transparent impact modeling.

## Features

- **Live Air Quality, Ground Stations & Thermal Inversion Telemetry** (`server/airQualityService.ts`):
  - City search & winter smog presets powered by Open-Meteo Geocoding, Air Quality, and Weather APIs (with automatic offline preset fallback).
  - Nearby physical ground-station lookup via **Sensor.Community** (keyless) plus optional **OpenAQ v3** (`OPENAQ_API_KEY`) and **PurpleAir** (`PURPLEAIR_API_KEY`), with inverse-distance blended PM2.5.
  - Evaluates thermal inversion risk and identifies the cleanest 3-hour rolling ventilation/errand window over the next 24 hours.
- **Persistent Profiles, Indoor Sensor Calibration & Morning Smog Alerts** (`src/components/LifestyleForm.tsx`, `src/components/AlertsModal.tsx`, `server/storageService.ts`):
  - Automatically persists active household/community profiles, adopted choices, location, and named saved profiles in `localStorage`.
  - Optional indoor PM2.5 monitor input calibrates the real-world Indoor/Outdoor (I/O) infiltration ratio and daily inhaled exposure baseline in `shared/impactMath.ts`.
  - Morning smog & thermal inversion alert subscriptions (`GET/POST/DELETE /api/alerts`, `POST /api/alerts/evaluate`) with browser notification support and in-app alert banners.
- **Shareable Community Pledges & 1-Page Printable Guide** (`src/components/CommunityPledgesSection.tsx`, `src/components/PrintableGuideModal.tsx`):
  - Create, join, and share neighborhood/school clean-air pledges (no-idling school lanes, bulk MERV-13 filter co-ops, zero leaf burning, clean-air refuge rooms) via `?pledge=<id>` links.
  - Dedicated 1-page printable / Save-to-PDF DIY Corsi-Rosenthal purifier & emergency smog action sheet.
- **Multilingual Localization (`en`, `ur`, `hi`, `pl`, `es`)** (`src/i18n/translations.ts`):
  - UI localization (including RTL layout for Urdu) and language-aware recommendations & GenAI chat responses.
- **GenAI + Local Hybrid Advisory Engine** (`server/advisorService.ts`):
  - **Gemini Live Mode** (`@google/genai` `gemini-2.5-flash`) when `GEMINI_API_KEY` is configured in `.env` or via the UI Settings modal, with a built-in **Local Advisor Mode** fallback.

## Quick Start

```bash
npm install
npm run dev
```

- Web UI: `http://localhost:5173`
- API Server: `http://localhost:3001`

### Production Build & Verification

```bash
npm run build
npm test
npm start
```
