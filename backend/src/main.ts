import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import * as dns from 'dns';
import { AppModule } from './app.module';

// Some networks ship a flaky/misconfigured DNS resolver that refuses SRV
// lookups (querySrv ECONNREFUSED), which breaks the `mongodb+srv://` Atlas
// connection even though the cluster itself is reachable. Point Node's
// resolver at reliable public DNS servers so SRV resolution is dependable.
// Override via DNS_SERVERS (comma-separated) or disable with DNS_SERVERS="".
const dnsServers =
  process.env.DNS_SERVERS !== undefined
    ? process.env.DNS_SERVERS.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : ['8.8.8.8', '1.1.1.1'];
if (dnsServers.length > 0) {
  try {
    dns.setServers([...dnsServers, ...dns.getServers()]);
  } catch {
    // Ignore invalid overrides and fall back to the system resolver.
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 5550;
  const apiPrefix =
    configService.get<string>('configuration.apiPrefix') || 'api/v1';

  // Baseline security headers. crossOriginResourcePolicy is relaxed so the
  // Swagger UI and cross-origin SPA fetches keep working alongside CORS.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(cookieParser());

  // socket.io transport for the notification/real-time gateway.
  app.useWebSocketAdapter(new IoAdapter(app));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: configService.get<string[]>('configuration.cors.origin'),
    credentials: true,
  });

  app.setGlobalPrefix(apiPrefix);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Bennie Connect - Cooperative Farming Portal API')
    .setDescription('Enterprise-grade API for cooperative farming management')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  Logger.log(
    `Application is running on: http://localhost:${port}/${apiPrefix}`,
    'Bootstrap',
  );
  Logger.log(
    `Swagger docs available at: http://localhost:${port}/api/docs`,
    'Bootstrap',
  );
}
bootstrap();
