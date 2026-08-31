import { Logger } from '@nestjs/common';

/**
 * Typed configuration, validated once at boot.
 *
 * Fail-fast is deliberate: a missing `JWT_ACCESS_SECRET` that defaults to some
 * placeholder would start a server that happily issues forgeable tokens. It is
 * far better for the process to refuse to start than to run insecurely, so
 * every required secret is checked here and the app exits if one is absent.
 */

export type Environment = 'development' | 'staging' | 'production' | 'test';

export interface AppConfig {
  environment: Environment;
  port: number;
  databaseUrl: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  storage: {
    bucket: string;
    region: string;
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    signedUrlTtlSeconds: number;
  };
  fieldEncryptionKey: string;
  expoAccessToken: string;
  corsOrigins: string[];
  throttle: { ttlSeconds: number; limit: number };
}

const logger = new Logger('Configuration');

function required(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable ${name}. See apps/api/.env.example.`);
  }
  return value;
}

function optional(value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value : fallback;
}

function integer(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfiguration(): AppConfig {
  const environment = optional(process.env.NODE_ENV, 'development') as Environment;
  const isProduction = environment === 'production';

  // Secrets are only mandatory outside development, so a fresh clone can boot
  // and run tests without a full secret setup — but production cannot.
  const secretOrDev = (name: string, devFallback: string): string =>
    isProduction ? required(name, process.env[name]) : optional(process.env[name], devFallback);

  const config: AppConfig = {
    environment,
    port: integer(process.env.PORT, 4000),
    databaseUrl: required('DATABASE_URL', process.env.DATABASE_URL),
    jwt: {
      accessSecret: secretOrDev('JWT_ACCESS_SECRET', 'dev-access-secret-not-for-production'),
      refreshSecret: secretOrDev('JWT_REFRESH_SECRET', 'dev-refresh-secret-not-for-production'),
      accessTtl: optional(process.env.JWT_ACCESS_TTL, '15m'),
      refreshTtl: optional(process.env.JWT_REFRESH_TTL, '60d'),
    },
    storage: {
      bucket: optional(process.env.STORAGE_BUCKET, 'carbuddy-attachments'),
      region: optional(process.env.STORAGE_REGION, 'us-east-1'),
      endpoint: optional(process.env.STORAGE_ENDPOINT, 'https://s3.amazonaws.com'),
      accessKeyId: optional(process.env.STORAGE_ACCESS_KEY_ID, ''),
      secretAccessKey: optional(process.env.STORAGE_SECRET_ACCESS_KEY, ''),
      signedUrlTtlSeconds: integer(process.env.STORAGE_SIGNED_URL_TTL_SECONDS, 900),
    },
    fieldEncryptionKey: secretOrDev('FIELD_ENCRYPTION_KEY', '0'.repeat(64)),
    expoAccessToken: optional(process.env.EXPO_ACCESS_TOKEN, ''),
    corsOrigins: optional(process.env.CORS_ORIGINS, '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    throttle: {
      ttlSeconds: integer(process.env.THROTTLE_TTL_SECONDS, 60),
      limit: integer(process.env.THROTTLE_LIMIT, 120),
    },
  };

  if (isProduction) {
    if (config.jwt.accessSecret === config.jwt.refreshSecret) {
      throw new Error(
        'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ: sharing them lets a ' +
          'leaked access-token secret mint refresh tokens.',
      );
    }
    if (config.jwt.accessSecret.length < 32) {
      throw new Error('JWT_ACCESS_SECRET must be at least 32 characters in production.');
    }
    if (!/^[0-9a-f]{64}$/i.test(config.fieldEncryptionKey)) {
      throw new Error('FIELD_ENCRYPTION_KEY must be 64 hex characters (32 bytes).');
    }
  } else {
    logger.warn(
      'Running with development defaults for secrets. Never do this outside local development.',
    );
  }

  return config;
}
