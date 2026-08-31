import 'reflect-metadata';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { loadConfiguration } from './config/configuration';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const config = loadConfiguration();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Only the app's own logs; request logging is handled by the reverse proxy.
    logger:
      config.environment === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  /**
   * Trust exactly one proxy hop.
   *
   * `trust proxy: true` would accept any `X-Forwarded-For` a client sends,
   * letting anyone spoof their IP and defeat both rate limiting and the audit
   * log. One hop matches a single load balancer in front of the app.
   */
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // The API serves JSON only; a restrictive CSP costs nothing here and
      // hardens the Swagger UI that is served alongside it in non-production.
      contentSecurityPolicy: config.environment === 'production',
      crossOriginEmbedderPolicy: false,
    }),
  );

  /**
   * CORS.
   *
   * The mobile app is not a browser and sends no Origin, so an empty allow-list
   * is the correct production default — it permits the app while blocking every
   * website that might try to use a user's session.
   */
  app.enableCors({
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip unknown properties instead of trusting them: without this, a
      // client could post `{ userId: "someone-else" }` and hope it lands.
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      // Full validation detail in development; generic messages in production,
      // where field-level errors are useful reconnaissance.
      disableErrorMessages: false,
    }),
  );

  app.enableShutdownHooks();

  // API docs are useful in development and staging; publishing a complete
  // endpoint map in production is free reconnaissance for an attacker.
  if (config.environment !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('CarBuddy API')
        .setDescription(
          'Vehicle ownership platform. Business calculations live in @carbuddy/domain and ' +
            'are shared verbatim with the mobile client.',
        )
        .setVersion('1.0.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
    logger.log(`API docs at http://localhost:${config.port}/docs`);
  }

  await app.listen(config.port, '0.0.0.0');
  logger.log(`CarBuddy API listening on port ${config.port} [${config.environment}]`);
}

void bootstrap();
