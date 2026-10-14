import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { getFrontendOrigins } from './config/frontend-origins';

const MAX_BODY_SIZE = '25mb';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(json({ limit: MAX_BODY_SIZE }));
  app.use(urlencoded({ limit: MAX_BODY_SIZE, extended: true }));

  app.enableCors({
    origin: getFrontendOrigins(configService.get<string>('FRONTEND_URL')),
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = configService.get<string>('PORT') ?? '3000';

  await app.listen(port, '0.0.0.0');
}
void bootstrap();
