import { loadConfiguration } from './configuration';

const BASE_ENV = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
};

function withEnv(overrides: Record<string, string | undefined>, run: () => void): void {
  const original = { ...process.env };
  process.env = { ...BASE_ENV, ...overrides } as NodeJS.ProcessEnv;
  try {
    run();
  } finally {
    process.env = original;
  }
}

describe('loadConfiguration', () => {
  it('requires a database URL', () => {
    withEnv({ DATABASE_URL: undefined }, () => {
      expect(() => loadConfiguration()).toThrow(/DATABASE_URL/);
    });
  });

  it('allows development defaults outside production', () => {
    withEnv({ NODE_ENV: 'development' }, () => {
      const config = loadConfiguration();
      expect(config.environment).toBe('development');
      expect(config.jwt.accessSecret).toContain('dev-');
    });
  });

  /**
   * The whole point of fail-fast config: a production deploy missing a secret
   * must refuse to start rather than silently issue forgeable tokens.
   */
  it('demands real secrets in production', () => {
    withEnv({ NODE_ENV: 'production' }, () => {
      expect(() => loadConfiguration()).toThrow(/JWT_ACCESS_SECRET/);
    });
  });

  it('refuses identical access and refresh secrets in production', () => {
    const shared = 'x'.repeat(48);
    withEnv(
      {
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: shared,
        JWT_REFRESH_SECRET: shared,
        FIELD_ENCRYPTION_KEY: 'a'.repeat(64),
      },
      () => {
        expect(() => loadConfiguration()).toThrow(/must differ/);
      },
    );
  });

  it('refuses a short access secret in production', () => {
    withEnv(
      {
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'short',
        JWT_REFRESH_SECRET: 'y'.repeat(48),
        FIELD_ENCRYPTION_KEY: 'a'.repeat(64),
      },
      () => {
        expect(() => loadConfiguration()).toThrow(/at least 32 characters/);
      },
    );
  });

  it('refuses a malformed encryption key in production', () => {
    withEnv(
      {
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'x'.repeat(48),
        JWT_REFRESH_SECRET: 'y'.repeat(48),
        FIELD_ENCRYPTION_KEY: 'not-hex',
      },
      () => {
        expect(() => loadConfiguration()).toThrow(/64 hex characters/);
      },
    );
  });

  it('accepts a fully configured production environment', () => {
    withEnv(
      {
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'x'.repeat(48),
        JWT_REFRESH_SECRET: 'y'.repeat(48),
        FIELD_ENCRYPTION_KEY: 'a'.repeat(64),
        CORS_ORIGINS: 'https://app.carbuddy.app, https://carbuddy.app',
      },
      () => {
        const config = loadConfiguration();
        expect(config.environment).toBe('production');
        expect(config.corsOrigins).toEqual(['https://app.carbuddy.app', 'https://carbuddy.app']);
      },
    );
  });

  it('falls back to sane defaults for optional numbers', () => {
    withEnv({ PORT: 'not-a-number', THROTTLE_LIMIT: '-5' }, () => {
      const config = loadConfiguration();
      expect(config.port).toBe(4000);
      expect(config.throttle.limit).toBe(120);
    });
  });
});
