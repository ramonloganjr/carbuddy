/**
 * Local SQLite schema.
 *
 * The device database is the app's source of truth, not a cache: every screen
 * reads from here, and the network layer's only job is to reconcile it with the
 * server in the background. That inversion is what makes the app work
 * identically on a plane and on wifi, with one code path rather than two.
 *
 * Sync columns appear on every user-owned table:
 *   - `version`      server-assigned counter, for detecting concurrent edits
 *   - `updated_at`   ISO-8601 UTC, for tie-breaking genuine conflicts
 *   - `deleted_at`   soft-delete tombstone, so a delete can propagate
 *   - `dirty`        1 when the row has local changes not yet acknowledged
 *   - `base_json`    the server copy this row was edited against, for the
 *                    three-way merge; null once clean
 */

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly statements: readonly string[];
}

const SYNC_COLUMNS = `
  version         INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT    NOT NULL,
  created_at      TEXT    NOT NULL,
  deleted_at      TEXT,
  dirty           INTEGER NOT NULL DEFAULT 0,
  base_json       TEXT
`;

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    statements: [
      `PRAGMA journal_mode = WAL;`,
      `PRAGMA foreign_keys = ON;`,

      `CREATE TABLE IF NOT EXISTS users (
        id              TEXT PRIMARY KEY NOT NULL,
        email           TEXT NOT NULL,
        display_name    TEXT,
        avatar_url      TEXT,
        ${SYNC_COLUMNS}
      );`,

      `CREATE TABLE IF NOT EXISTS user_preferences (
        user_id             TEXT PRIMARY KEY NOT NULL,
        distance_unit       TEXT NOT NULL DEFAULT 'km',
        volume_unit         TEXT NOT NULL DEFAULT 'l',
        economy_standard    TEXT NOT NULL DEFAULT 'km_l',
        pressure_unit       TEXT NOT NULL DEFAULT 'kpa',
        currency            TEXT NOT NULL DEFAULT 'USD',
        locale              TEXT,
        date_format         TEXT NOT NULL DEFAULT 'system',
        theme_mode          TEXT NOT NULL DEFAULT 'system',
        dynamic_colour      INTEGER NOT NULL DEFAULT 1,
        reduce_motion       INTEGER NOT NULL DEFAULT 0,
        haptics_enabled     INTEGER NOT NULL DEFAULT 1,
        biometric_lock      INTEGER NOT NULL DEFAULT 0,
        notifications_json  TEXT NOT NULL,
        default_vehicle_id  TEXT,
        onboarding_done_at  TEXT,
        ${SYNC_COLUMNS}
      );`,

      `CREATE TABLE IF NOT EXISTS vehicles (
        id                      TEXT PRIMARY KEY NOT NULL,
        user_id                 TEXT NOT NULL,
        nickname                TEXT NOT NULL,
        make                    TEXT NOT NULL DEFAULT '',
        model                   TEXT NOT NULL DEFAULT '',
        variant                 TEXT,
        model_year              INTEGER,
        body_type               TEXT,
        colour                  TEXT,
        engine_type             TEXT,
        engine_displacement_cc  INTEGER,
        cylinders               INTEGER,
        transmission            TEXT,
        drivetrain              TEXT,
        fuel_type               TEXT,
        fuel_tank_capacity_l    REAL,
        recommended_fuel_grade  TEXT,
        battery_json            TEXT,
        tyre_json               TEXT,
        vin                     TEXT,
        engine_number           TEXT,
        plate_number            TEXT,
        registration_number     TEXT,
        registration_country    TEXT,
        purchased_at            TEXT,
        purchase_price          INTEGER,
        purchase_odometer_km    REAL,
        currency                TEXT NOT NULL DEFAULT 'USD',
        dealer_name             TEXT,
        dealer_contact          TEXT,
        financing_json          TEXT,
        warranty_json           TEXT,
        current_odometer_km     REAL NOT NULL DEFAULT 0,
        odometer_updated_at     TEXT,
        photo_attachment_id     TEXT,
        is_primary              INTEGER NOT NULL DEFAULT 0,
        archived_at             TEXT,
        ${SYNC_COLUMNS}
      );`,
      `CREATE INDEX IF NOT EXISTS idx_vehicles_user ON vehicles(user_id, deleted_at);`,

      `CREATE TABLE IF NOT EXISTS fuel_records (
        id              TEXT PRIMARY KEY NOT NULL,
        vehicle_id      TEXT NOT NULL,
        filled_at       TEXT NOT NULL,
        odometer_km     REAL NOT NULL,
        litres          REAL NOT NULL,
        total_cost      INTEGER NOT NULL,
        currency        TEXT NOT NULL,
        fuel_type       TEXT NOT NULL DEFAULT 'gasoline',
        fuel_grade      TEXT,
        is_full_tank    INTEGER NOT NULL DEFAULT 1,
        missed_fill     INTEGER NOT NULL DEFAULT 0,
        station_name    TEXT,
        station_brand   TEXT,
        payment_method  TEXT,
        notes           TEXT,
        ${SYNC_COLUMNS},
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
      );`,
      // Ordered by odometer because that is the order consumption is computed in.
      `CREATE INDEX IF NOT EXISTS idx_fuel_vehicle_odo
         ON fuel_records(vehicle_id, deleted_at, odometer_km);`,
      `CREATE INDEX IF NOT EXISTS idx_fuel_vehicle_date
         ON fuel_records(vehicle_id, deleted_at, filled_at DESC);`,

      `CREATE TABLE IF NOT EXISTS maintenance_records (
        id                      TEXT PRIMARY KEY NOT NULL,
        vehicle_id              TEXT NOT NULL,
        category                TEXT NOT NULL,
        title                   TEXT,
        serviced_at             TEXT NOT NULL,
        odometer_km             REAL NOT NULL,
        provider_name           TEXT,
        provider_contact        TEXT,
        parts_cost              INTEGER NOT NULL DEFAULT 0,
        labour_cost             INTEGER NOT NULL DEFAULT 0,
        tax_cost                INTEGER NOT NULL DEFAULT 0,
        total_cost              INTEGER NOT NULL DEFAULT 0,
        currency                TEXT NOT NULL,
        parts_replaced_json     TEXT,
        warranty_months         INTEGER,
        warranty_distance_km    REAL,
        next_service_date       TEXT,
        next_service_odometer   REAL,
        notes                   TEXT,
        ${SYNC_COLUMNS},
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
      );`,
      `CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle
         ON maintenance_records(vehicle_id, deleted_at, serviced_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_maintenance_category
         ON maintenance_records(vehicle_id, category, serviced_at DESC);`,

      `CREATE TABLE IF NOT EXISTS maintenance_schedules (
        id                      TEXT PRIMARY KEY NOT NULL,
        vehicle_id              TEXT NOT NULL,
        category                TEXT NOT NULL,
        title                   TEXT NOT NULL,
        interval_months         INTEGER,
        interval_distance_km    REAL,
        last_serviced_at        TEXT,
        last_service_odometer   REAL,
        lead_time_days          INTEGER,
        lead_time_km            REAL,
        enabled                 INTEGER NOT NULL DEFAULT 1,
        notes                   TEXT,
        ${SYNC_COLUMNS},
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
      );`,
      `CREATE INDEX IF NOT EXISTS idx_schedules_vehicle
         ON maintenance_schedules(vehicle_id, deleted_at, enabled);`,

      `CREATE TABLE IF NOT EXISTS vehicle_components (
        id                      TEXT PRIMARY KEY NOT NULL,
        vehicle_id              TEXT NOT NULL,
        kind                    TEXT NOT NULL,
        label                   TEXT,
        brand                   TEXT,
        model                   TEXT,
        specification           TEXT,
        installed_at            TEXT NOT NULL,
        installed_odometer_km   REAL NOT NULL,
        purchase_price          INTEGER,
        currency                TEXT,
        expected_life_months    INTEGER,
        expected_life_km        REAL,
        warranty_expires_at     TEXT,
        warranty_distance_km    REAL,
        rotation_interval_km    REAL,
        last_rotated_odometer   REAL,
        removed_at              TEXT,
        removed_odometer_km     REAL,
        notes                   TEXT,
        ${SYNC_COLUMNS},
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
      );`,
      `CREATE INDEX IF NOT EXISTS idx_components_vehicle
         ON vehicle_components(vehicle_id, deleted_at, removed_at);`,

      `CREATE TABLE IF NOT EXISTS documents (
        id                      TEXT PRIMARY KEY NOT NULL,
        user_id                 TEXT NOT NULL,
        vehicle_id              TEXT,
        type                    TEXT NOT NULL,
        title                   TEXT NOT NULL,
        document_number         TEXT,
        issuer                  TEXT,
        issued_at               TEXT,
        expires_at              TEXT,
        notes                   TEXT,
        reminder_offsets_json   TEXT,
        reminder_enabled        INTEGER NOT NULL DEFAULT 1,
        archived_at             TEXT,
        ${SYNC_COLUMNS}
      );`,
      `CREATE INDEX IF NOT EXISTS idx_documents_expiry
         ON documents(user_id, deleted_at, expires_at);`,
      `CREATE INDEX IF NOT EXISTS idx_documents_vehicle
         ON documents(vehicle_id, deleted_at);`,

      `CREATE TABLE IF NOT EXISTS expenses (
        id              TEXT PRIMARY KEY NOT NULL,
        vehicle_id      TEXT NOT NULL,
        category        TEXT NOT NULL,
        title           TEXT,
        amount          INTEGER NOT NULL,
        currency        TEXT NOT NULL,
        incurred_at     TEXT NOT NULL,
        odometer_km     REAL,
        vendor          TEXT,
        notes           TEXT,
        source          TEXT NOT NULL DEFAULT 'manual',
        source_id       TEXT,
        recurrence_id   TEXT,
        ${SYNC_COLUMNS},
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
      );`,
      `CREATE INDEX IF NOT EXISTS idx_expenses_vehicle
         ON expenses(vehicle_id, deleted_at, incurred_at DESC);`,

      `CREATE TABLE IF NOT EXISTS reminders (
        id                  TEXT PRIMARY KEY NOT NULL,
        vehicle_id          TEXT,
        title               TEXT NOT NULL,
        body                TEXT,
        due_at              TEXT,
        due_odometer_km     REAL,
        lead_time_days      INTEGER,
        repeat_every_days   INTEGER,
        enabled             INTEGER NOT NULL DEFAULT 1,
        completed_at        TEXT,
        ${SYNC_COLUMNS}
      );`,

      `CREATE TABLE IF NOT EXISTS odometer_readings (
        id            TEXT PRIMARY KEY NOT NULL,
        vehicle_id    TEXT NOT NULL,
        odometer_km   REAL NOT NULL,
        recorded_at   TEXT NOT NULL,
        source        TEXT NOT NULL DEFAULT 'manual',
        source_id     TEXT,
        notes         TEXT,
        ${SYNC_COLUMNS},
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
      );`,
      `CREATE INDEX IF NOT EXISTS idx_odometer_vehicle
         ON odometer_readings(vehicle_id, deleted_at, recorded_at DESC);`,

      `CREATE TABLE IF NOT EXISTS attachments (
        id              TEXT PRIMARY KEY NOT NULL,
        owner_type      TEXT NOT NULL,
        owner_id        TEXT NOT NULL,
        file_name       TEXT NOT NULL,
        mime_type       TEXT NOT NULL,
        byte_size       INTEGER NOT NULL DEFAULT 0,
        /* Local cache path; the file itself never lives in SQLite. */
        local_uri       TEXT,
        /* Server object key. Downloads use a short-lived signed URL. */
        remote_key      TEXT,
        upload_state    TEXT NOT NULL DEFAULT 'pending',
        width           INTEGER,
        height          INTEGER,
        ${SYNC_COLUMNS}
      );`,
      `CREATE INDEX IF NOT EXISTS idx_attachments_owner
         ON attachments(owner_type, owner_id, deleted_at);`,

      /*
       * The offline mutation queue. Not sync-tracked itself — it *is* the
       * mechanism, and syncing the queue would be circular.
       */
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id              TEXT PRIMARY KEY NOT NULL,
        entity          TEXT NOT NULL,
        entity_id       TEXT NOT NULL,
        operation       TEXT NOT NULL,
        payload_json    TEXT NOT NULL,
        base_version    INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL,
        attempts        INTEGER NOT NULL DEFAULT 0,
        status          TEXT NOT NULL DEFAULT 'pending',
        last_error      TEXT,
        next_attempt_at TEXT,
        device_id       TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_queue_status ON sync_queue(status, next_attempt_at);`,
      `CREATE INDEX IF NOT EXISTS idx_queue_entity ON sync_queue(entity, entity_id);`,

      /* Conflicts held back for the user to resolve. */
      `CREATE TABLE IF NOT EXISTS sync_conflicts (
        id                TEXT PRIMARY KEY NOT NULL,
        entity            TEXT NOT NULL,
        entity_id         TEXT NOT NULL,
        local_json        TEXT NOT NULL,
        server_json       TEXT NOT NULL,
        conflicted_fields TEXT NOT NULL,
        detected_at       TEXT NOT NULL,
        resolved_at       TEXT
      );`,

      /* Notifications currently registered with the OS, for plan diffing. */
      `CREATE TABLE IF NOT EXISTS scheduled_notifications (
        key                 TEXT PRIMARY KEY NOT NULL,
        os_identifier       TEXT NOT NULL,
        fire_at             TEXT NOT NULL,
        kind                TEXT NOT NULL,
        vehicle_id          TEXT,
        source_id           TEXT NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS sync_state (
        key         TEXT PRIMARY KEY NOT NULL,
        value       TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );`,
    ],
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;
