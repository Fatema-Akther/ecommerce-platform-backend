import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  // const app = await NestFactory.create(AppModule);

  const app =
  await NestFactory.create<NestExpressApplication>(
    AppModule,
    {
      rawBody: true,
    },
  );

  // 🔐 Cookie parser (refresh token পড়ার জন্য)
  app.use(cookieParser());

  // 🌐 CORS (frontend ↔ backend with cookie)
  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((url) => url.trim())
    : ['http://localhost:3000'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true, // 🔥 HttpOnly cookie allow
  });

  // ✅ Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT || 3001;

  await app.listen(port, '0.0.0.0');
}

bootstrap();