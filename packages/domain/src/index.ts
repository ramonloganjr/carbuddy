/**
 * @carbuddy/domain — the deterministic core of CarBuddy.
 *
 * Everything here is pure TypeScript: no React, no database, no network, no
 * reads of the system clock. Times and "now" always arrive as arguments. That
 * constraint is what lets the same fuel-economy, service-interval and ownership
 * calculations run unchanged in the React Native app (offline, instantly) and
 * in the NestJS API (for push notifications and server-side analytics) with no
 * risk of the two disagreeing about a number the user can see.
 */

// Common primitives
export * from './common/types.js';
export * from './common/money.js';
export * from './common/mask.js';

// Units & measurement
export * from './units/units.js';

// Fuel
export * from './fuel/types.js';
export * from './fuel/consumption.js';
export * from './fuel/statistics.js';
export * from './fuel/anomaly.js';

// Maintenance
export * from './maintenance/types.js';
export * from './maintenance/intervals.js';
export * from './maintenance/components.js';
export * from './maintenance/defaults.js';

// Documents
export * from './documents/types.js';
export * from './documents/expiry.js';

// Expenses
export * from './expenses/types.js';
export * from './expenses/projection.js';
export * from './expenses/summary.js';

// Reminders & notifications
export * from './reminders/types.js';
export * from './reminders/planner.js';

// Vehicle
export * from './vehicle/types.js';
export * from './vehicle/profile.js';

// Analytics
export * from './analytics/health.js';
export * from './analytics/insights.js';
export * from './analytics/dashboard.js';

// Sync
export * from './sync/types.js';
export * from './sync/merge.js';
export * from './sync/queue.js';

// Preferences
export * from './preferences.js';
