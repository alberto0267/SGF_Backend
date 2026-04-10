import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const httpAdapter = app.getHttpAdapter();
  httpAdapter.getInstance().set('trust proxy', 1);

  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // elimina propiedades no declaradas en el DTO
      forbidNonWhitelisted: true, // lanza error si llegan props extra
      transform: true,            // necesario para @Type() en DTOs anidados
    }),
  );

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:5173'],
  });

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`Application is running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap();
