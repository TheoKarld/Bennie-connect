import { registerAs } from '@nestjs/config';

export default registerAs('configuration', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5566', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',

  app: {
    url: process.env.APP_URL || 'http://localhost:3000',
  },

  database: {
    uri:
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      'mongodb://localhost:27017/cooperative_farming',
    name:
      process.env.DB_NAME ||
      process.env.MONGODB_DB_NAME ||
      'cooperative_farming',
    host: process.env.MONGODB_HOST || 'localhost',
    port: parseInt(process.env.MONGODB_PORT || '27017', 10),
    user: process.env.MONGODB_USER || '',
    password: process.env.MONGODB_PASSWORD || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    expiration: process.env.JWT_EXPIRATION || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },

  adminJwt: {
    secret: process.env.ADMIN_JWT_SECRET || 'default-admin-secret-change-me',
    expiration: process.env.ADMIN_JWT_EXPIRATION || '15m',
    refreshSecret:
      process.env.ADMIN_JWT_REFRESH_SECRET ||
      'default-admin-refresh-secret-change-me',
    refreshExpiration: process.env.ADMIN_JWT_REFRESH_EXPIRATION || '7d',
  },

  cookie: {
    secure: (process.env.NODE_ENV || 'development') === 'production',
  },

  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ||
      'http://localhost:5566/api/v1/auth/google/callback',
  },

  oneSignal: {
    appId: process.env.ONESIGNAL_APP_ID || '',
    apiKey: process.env.ONESIGNAL_API_KEY || '',
    baseUrl:
      process.env.ONESIGNAL_BASE_URL ||
      process.env.ONESIGNAL_URL ||
      'https://api.onesignal.com',
    fromName: process.env.EMAIL_FROM_NAME || 'Bennie Connect',
    fromEmail: process.env.EMAIL_USER || '',
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },

  requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',

  seerbit: {
    secretKey: process.env.SEERBIT_SECRET_KEY || '',
    publicKey: process.env.SEERBIT_PUBLIC_KEY || '',
    baseUrl:
      process.env.SEERBIT_BASE_URL || 'https://checkout.seerbit.com/api/v2',
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'noreply@cooperativefarming.com',
  },

  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'https://bennie-connect-two.vercel.app'],
  },

  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
}));
