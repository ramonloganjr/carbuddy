# Release runbook

Builds run on EAS. Three environments ship as three separate apps with distinct bundle
identifiers, so development, staging and production can all be installed on one device
without overwriting each other or sharing a keychain, database or push token.

| Environment | Bundle id                  | Scheme             | Channel       |
| ----------- | -------------------------- | ------------------ | ------------- |
| Development | `com.carbuddy.app.dev`     | `carbuddy-dev`     | `development` |
| Staging     | `com.carbuddy.app.staging` | `carbuddy-staging` | `staging`     |
| Production  | `com.carbuddy.app`         | `carbuddy`         | `production`  |

---

## One-time setup

```bash
npm install -g eas-cli && eas login
```

```bash
eas init --id <your-expo-project-id>
```

Put the project id in `apps/mobile/.env` as `EAS_PROJECT_ID`.

### iOS credentials

```bash
eas credentials --platform ios
```

EAS can manage the distribution certificate and provisioning profiles, which is the
recommended path — it renews them before expiry rather than failing a build the morning
of a release.

You still need, in App Store Connect:

- An app record matching `com.carbuddy.app`.
- An **APNs key** (`.p8`) uploaded to EAS for push. Prefer a key over a certificate:
  keys do not expire.
- The `appleId`, `ascAppId` and `appleTeamId` filled into `eas.json` under `submit`.

`app.config.ts` already declares the entitlements and usage strings. Note that
`aps-environment` switches to `production` only for the production environment —
a production build with a development APNs entitlement silently fails to receive push.

### Android credentials

```bash
eas credentials --platform android
```

Let EAS generate and store the upload keystore. **Do not lose it** — Google Play ties an
app to its upload key, and recovering from a lost one requires a support request.

For Play submission, create a Google Cloud service account with the _Service Account
User_ role, grant it access in the Play Console, and save the JSON at
`apps/mobile/credentials/google-play-service-account.json`. That path is gitignored.

Also required in the Play Console: the app record for `com.carbuddy.app`, and a Data
Safety declaration covering location-adjacent data (odometer readings), photos
(receipts) and personal identifiers (document numbers).

---

## Building

**Development client** — needed because the app uses native modules that Expo Go cannot
load (SQLite, SecureStore, biometrics, notifications):

```bash
npm run build:dev:ios -w @carbuddy/mobile
```

**Internal QA `.apk`** — directly installable, no Play Store involved:

```bash
npm run build:preview:android -w @carbuddy/mobile
```

**Production:**

```bash
npm run build:prod -w @carbuddy/mobile
```

That produces an `.ipa` for the App Store and an `.aab` for Google Play. For a
production-configured `.apk` (enterprise distribution, device farms):

```bash
eas build --profile production-apk --platform android
```

`autoIncrement` is enabled on the staging and production profiles, and versions are
managed remotely (`appVersionSource: remote`). Hardcoding `buildNumber` or `versionCode`
causes duplicate-build rejections from both stores.

---

## Submitting

```bash
npm run submit:ios -w @carbuddy/mobile
```

```bash
npm run submit:android -w @carbuddy/mobile
```

Android submits to the `internal` track as a **draft** by default. Promote through
internal → closed → open → production in the Play Console rather than shipping straight
to production.

---

## Pre-release checklist

**Correctness**

```bash
npm test && npm run typecheck
```

- [ ] Fuel economy verified by hand against two real fill-ups
- [ ] A mileage-based and a date-based reminder both fire at the expected time
- [ ] Airplane mode: create, edit and delete records; reconnect; confirm all three synced
- [ ] Force a conflict from two devices; confirm the merge keeps both field edits

**Accessibility**

- [ ] VoiceOver and TalkBack pass over dashboard, fuel entry and documents
- [ ] Largest OS font size: no clipping, no overlap, no lost actions
- [ ] Reduce motion on: transitions still perceptible, nothing travels
- [ ] Every status legible in a greyscale screenshot

**Platform**

- [ ] Notification permission prompt appears _after_ the explainer screen
- [ ] Deep links open the right record from a cold start, not just when warm
- [ ] Android back button dismisses sheets rather than the screen behind them
- [ ] Tablet and unfolded foldable layouts are not stretched phone layouts

**Backend**

- [ ] Migrations applied: `npm run prisma:deploy -w @carbuddy/api`
- [ ] `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are set, long, and different
- [ ] `FIELD_ENCRYPTION_KEY` is 64 hex characters and **backed up** — losing it makes
      every encrypted VIN and document number permanently unreadable
- [ ] `/health/ready` returns `ok` against the production database
- [ ] Swagger is not exposed (it is disabled automatically when `NODE_ENV=production`)

---

## Rollback

**Over-the-air** — for a JavaScript-only regression, republish the previous update to
the channel. This does not require a store review:

```bash
eas update --branch production --message "Roll back to <sha>"
```

**Native** — a native regression needs a new build and a store submission. iOS: use
Phased Release so a bad build reaches a small fraction first. Android: staged rollout
percentages, halted from the Play Console.

**Database** — Prisma migrations are forward-only. Any migration that drops or renames a
column must ship in two releases: first make the new shape write-compatible, deploy and
confirm, then remove the old shape. A single-step destructive migration cannot be rolled
back once clients have written to it.
