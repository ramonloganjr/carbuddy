<div align="center">

# 🚗 CarBuddy

**Know your car. Understand its costs. Maintain it on time. Keep everything in one place.**

A cross-platform vehicle ownership platform for iOS and Android — a digital garage, a
fuel-intelligence system, a maintenance logbook, an ownership-cost tracker, a secure
document wallet and a reminder engine, in one Material 3 Expressive app.

By **Ramon Logan Jr.**

<br />

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Expo](https://img.shields.io/badge/Expo-SDK_54-000020?style=for-the-badge&logo=expo&logoColor=white)
![Material Design 3](https://img.shields.io/badge/Material_3-Expressive-757575?style=for-the-badge&logo=materialdesign&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-offline_first-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

![Tests](https://img.shields.io/badge/tests-227_passing-3FB950?style=flat-square)
![Coverage](https://img.shields.io/badge/domain_coverage-94.4%25-3FB950?style=flat-square)
![Typecheck](https://img.shields.io/badge/typecheck-strict_clean-3FB950?style=flat-square)
![Lint](https://img.shields.io/badge/eslint-clean-3FB950?style=flat-square)
![Platforms](https://img.shields.io/badge/iOS_·_Android-supported-000000?style=flat-square&logo=apple&logoColor=white)

</div>

---

## Contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Features](#features)
- [Screens](#screens)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Building for the stores](#building-for-the-stores)
- [Architecture](#architecture)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Author](#author)

---

## What it does

Most car apps are either a fuel calculator or a service reminder. CarBuddy is the whole
picture: what your car costs, what it needs, and when — with every record available
offline, because people log fill-ups standing at a pump with one bar of signal.

The product principle throughout is **simple by default, powerful when needed**. Adding a
car takes two fields. The full specification sheet, financing details and warranty terms
are there for anyone who wants them, and demanded of nobody.

---

## Tech stack

### Shared core

|                                                                        | Technology         | Version | Why it's here                                                                                                        |
| :--------------------------------------------------------------------: | ------------------ | ------- | -------------------------------------------------------------------------------------------------------------------- |
| <img src="https://cdn.simpleicons.org/typescript/3178C6" width="20" /> | **TypeScript**     | 5.9     | Strict mode everywhere, plus `noUncheckedIndexedAccess`. The domain layer is pure TS with zero runtime dependencies. |
| <img src="https://cdn.simpleicons.org/nodedotjs/5FA04E" width="20" />  | **Node.js**        | 20.19+  | Runtime for the API and all tooling. Pinned in `.nvmrc`.                                                             |
|    <img src="https://cdn.simpleicons.org/npm/CB3837" width="20" />     | **npm workspaces** | 10+     | Monorepo without extra tooling. The domain package is consumed by both apps as a real dependency, not a path alias.  |

### Mobile

|                                                                            | Technology                    | Version | Why it's here                                                                                                                              |
| :------------------------------------------------------------------------: | ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
|     <img src="https://cdn.simpleicons.org/react/61DAFB" width="20" />      | **React Native**              | 0.81    | New Architecture enabled. One codebase, genuinely native behaviour on both platforms.                                                      |
|      <img src="https://cdn.simpleicons.org/expo/000020" width="20" />      | **Expo**                      | SDK 54  | Managed native modules, EAS Build for `.ipa`/`.aab`/`.apk`, OTA updates for JS-only fixes.                                                 |
|      <img src="https://cdn.simpleicons.org/expo/000020" width="20" />      | **Expo Router**               | 6.0     | File-based routing with typed routes and deep linking.                                                                                     |
| <img src="https://cdn.simpleicons.org/materialdesign/757575" width="20" /> | **Material Color Utilities**  | 0.3     | Google's own palette generator. Every colour is derived from a seed, so M3 contrast guarantees hold by construction rather than by review. |
|     <img src="https://cdn.simpleicons.org/react/61DAFB" width="20" />      | **Reanimated**                | 4.1     | Spring-based Material 3 Expressive motion, running on the UI thread so gestures stay smooth under load.                                    |
|     <img src="https://cdn.simpleicons.org/react/61DAFB" width="20" />      | **Gesture Handler**           | 2.28    | Native-thread gestures for the bottom sheet drag.                                                                                          |
|     <img src="https://cdn.simpleicons.org/sqlite/003B57" width="20" />     | **expo-sqlite**               | 16.0    | The local database — **source of truth, not a cache**. WAL mode so reads never block on background sync writes.                            |
|     <img src="https://cdn.simpleicons.org/react/61DAFB" width="20" />      | **Zustand**                   | 5.0     | Small, un-opinionated client state. No boilerplate, no context tree.                                                                       |
|   <img src="https://cdn.simpleicons.org/reactquery/FF4154" width="20" />   | **TanStack Query**            | 5.10    | Server-state caching for the few genuinely remote reads.                                                                                   |
|      <img src="https://cdn.simpleicons.org/svg/FFB13B" width="20" />       | **react-native-svg**          | 15.12   | Hand-built accessible charts — line, bar and donut.                                                                                        |
|      <img src="https://cdn.simpleicons.org/expo/000020" width="20" />      | **expo-secure-store**         | 15.0    | Keychain / Android Keystore. Auth tokens never touch AsyncStorage.                                                                         |
|      <img src="https://cdn.simpleicons.org/expo/000020" width="20" />      | **expo-local-authentication** | 17.0    | Face ID / Touch ID / fingerprint app lock.                                                                                                 |
|      <img src="https://cdn.simpleicons.org/expo/000020" width="20" />      | **expo-notifications**        | 0.32    | Local scheduling with Android channels and iOS interruption levels.                                                                        |
|      <img src="https://cdn.simpleicons.org/expo/000020" width="20" />      | **expo-image-picker**         | 17.0    | Camera and library access for receipts and document scans.                                                                                 |

### Backend

|                                                                           | Technology            | Version  | Why it's here                                                                                  |
| :-----------------------------------------------------------------------: | --------------------- | -------- | ---------------------------------------------------------------------------------------------- |
|    <img src="https://cdn.simpleicons.org/nestjs/E0234E" width="20" />     | **NestJS**            | 11       | Modules, DI and guards give clean separation between HTTP, domain and persistence.             |
|  <img src="https://cdn.simpleicons.org/postgresql/4169E1" width="20" />   | **PostgreSQL**        | 17       | Relational integrity, partial indexes, JSONB for the genuinely schemaless bits.                |
|    <img src="https://cdn.simpleicons.org/prisma/2D3748" width="20" />     | **Prisma**            | 6.19     | Type-safe queries and forward-only migrations. 20 models.                                      |
| <img src="https://cdn.simpleicons.org/jsonwebtokens/000000" width="20" /> | **Passport + JWT**    | 11 / 4.0 | 15-minute access tokens; opaque, rotating refresh tokens stored hashed.                        |
|     <img src="https://cdn.simpleicons.org/rust/000000" width="20" />      | **@node-rs/argon2**   | 2.2      | Argon2id at the OWASP baseline, with prebuilt binaries — container builds need no C toolchain. |
|   <img src="https://cdn.simpleicons.org/nodedotjs/5FA04E" width="20" />   | **Helmet**            | 8.3      | Security headers.                                                                              |
|    <img src="https://cdn.simpleicons.org/swagger/85EA2D" width="20" />    | **Swagger / OpenAPI** | 11.4     | Interactive docs at `/docs` — automatically disabled in production.                            |
|    <img src="https://cdn.simpleicons.org/nestjs/E0234E" width="20" />     | **@nestjs/schedule**  | 5.0      | Cron jobs for the nightly reminder sweep and push delivery.                                    |
|    <img src="https://cdn.simpleicons.org/nestjs/E0234E" width="20" />     | **@nestjs/throttler** | 6.5      | Two-tier rate limiting, tightened further on auth routes.                                      |

### Tooling

|                                                                           | Technology             | Version | Why it's here                                                                                    |
| :-----------------------------------------------------------------------: | ---------------------- | ------- | ------------------------------------------------------------------------------------------------ |
|    <img src="https://cdn.simpleicons.org/vitest/6E9F18" width="20" />     | **Vitest**             | 2.1     | Domain suite — 198 tests in under half a second, with enforced coverage thresholds.              |
|     <img src="https://cdn.simpleicons.org/jest/C21325" width="20" />      | **Jest**               | 29.7    | API suite.                                                                                       |
|    <img src="https://cdn.simpleicons.org/eslint/4B32C3" width="20" />     | **ESLint**             | 9.39    | Flat config with type-aware rules — `no-floating-promises` caught real bugs in the startup path. |
|   <img src="https://cdn.simpleicons.org/prettier/F7B93E" width="20" />    | **Prettier**           | 3.9     | Formatting, enforced in CI.                                                                      |
|    <img src="https://cdn.simpleicons.org/docker/2496ED" width="20" />     | **Docker Compose**     | —       | Postgres and MinIO for local development; multi-stage production image for the API.              |
| <img src="https://cdn.simpleicons.org/githubactions/2088FF" width="20" /> | **GitHub Actions**     | —       | Four parallel jobs: domain, API (with a real Postgres service), mobile, lint.                    |
|     <img src="https://cdn.simpleicons.org/expo/000020" width="20" />      | **EAS Build & Submit** | —       | Store-ready binaries and submission for both platforms.                                          |

---

## Features

### 🚙 Digital garage

- Multiple vehicles per account, switchable from the dashboard without leaving the screen
- Full profile: make, model, variant, year, body type, colour, engine type, displacement,
  cylinders, transmission, drivetrain, fuel type, tank capacity, recommended grade,
  battery and tyre specifications
- Ownership records: purchase date, price, purchase odometer, dealer, financing, warranty
- **Sensitive identifiers encrypted and masked.** VIN, engine number, plate and document
  numbers are AES-256-GCM encrypted server-side and shown masked (`•••••••••••XW000123`)
  until you explicitly tap to reveal
- **VIN check-digit validation** (ISO-3779) — flagged as a warning, never a hard rejection,
  because several markets don't follow the standard

### ⛽ Fuel intelligence

- Log every refuelling: date, odometer, volume, unit price, total, fuel type, station,
  full-tank or partial, payment method, notes, receipt photos
- **Correct full-tank-to-full-tank measurement.** Partial fills roll into the next full
  tank; the opening tank's own volume is never counted against the segment it starts —
  the single most common way this calculation is gotten wrong
- **Missed-fill handling.** Flag a fill-up you forgot to log and the chain breaks cleanly
  instead of producing a fabricated figure
- Four economy standards — **km/L, L/100 km, MPG (US), MPG (Imperial)** — switchable at
  any time, with every historical figure recomputed, never re-entered
- Analytics: lifetime average, best and worst tank, total consumed, total spend,
  volume-weighted average pump price, fuel cost per distance, distance and days between
  fills, monthly series and trend direction
- **Live economy preview while logging** — see the figure an entry will produce _before_
  saving, so a mistyped odometer is obvious immediately rather than after it skews averages

### 📉 Anomaly detection

- Flags when recent economy drifts meaningfully from that vehicle's **own** baseline
- Uses **median + MAD** rather than mean + standard deviation, so a single road trip or a
  mistyped reading doesn't move the baseline
- Requires **two independent conditions** — a percentage floor _and_ a robust z-score
  against the car's historical spread. A vehicle that naturally swings 20% between summer
  and winter isn't flagged every autumn; a rock-steady one is flagged on a smaller move
- Presents **informational factors to consider**, never a mechanical diagnosis: driving
  conditions, short trips, tyre pressure, load, A/C, seasonal weather, fuel quality,
  measurement accuracy

### 🔧 Maintenance

- 33 service categories, from engine oil to wheel alignment, plus custom
- Each record: type, date, odometer, provider, parts replaced, parts/labour/tax/total cost,
  warranty terms, next recommended date and mileage, notes, invoices
- **Time _and_ mileage intervals — whichever comes first.** "Every 6 months or 10,000 km"
  is evaluated on both bounds independently, with the UI reporting _which_ one is driving
  the result, so a three-month-old oil change flagged by mileage explains itself
- **Mileage projected into dates** using your actual driving habits from the fuel log —
  "about 5 weeks away" instead of "3,200 km away"
- **Logging a service resets its reminder automatically.** No separate step to forget
- Starter schedules seeded per powertrain (petrol / diesel / hybrid / electric) so the app
  is useful on day one, with every interval editable

### 🔩 Component lifecycle

- Track tyres, battery, brake pads and discs, filters, spark plugs, belts, shocks, wipers
- Records brand, model, specification, install date and mileage, price, warranty
- **Wear is the worse of age and distance** — a five-year-old tyre with 8,000 km is aged
  out; a one-year-old tyre with 60,000 km is worn out. Both behave correctly
- Tyre rotation countdown
- **Cost per kilometre once replaced** — answers "were the expensive tyres worth it?"

### 📁 Document vault

- Registration, licence, insurance, inspection, road tax, warranties, roadside assistance,
  invoices, purchase and financing agreements, custom documents
- Document number, issuer, issue and expiry dates, notes, photo or PDF attachments
- **Driver documents live above vehicles** — a licence survives selling a car and shows
  under every vehicle
- Configurable expiry reminders at **60 / 30 / 14 / 7 / 1 days**, defaulted per document type
- Sorted by urgency, not alphabetically — the reason to open this screen is a deadline

### 🔔 Reminder engine

- One deterministic planner covers scheduled and mileage-based maintenance, overdue
  services, document expiry, component replacement, tyre rotation, fuel anomalies and your
  own custom reminders
- **Quiet hours, preferred delivery hour and a hard daily cap** so a neglected garage can't
  produce a wall of alerts — the most severe survive the cap
- Explicit timezone handling: the server produces exactly the instant the device would
- **Plan diffing.** Only changed notifications are re-registered with the OS, which matters
  against iOS's 64-pending limit
- Local notifications _and_ server push — the latter covers a user who hasn't opened the
  app in two months, which local scheduling structurally cannot

### 💰 Ownership costs

- 17 expense categories: fuel, maintenance, repairs, insurance, registration, parking,
  tolls, car washes, accessories, financing, fines, inspection, tyres, parts, roadside
  assistance, depreciation, other
- **Fuel and maintenance are projected in automatically and de-duplicated** — logging a
  fill-up _and_ filing the receipt as an expense yields one cost, not two
- Monthly, yearly and lifetime summaries; category breakdown with shares
- **Averages divide by months the log spans, not months containing a receipt** — a quiet
  February is a cheap month, not a month that didn't happen
- Cost per kilometre, fuel-versus-maintenance split, most and least expensive months
- Analytics answers questions in words: _How much this year? What per month? Is my economy
  improving? Which month cost most? When is my next service?_

### ❤️ Vehicle health

- A weighted 0–100 score across maintenance, documents, wear items and fuel
- **Dimensions with no data are excluded, not scored as perfect** — an empty app doesn't
  report perfect health
- **Anything expired or overdue caps the score** into the "attention" band. You can be told
  you're mostly on top of things; never that you're fine while insurance has lapsed
- Every factor carries its own score, plain-language summary and a route to act on it

### 📴 Offline-first

- SQLite is the **source of truth**. Every screen reads locally; writes never wait on network
- Local write and sync-queue entry commit in **one transaction** — a change can't be saved
  locally and silently lost before reaching the server
- **Idempotent sync** by client-generated mutation id: a retry after a dropped response
  returns `duplicate` instead of creating a second fill-up
- **Optimistic concurrency** via row versions, with **field-level three-way merge** — two
  devices editing different fields of one record both keep their edit. Plain last-write-wins
  would throw one away
- Genuine same-field collisions are resolved deterministically and **surfaced for review**,
  with the discarded value offered back
- Mutation coalescing, exponential backoff with jitter, soft deletes so removals propagate

### 🎨 Material 3 Expressive

- **Colour generated from a seed** via Google's own utilities — M3 contrast guarantees hold
  in light, dark, high-contrast and dynamic palettes by construction
- Expressive type scale with `Emphasized` weights and tabular figures for money
- **Spring-based motion** in two families: spatial springs overshoot, effects springs don't
- **Shape morphing on press** — components square off under the thumb
- Tonal elevation via surface containers, not translucent overlays that wash out in dark mode
- 22 components, 7 token modules. No screen sets a raw hex, font size or radius

### ♿ Accessibility (WCAG 2.2 AA)

- **Never colour alone.** Every status pairs colour with an icon _and_ a text label
- **Charts have real text alternatives** describing range, direction and extremes — used as
  both the screen-reader label and the visible caption
- 48dp minimum touch targets, enforced by the interaction primitive
- Composed list labels: a row reads as one sentence, not four fragments
- Dynamic type with per-role caps and recomputed line heights
- Reduced motion honoured — transitions collapse to a cross-fade, they don't disappear
- Live regions for validation errors and snackbars

### 🔐 Security

| Concern           | Approach                                                                   |
| ----------------- | -------------------------------------------------------------------------- |
| Passwords         | Argon2id, 19 MiB / 2 iterations                                            |
| Access tokens     | 15-minute JWT, subject re-verified against the database                    |
| Refresh tokens    | Opaque random bytes, stored hashed, rotated every use                      |
| Token theft       | Reuse of a rotated token revokes the entire family                         |
| Token storage     | Keychain / Keystore — never AsyncStorage                                   |
| Sensitive columns | AES-256-GCM, with HMAC fingerprints for equality search                    |
| Enumeration       | Identical error _and timing_ for unknown email vs. wrong password          |
| Brute force       | Per-endpoint throttling plus account lockout                               |
| Authorisation     | User id from the validated token only — never a parameter or body          |
| Mass assignment   | Per-entity write allow-lists on sync                                       |
| Uploads           | Server-generated keys, MIME allow-list, 15 MB cap, short-lived signed URLs |
| App lock          | Biometric, with a grace period so the camera round-trip isn't punished     |
| Config            | Fail-fast — production refuses to start without real secrets               |

---

## Screens

**34 screens** across the app:

| Area            | Screens                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| **Tabs**        | Home dashboard · Fuel · Service · Documents · Garage                    |
| **Onboarding**  | Welcome · Units & currency · Notification permission · First vehicle    |
| **Auth**        | Sign in · Sign up                                                       |
| **Fuel**        | Log a fill-up · Fill-up detail                                          |
| **Service**     | Log a service · Schedule detail · Service record detail · All schedules |
| **Vehicle**     | Add · Profile · Edit · Analytics · Health                               |
| **Parts**       | Add a part · Part detail                                                |
| **Documents**   | Add · Detail                                                            |
| **Other entry** | Expense · Odometer · Reminder                                           |
| **Settings**    | Units & currency · Notifications · Appearance · Privacy & security      |

---

## Getting started

### Prerequisites

| Requirement        | Version    | Notes                                      |
| ------------------ | ---------- | ------------------------------------------ |
| **Node.js**        | 20.19+     | `nvm use` picks it up from `.nvmrc`        |
| **npm**            | 10+        | Ships with Node 20                         |
| **Docker**         | any recent | For Postgres and MinIO locally             |
| **Xcode**          | 15+        | iOS builds only — macOS                    |
| **Android Studio** | Hedgehog+  | Android builds only                        |
| **EAS CLI**        | latest     | `npm install -g eas-cli`, for store builds |

### 1. Install

```bash
git clone <your-repo-url> carbuddy && cd carbuddy && npm install
```

### 2. Build the shared domain package

Both apps depend on it, so this comes first.

```bash
npm run build -w @carbuddy/domain
```

### 3. Start the database

```bash
docker compose up -d postgres
```

### 4. Configure and migrate the API

```bash
cp apps/api/.env.example apps/api/.env
```

The defaults work for local development. Then:

```bash
npm run prisma:generate -w @carbuddy/api && npm run prisma:migrate -w @carbuddy/api
```

### 5. Seed demo data

Creates a year of realistic fill-ups — including a deliberate efficiency dip so the anomaly
detector has something to find — plus service history, parts, documents and expenses.

```bash
npm run prisma:seed -w @carbuddy/api
```

Sign in with **`demo@carbuddy.app`** / **`carbuddy-demo-2026`**.

### 6. Run the API

```bash
npm run api:dev
```

Listening on `http://localhost:4000`, with interactive docs at
[localhost:4000/docs](http://localhost:4000/docs).

### 7. Build a development client

**Expo Go cannot run this app** — it uses native modules (SQLite, SecureStore, biometrics,
notifications). Build a custom development client once, then reuse it for all JS changes:

```bash
npm run build:dev:ios -w @carbuddy/mobile
```

```bash
npm run build:dev:android -w @carbuddy/mobile
```

Install the resulting build on your simulator or device.

### 8. Run the app

```bash
npm run mobile
```

> **Physical device?** Set `API_URL` in `apps/mobile/.env` to your machine's LAN address —
> `http://192.168.1.x:4000`. `localhost` on a phone means the phone itself.

### Verify everything works

```bash
npm test && npm run typecheck && npm run lint
```

Expected: **198 domain tests**, **29 API tests**, three clean typechecks, clean lint.

---

## Scripts

### Root

| Command                                 | Does                           |
| --------------------------------------- | ------------------------------ |
| `npm test`                              | Domain and API suites          |
| `npm run typecheck`                     | Typecheck every workspace      |
| `npm run lint` / `lint:fix`             | ESLint across the monorepo     |
| `npm run format` / `format:check`       | Prettier                       |
| `npm run domain:test`                   | Domain tests only — sub-second |
| `npm run api:dev`                       | API in watch mode              |
| `npm run mobile`                        | Expo dev server                |
| `npm run mobile:ios` / `mobile:android` | Build and run natively         |

### Mobile — `-w @carbuddy/mobile`

| Command                                 | Does                                           |
| --------------------------------------- | ---------------------------------------------- |
| `start`                                 | Dev server against a development client        |
| `prebuild`                              | Regenerate `ios/` and `android/`               |
| `assets`                                | Regenerate placeholder icons and splash images |
| `build:dev:ios` / `build:dev:android`   | Development client                             |
| `build:preview:android`                 | Internal QA `.apk`                             |
| `build:prod:ios` / `build:prod:android` | Store builds                                   |
| `submit:ios` / `submit:android`         | Upload to App Store Connect / Google Play      |

### API — `-w @carbuddy/api`

| Command                            | Does                         |
| ---------------------------------- | ---------------------------- |
| `start:dev`                        | Watch mode                   |
| `prisma:migrate` / `prisma:deploy` | Migrations, dev / production |
| `prisma:studio`                    | Browse the database          |
| `prisma:seed`                      | Demo data                    |
| `test:cov`                         | Tests with coverage          |

---

## Building for the stores

Three environments ship as **three separate apps** with distinct bundle identifiers, so all
three can be installed side by side without overwriting each other or sharing a keychain,
database or push token.

| Environment | Bundle id                  | Scheme             | Channel       |
| ----------- | -------------------------- | ------------------ | ------------- |
| Development | `com.carbuddy.app.dev`     | `carbuddy-dev`     | `development` |
| Staging     | `com.carbuddy.app.staging` | `carbuddy-staging` | `staging`     |
| Production  | `com.carbuddy.app`         | `carbuddy`         | `production`  |

**iOS `.ipa` for the App Store:**

```bash
npm run build:prod:ios -w @carbuddy/mobile
```

**Android `.aab` for Google Play:**

```bash
npm run build:prod:android -w @carbuddy/mobile
```

**Android `.apk` for direct install:**

```bash
eas build --profile production-apk --platform android
```

Versions are managed remotely with `autoIncrement`, since hardcoded build numbers cause
duplicate-build rejections from both stores.

Credentials setup, the pre-release checklist and rollback procedure are in
**[docs/RELEASE.md](docs/RELEASE.md)**.

> **Before shipping:** `apps/mobile/assets/*.png` are generated placeholders so the project
> builds end to end. See [`apps/mobile/assets/README.md`](apps/mobile/assets/README.md) for
> the real requirements.

---

## Architecture

```
┌─────────────────── Mobile (Expo / React Native) ───────────────────┐
│  Screens ── Design system (M3 Expressive tokens + 22 components)   │
│     │                                                              │
│     ├── Stores (Zustand)                                           │
│     ├── Repositories ──► SQLite (source of truth) ──► Sync queue   │
└─────┼──────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│              @carbuddy/domain                            │
│   pure · deterministic · no clock · no I/O · shared      │
│   fuel · intervals · costs · reminders · merge · health  │
└─────────────────────────────────────────────────────────┘
      ▲
      │
┌─────┴──────────────────── API (NestJS) ────────────────────────────┐
│  Auth · Sync · Analytics · Notifications · Attachments · Devices   │
└────────────────────────────┬───────────────────────────────────────┘
                             ▼
                        PostgreSQL
```

**The central decision:** every business rule lives in `@carbuddy/domain`, which depends on
nothing and never reads the system clock. That single constraint is what makes the app work
offline (the dashboard is computed on-device, with no separate online path to drift), makes
the server's notifications agree with the app's screens (same functions, one implementation),
and makes the hard logic testable without a device or a database.

Full rationale and trade-offs: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** ·
Design system: **[docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md)** ·
API reference: **[docs/API.md](docs/API.md)**

---

## Testing

```bash
npm test
```

**227 tests.** The domain suite runs in under half a second with no mocks and no test
database, and covers the calculations that would be hardest to notice going wrong:

- **Fuel economy** — full-tank measurement, partial fills, missed fills, same-odometer
  entries, and the "average of averages" trap that makes naive implementations wrong
- **Service intervals** — time vs. mileage, month-end arithmetic (six months after 31 August
  is 28 February, not 3 March), mileage-to-date projection
- **Anomaly detection** — flags a real decline while staying silent on a noisy vehicle
- **Sync merge** — different-field edits both survive; only true collisions conflict; a
  delete-then-edit race resurrects and flags rather than silently vanishing
- **Notification planning** — lead times, quiet hours across midnight, daily caps, timezones
- **Crypto** — round-trip, tamper rejection, wrong-key rejection, fingerprint stability

Coverage thresholds are enforced in `vitest.config.ts`, so a drop fails the build.

---

## Project structure

```
carbuddy/
├── packages/domain/            @carbuddy/domain — 198 tests, 94.4% coverage
│   ├── src/
│   │   ├── common/             money, masking, VIN validation, shared types
│   │   ├── units/              distance, volume, the FuelEfficiency value object
│   │   ├── fuel/               consumption engine, statistics, anomaly detection
│   │   ├── maintenance/        intervals, components, starter schedules
│   │   ├── documents/          expiry evaluation
│   │   ├── expenses/           projection and de-duplication, summaries
│   │   ├── reminders/          notification planner
│   │   ├── vehicle/            profile, odometer validation and projection
│   │   ├── analytics/          health scoring, insights, dashboard composition
│   │   └── sync/               three-way merge, queue coalescing, backoff
│   └── test/                   10 suites
│
├── apps/mobile/                React Native + Expo — 97 files
│   ├── src/
│   │   ├── app/                34 screens (Expo Router)
│   │   ├── design-system/      7 token modules, 22 components, ThemeProvider
│   │   ├── data/               SQLite schema, repositories, sync engine
│   │   ├── features/           auth, vehicles, fuel, settings, sync, dashboard
│   │   └── lib/                API client, secure session, notifications, biometrics
│   ├── app.config.ts           environment-aware Expo config
│   └── eas.json                dev / preview / staging / production profiles
│
├── apps/api/                   NestJS + Prisma — 13 modules
│   ├── src/modules/            auth, sync, analytics, notifications, vehicles, …
│   ├── prisma/schema.prisma    20 models
│   └── Dockerfile              multi-stage, non-root
│
├── docs/                       architecture, design system, release, API
└── .github/workflows/ci.yml    domain · api · mobile · lint
```

---

## Troubleshooting

**`Cannot find module '@carbuddy/domain'`**
The domain package isn't built. Run `npm run build -w @carbuddy/domain`.

**App crashes immediately in Expo Go**
Expected — Expo Go can't load this app's native modules. Build a development client.

**`P1001: Can't reach database server`**
Postgres isn't up. `docker compose up -d postgres`, then check `docker compose ps`.

**Mobile app can't reach the API on a physical device**
`localhost` on a phone is the phone. Set `API_URL` to your machine's LAN IP in
`apps/mobile/.env`.

**Notifications don't arrive**
Simulators can't receive push. Local scheduled notifications work; push needs a real device
with a registered token. Check the permission state in Settings → Notifications.

**`FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes`**
It needs 64 hex characters. Generate one with `openssl rand -hex 32`.

**EAS build fails on a missing asset**
The placeholder assets were deleted. Regenerate with `npm run assets -w @carbuddy/mobile`.

---

## Roadmap

**Shipped in this MVP** — vehicle profiles · fuel tracking and economy analysis · anomaly
detection · maintenance history and reminders · component lifecycle · expenses · document
vault with expiry alerts · dashboards and analytics · vehicle health · multiple vehicles ·
offline-first storage with conflict-aware sync · local and push notifications · biometric
app lock · production build configuration for both stores.

**Deliberately deferred** — OCR receipt scanning, CSV import/export, PDF reports,
maintenance forecasting, AI-assisted insights, family sharing, service-centre and insurance
integrations, telematics.

The schema and module boundaries anticipate them. The **fleet layer** — organisations,
memberships, vehicle assignments, cost centres — is already modelled but unexposed, because
retrofitting organisation ownership later would mean re-keying every authorisation check in
the codebase.

---

## Author

**Ramon Logan Jr.**

Designed and built CarBuddy end to end — the shared domain layer, the Material 3 Expressive
design system, the offline-first mobile client, and the NestJS backend.

<div align="center">
<br />

**Know your car. Understand its costs. Maintain it on time. Keep everything in one place.**

</div>
