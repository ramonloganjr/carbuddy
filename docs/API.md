# API reference

Base URL: `https://api.carbuddy.app` · All routes are versioned: `/v1/...`
Interactive docs at `/docs` in development and staging (disabled in production).

Authentication: `Authorization: Bearer <accessToken>` on everything except the routes
marked public.

---

## Errors

Every error has the same shape:

```json
{
  "statusCode": 409,
  "code": "conflict",
  "message": "This vehicle was changed somewhere else. Refresh and try again.",
  "details": { "serverVersion": 7 },
  "requestId": "…"
}
```

`code` is stable and safe to branch on; `message` is user-facing and may change.
Prisma errors are translated, never forwarded — a raw database message would expose
table and column names.

---

## Auth

| Method | Path                | Auth   | Notes                                                               |
| ------ | ------------------- | ------ | ------------------------------------------------------------------- |
| `POST` | `/v1/auth/sign-up`  | public | 5 req/min                                                           |
| `POST` | `/v1/auth/sign-in`  | public | 10 req/min; identical response for unknown email and wrong password |
| `POST` | `/v1/auth/refresh`  | public | Rotates the token; reuse of a rotated token revokes the family      |
| `POST` | `/v1/auth/sign-out` | bearer | Revokes the session                                                 |

All four return:

```json
{
  "userId": "…",
  "email": "…",
  "accessToken": "…",
  "refreshToken": "…",
  "expiresIn": 900
}
```

Access tokens live 15 minutes; refresh tokens 60 days and rotate on every use.

---

## Sync

The endpoint the mobile app uses for all writes.

### `POST /v1/sync/push`

```json
{
  "deviceId": "…",
  "mutations": [
    {
      "id": "client-generated-mutation-id",
      "entity": "fuel_record",
      "entityId": "uuid",
      "operation": "create",
      "payload": { "odometer_km": 41250, "litres": 38.4, "total_cost": 6210 },
      "baseVersion": 0,
      "createdAt": "2026-08-30T09:12:00.000Z",
      "deviceId": "…"
    }
  ]
}
```

At most 200 mutations per request. Each returns one of:

| `status`    | Meaning                                                       | Client action               |
| ----------- | ------------------------------------------------------------- | --------------------------- |
| `applied`   | Written; `record` carries the new version                     | Mark clean, drop from queue |
| `duplicate` | Already applied under this mutation id                        | Same as `applied`           |
| `conflict`  | Row changed since `baseVersion`; `server` is the current copy | Three-way merge, re-queue   |
| `rejected`  | Permanent failure; `reason` explains                          | Surface it — do not retry   |

**Idempotency is by mutation id.** Retrying after a lost response is safe and expected.

### `GET /v1/sync/pull?since=<iso>`

Returns everything changed at or after the cursor, grouped by entity, with a new
`cursor` and `hasMore`. Keep pulling while `hasMore` is true.

The cursor is inclusive of its instant, and clients de-duplicate: two rows can share a
millisecond, and an exclusive cursor would skip one of them permanently.

---

## Vehicles

| Method   | Path               | Notes                                             |
| -------- | ------------------ | ------------------------------------------------- |
| `GET`    | `/v1/vehicles`     | Identifiers masked                                |
| `GET`    | `/v1/vehicles/:id` | `?reveal=true` for unmasked VIN, engine and plate |
| `POST`   | `/v1/vehicles`     | Also seeds a starter service schedule             |
| `PATCH`  | `/v1/vehicles/:id` | Send `version` for optimistic concurrency         |
| `DELETE` | `/v1/vehicles/:id` | Soft delete                                       |

Unmasked identifiers come only from the single-vehicle endpoint, never from the list —
so a compromised session that scrapes the list does not walk away with every VIN.

---

## Analytics

### `GET /v1/analytics/vehicles/:vehicleId?economy=km_l`

Fuel statistics and monthly series, ownership cost summary, service status, component
wear, health score and ownership insights.

Computed with the same `@carbuddy/domain` functions the app runs locally, so these
figures cannot drift from what the user sees on screen.

---

## Attachments

| Method | Path                               | Notes                      |
| ------ | ---------------------------------- | -------------------------- |
| `POST` | `/v1/attachments/upload-url`       | Short-lived signed PUT URL |
| `GET`  | `/v1/attachments/:id/download-url` | Short-lived signed GET URL |

Files go device → object storage directly and never through the API. Storage keys are
server-generated; MIME types are allow-listed (JPEG, PNG, HEIC, WebP, PDF); 15 MB cap.

---

## Devices

| Method   | Path                    | Notes                              |
| -------- | ----------------------- | ---------------------------------- |
| `POST`   | `/v1/devices`           | Register or refresh the push token |
| `DELETE` | `/v1/devices/:deviceId` | Stop pushing to this device        |

---

## Health

| Method | Path            | Notes                                         |
| ------ | --------------- | --------------------------------------------- |
| `GET`  | `/health/live`  | Liveness. Checks nothing external, by design  |
| `GET`  | `/health/ready` | Readiness. Verifies the database is reachable |

A liveness probe that fails on a brief database blip makes the orchestrator restart
healthy pods, turning a small problem into an outage. Only readiness checks the database.

---

## Rate limits

Global: 10 requests/second burst, 120/minute sustained. Auth endpoints are tighter (see
above). Exceeding a limit returns `429` with `code: "rate_limited"`.
