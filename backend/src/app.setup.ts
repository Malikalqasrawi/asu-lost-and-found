import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { ADMIN_HEADER } from './auth/admin-cookie.js';
import { EnvironmentVariables } from './config/env.validation.js';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<EnvironmentVariables, true>);
  app.use(helmet());
  // The app calls the API directly; only the admin website runs in a browser.
  app.enableCors({
    origin: config.get('ADMIN_SITE_ORIGIN', { infer: true }),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', ADMIN_HEADER],
    maxAge: 600,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
}
