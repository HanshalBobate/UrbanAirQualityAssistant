# ClearAir AI — Winter Smog & Urban Air Quality Assistant

A GenAI-powered assistant helping families and communities navigate severe winter smog and urban air pollution with tailored low-emission daily routines, indoor air quality (IAQ) hacks, sustainable alternatives, and transparent impact modeling.

## Features

- **Live Air Quality & Thermal Inversion Telemetry** (`server/airQualityService.ts`):
  - City search & winter smog presets powered by Open-Meteo Geocoding, Air Quality, and Weather APIs (with automatic offline preset fallback).
  - Evaluates thermal inversion risk from surface wind speed, temperature, humidity, and PM2.5, and identifies the cleanest 3-hour rolling ventilation/errand window over the next 24 hours.
- **Household & Community Lifestyle Profiling** (`src/components/LifestyleForm.tsx`):
  - Tailors recommendations for **Family Homes** or **Community / School Groups**, accounting for sensitive groups (infants/toddlers, asthma/respiratory, elderly, pregnant, outdoor workers, pets), building draftiness, heating source, cooking fuel, daily car commute distance, and existing air purifiers.
- **GenAI + Local Hybrid Advisory Engine** (`server/advisorService.ts`):
  - **Gemini Live Mode**: Uses `@google/genai` (`gemini-2.5-flash` by default) with structured JSON schema output when `GEMINI_API_KEY` is configured in `.env` or entered via the UI Settings modal.
  - **Local Advisor Mode**: Built-in deterministic exposure & rule engine works immediately without an API key.
  - **Contextual Q&A Chat** (`src/components/AdvisorChat.tsx`): Answers follow-up questions grounded in the selected city's live AQI, inversion conditions, and adopted actions.
- **Direct Impact Ledger & Community Multiplier** (`shared/impactMath.ts`, `src/components/ImpactLedger.tsx`):
  - Quantifies personal daily inhaled PM2.5 reduction (`µg/day` and `%` using diminishing-returns stacking), household `CO₂e` avoided, local `NOₓ + PM2.5` emissions prevented, and neighborhood-scale impact from 10 to 1,000 households.

## Quick Start

```bash
npm install
npm run dev
```

- Web UI: `http://localhost:5173`
- API Server: `http://localhost:3001`

### Production Build & Run

```bash
npm run build
npm start
```

Serves both the built frontend and API on `http://localhost:3001`.

### Optional: Enable Live Gemini GenAI

Copy `.env.example` to `.env` and add your Gemini API key:

```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

Or click **Connect Gemini Key** in the top-right header of the web app.

## Verification

```bash
npm run build
npm test
```
