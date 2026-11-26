# ClearAir AI — Urban Air Quality Assistant

**Chosen Vertical**: `[Challenge 6] Urban Air Quality Assistant` — Helping families and communities navigate severe winter smog and urban air pollution with tailored low-emission daily routines, indoor air quality (IAQ) hacks, sustainable alternatives, and transparent impact explanations.

---

## Approach & Decision Logic

Severe winter smog is driven by **thermal inversions** (cold, calm surface air trapping PM2.5, NO₂, and residential heating/traffic exhaust near street level). Rather than showing a static AQI number, ClearAir AI combines meteorological telemetry, building exposure modeling, and Generative AI synthesis:

1. **Thermal Inversion & Diurnal Window Detection** (`shared/impactMath.ts`, `server/airQualityService.ts`):
   - Evaluates surface wind speed (`< 6 km/h` / `< 12 km/h`), surface temperature (`<= 5°C`), relative humidity (`>= 75%`), and PM2.5 concentration to classify inversion risk (`low`, `moderate`, `high`, `severe`).
   - Scans the 24-hour hourly forecast using a **3-hour rolling average** (`findBestVentilationWindow`) to recommend the safest afternoon mixing window for essential errands or brief cross-ventilation—or explicitly warn against opening windows if AQI remains unhealthy all day.
2. **Ground-Station & Indoor Sensor Calibration** (`shared/impactMath.ts`, `server/airQualityService.ts`):
   - Queries nearby physical street sensors via **Sensor.Community** (keyless) plus optional **OpenAQ v3** (`OPENAQ_API_KEY`) and **PurpleAir** (`PURPLEAIR_API_KEY`), blending readings using inverse-distance weighting (`computeBlendedGroundPm25`).
   - Accepts an optional user-measured indoor PM2.5 reading (`measuredIndoorPm25`) to compute the actual **Indoor/Outdoor (I/O) infiltration ratio** and calibrate the 24-hour baseline inhaled dose (`computeCalibratedBaselineExposure`).
3. **Structured GenAI Synthesis + Deterministic Fallback** (`server/advisorService.ts`):
   - When `GEMINI_API_KEY` is configured (in `.env` or via the in-app Settings dialog), calls Google Gemini (`@google/genai`, `gemini-2.5-flash`) with a strict `responseSchema` to generate 9 tailored recommendations across **Low-Emission Daily Routines**, **Indoor Air Quality Hacks**, and **Sustainable Alternatives**, plus context-aware conversational Q&A (`/api/chat`).
   - Falls back transparently to a deterministic, profile-and-location-parameterized Local Advisor Engine (`buildLocalActionPlan`) when no API key is present or an upstream call fails.
4. **Direct Impact Math & Diminishing-Returns Stacking** (`shared/impactMath.ts`):
   - Models stacked exposure reduction multiplicatively (`1 - Π(1 - r_i)`, capped at 90%) so adopting multiple actions produces physically realistic daily PM2.5 dose reductions (`µg/person/day`) alongside `CO₂e` (`kg/day`) and local `NOₓ + primary PM2.5` (`g/day`) avoided, scaled across a selectable neighborhood multiplier (`10` to `1,000` households).

---

## How the Solution Works

- **Frontend (`src/`)**: React 19 + TypeScript + Vite + Tailwind CSS v4.
  - `AirQualityHero.tsx`: City geocoding search, winter smog hotspot presets, live US AQI & pollutant cards, nearby ground stations, thermal inversion alert, and 24-hour smog timeline.
  - `LifestyleForm.tsx`: Family vs. Community/School mode, named Saved Profiles (`localStorage`), sensitive groups, building type, heating/cooking fuel, daily driving slider, indoor PM2.5 sensor calibration, and local challenges.
  - `ImpactLedger.tsx` & `RecommendationCard.tsx`: Interactive action adoption toggles, step-by-step checklists, direct health/emission impact breakdowns, and neighborhood ripple slider.
  - `CommunityPledgesSection.tsx` & `PrintableGuideModal.tsx`: Shareable school/neighborhood clean-air pledges (`?pledge=<id>`) and a 1-page printable DIY Corsi-Rosenthal purifier & emergency smog sheet.
  - `AlertsModal.tsx`: Morning smog & thermal inversion threshold subscriptions with browser Web Notifications.
  - `src/i18n/translations.ts`: Multilingual support for English (`en`), Urdu (`ur` with RTL layout), Hindi (`hi`), Polish (`pl`), and Spanish (`es`).
- **Backend (`server/`)**: Express + TypeScript (`server/index.ts`, `server/storageService.ts`).
  - `/api/locations/search` & `/api/air-quality`: Open-Meteo + ground-station aggregation with in-memory TTL caching (5–15 min).
  - `/api/recommendations` & `/api/chat`: Rate-limited GenAI synthesis and conversational advisor endpoints.
  - `/api/alerts`, `/api/alerts/evaluate`, `/api/pledges`, `/api/pledges/:id/join`: Persistent JSON-backed store (`data/clearair-store.json`) for alert rules and community pledges.

---

## Assumptions Made

- **Daily Inhalation Volume**: Personal PM2.5 exposure estimates use a standard adult mixed-activity breathing rate of `15 m³/day` (`DAILY_BREATHING_VOLUME_M3`), assuming ~85% of a winter smog day is spent indoors and ~15% outdoors.
- **Default Building Infiltration**: When no indoor PM2.5 monitor reading is provided, indoor infiltration defaults by housing type (`0.48` apartment, `0.56` single-family house, `0.62` school/community hall, `0.72` older drafty home), adjusted by `0.65×` if the household already runs a HEPA purifier.
- **Exposure Stacking Cap**: Combined exposure reduction uses multiplicative diminishing returns capped at `90%` to avoid overstating combined indoor + behavioral interventions.
- **External Telemetry & Persistence**: Live telemetry relies on Open-Meteo and Sensor.Community (with deterministic preset city fallbacks when offline). Household profiles/adopted choices persist in browser `localStorage`, while alert subscriptions and community pledges persist locally on the Express server.

---

## Security, Efficiency & Accessibility

- **Security**: Removes `X-Powered-By`, sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` headers, enforces payload (`512kb`) and string length limits, validates coordinate ranges (`lat -90..90`, `lon -180..180`), and applies per-IP sliding-window rate limiting (`30 req/min`) on AI endpoints. API keys are never hardcoded or committed (`.gitignore` excludes `.env` and `data/`).
- **Efficiency**: Parallelizes Open-Meteo air quality, weather, and ground-station calls via `Promise.all` with request timeouts (`4.5–6s`) and in-memory TTL caches to avoid redundant upstream requests.
- **Accessibility**: Semantic landmarks (`<header>`, `<main>`, `<aside>`, `<section>`, `<article>`), skip-to-content link, `role="dialog"` + `aria-modal="true"` + `Escape` keyboard dismissal on all modals, `aria-live="polite"` chat log, `role="alert"` on triggered smog warnings, and RTL layout for Urdu.

---

## Local Setup, Testing & Deployment

```bash
npm install
npm run dev      # Client: http://localhost:5173 | API: http://localhost:3001
```

### Production Build & Automated Tests

```bash
npm run build    # Vite bundle + TypeScript strict check
npm test         # Vitest unit & API integration tests (12 tests)
npm start        # Serves production dist/ + /api/* on http://localhost:3001
```

### Environment Variables (`.env.example`)

- `GEMINI_API_KEY`: Optional; enables live Gemini (`gemini-2.5-flash`) synthesis and chat.
- `OPENAQ_API_KEY` / `PURPLEAIR_API_KEY`: Optional; augments keyless Sensor.Community ground stations.
- `PORT`: Server port (default `3001`).

### One-Click Deployment

Includes [render.yaml](render.yaml) for Render (`npm install && npm run build`, `npm start`, health check `/api/health`).
