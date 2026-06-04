import { registerAs } from '@nestjs/config';

export default registerAs('configuration', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/cooperative_farming',
    host: process.env.MONGODB_HOST || 'localhost',
    port: parseInt(process.env.MONGODB_PORT, 10) || 27017,
    name: process.env.MONGODB_DB_NAME || 'cooperative_farming',
    user: process.env.MONGODB_USER || '',
    password: process.env.MONGODB_PASSWORD || '',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    expiration: process.env.JWT_EXPIRATION || '1d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },
  
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10,
  },
  
  seerbit: {
    secretKey: process.env.SEERBIT_SECRET_KEY || '',
    publicKey: process.env.SEERBIT_PUBLIC_KEY || '',
    baseUrl: process.env.SEERBIT_BASE_URL || 'https://checkout.seerbit.com/api/v2',
  },
  
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'noreply@cooperativefarming.com',
  },
  
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL, 10) || 60,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
}));
