# Architecture

## The central decision: a shared, pure domain package

`@carbuddy/domain` holds every business rule in the product and depends on nothing —
no React, no Prisma, no SQLite, no `fetch`, no `Date.now()`. Time enters as a
parameter on every function that needs it.

This is the decision the rest of the architecture follows from.

### What it makes possible

**Offline-first stops being a feature and becomes the default.** The dashboard is not
"a cached copy of a server response". It is computed on the device from local rows,
every time, in a few milliseconds. There is no separate online code path that could
drift from the offline one, because there is no online code path.

**The server cannot contradict the app.** When the nightly job decides whether to push
"your fuel economy has dropped 18%", it calls `detectEfficiencyAnomaly` — the same
function, with the same thresholds, that produced the figure on the user's screen. Two
independent implementations of a formula will diverge; the only reliable fix is to have
one implementation.

**The hard logic is testable without a device or a database.** The consumption engine,
interval evaluator, merge resolver and notification planner are all pure functions.
198 tests run in under a second with no mocks.

The package is built twice — ESM for Metro, CommonJS for NestJS — so both consumers get
a native import without interop shims.

---

## Mobile

### Data flow

```
User action
    │
    ▼
Repository.create/update/delete
    │
    ├─ writes the row locally, marks it dirty        ┐ one SQLite transaction
    └─ appends a mutation to the sync queue          ┘
    │
    ▼
UI re-reads from SQLite and re-renders (no network involved)

        …later, whenever connectivity allows…

SyncEngine.sync()
    ├─ push: coalesce → send → apply results
    └─ pull: fetch changes since cursor → merge
```

The local write and the queue entry are committed together. If the row were written and
the queue entry lost, the change would live on the device forever and never reach the
server — the worst possible failure for a product whose promise is "your records are
safe". One transaction makes that impossible.

### Sync

**Idempotency.** Every mutation carries a client-generated id. The server records
applied ids and answers `duplicate` on a retry. Mobile requests fail _after_ the server
commits far more often than people expect; without this, a dropped response duplicates
a fill-up.

**Optimistic concurrency.** The client sends the `version` it edited against. If the row
has moved on, the server returns a conflict with its copy rather than overwriting.

**Field-level three-way merge.** Given the common ancestor, the client merges per field.
Two devices that edited _different_ fields both keep their edit — plain last-write-wins
would silently throw one away. Only genuine same-field collisions escalate, resolved
deterministically (newer timestamp, then device id) and reported so the discarded value
can be offered back to the user rather than vanishing.

**Coalescing.** Four offline edits to one record become one mutation before sending.

**Backoff with jitter.** When connectivity returns after an outage, every queued device
retries at once. The jitter spreads them; without it they arrive in synchronised waves.

### Notifications

The domain planner produces a deterministic, content-keyed plan. The device diffs it
against what the OS already holds and issues only the difference — re-registering
everything on each launch would churn dozens of OS entries and eventually collide with
iOS's 64-pending-notification cap.

The server runs the same planner nightly and pushes, which covers the case local
notifications structurally cannot: a user who has not opened the app in two months.

---

## Backend

Layered so that HTTP, business rules and persistence stay separable:

- **Controllers** — HTTP shape, validation, versioning. No logic.
- **Services** — orchestration, authorisation, transactions.
- **Domain** — the calculations, in the shared package.
- **Prisma** — persistence only.

### Security posture

| Concern           | Approach                                                                    |
| ----------------- | --------------------------------------------------------------------------- |
| Passwords         | Argon2id, 19 MiB / 2 iterations (OWASP baseline)                            |
| Access tokens     | Short-lived JWT, 15 minutes, subject re-checked against the database        |
| Refresh tokens    | Opaque random bytes, stored hashed, rotated on every use                    |
| Token theft       | Reuse of a rotated token revokes the whole family                           |
| Sensitive columns | VIN, engine and document numbers encrypted with AES-256-GCM                 |
| Encrypted lookup  | Deterministic HMAC fingerprint, so equality search works without decryption |
| Enumeration       | Identical error and timing for unknown email and wrong password             |
| Brute force       | Per-endpoint throttling plus account lockout after repeated failures        |
| Authorisation     | User id comes from the validated token, never from a parameter or body      |
| Mass assignment   | Sync writes go through per-entity allow-lists                               |
| File uploads      | Server-generated keys, MIME allow-list, size cap, short-lived signed URLs   |
| Transport         | TLS terminated at the proxy; `trust proxy` limited to one hop               |
| Config            | Fail-fast validation; production refuses to start without real secrets      |

Files never pass through the API. Clients get a pre-signed URL and talk to object
storage directly, which keeps multi-megabyte receipt photos off the application servers
and means write access is a URL that expires in minutes rather than a credential
shipped inside the app.

---

## Data model notes

**Money is an integer count of minor units.** Never a float, never a decimal type.
Summing thousands of records in floating point accumulates visible drift, and a
spending total that is off by a cent is a total nobody trusts.

**Distances are kilometres, volumes are litres, everywhere below the presentation
layer.** Imperial input is converted at the edge. Mixed units in storage is how a
product ends up with a fuel figure that is wrong by 20% for one class of user.

**Fuel efficiency is stored as the pair it was measured from**, not as a pre-divided
number. `FuelEfficiency { kilometres, litres }` exists specifically so that combining
segments sums both components and divides once. The mean of 10 km/L and 20 km/L is not
15 km/L unless the two segments covered identical distance — and that bug is invisible
until someone checks the arithmetic by hand.

**Soft deletes everywhere.** A hard delete cannot propagate to an offline device: it
would have no way to learn the row ever existed, and would push it back on next sync.

---

## Deliberate trade-offs

**SQLite as source of truth, not cache.** More sync machinery to build, and conflict
resolution has to actually work. Bought: an app that is fully functional in a car park
with no signal, which is exactly where people log fill-ups.

**Local notifications _and_ server push.** Duplicated planning logic — mitigated by
sharing the planner. Bought: reminders that work offline _and_ reminders that still
arrive for a user who has not opened the app in two months.

**Colour generated from a seed, never hard-coded.** Slightly more startup work.
Bought: guaranteed contrast relationships in light, dark, high-contrast and any dynamic
palette, rather than a set of hexes that were checked once and quietly broke.

**Vehicle health capped when something is expired.** A weighted average alone rated a
car with a spotless service record and expired insurance in the eighties — "good". Any
lapse now caps the score into the "attention" band. The user can be told they are mostly
on top of things; they must never be told they are fine while something has lapsed.

**Fleet tables in the schema from day one, unused.** Organisations, memberships and
vehicle assignments are modelled but not exposed. Retrofitting organisation ownership
later means re-keying every authorisation check in the codebase — the one migration
that genuinely is hard to do afterwards.
