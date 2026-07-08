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

  gcp: {
    projectId: process.env.GCP_PROJECT_ID || '',
    clientEmail: process.env.GCP_CLIENT_EMAIL || '',
    privateKey: (process.env.GCP_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    bucket: process.env.GCP_STORAGE_BUCKET || '',
    // Private documents bucket (UBLA, NO allUsers binding) — signed-URL access
    // only. Accepts both env spellings used across the PRDs.
    privateBucket:
      process.env.GCP_PRIVATE_BUCKET ||
      process.env.GCP_STORAGE_PRIVATE_BUCKET ||
      '',
    signedUrlTtlSeconds: parseInt(
      process.env.GCP_SIGNED_URL_TTL_SECONDS || '600',
      10,
    ),
    location: process.env.GCP_STORAGE_LOCATION || 'US',
    maxUploadBytes: parseInt(
      process.env.GCP_MAX_UPLOAD_BYTES || '209715200',
      10,
    ),
  },

  marketplace: {
    platformFeePercent: parseInt(process.env.PLATFORM_FEE_PERCENT || '5', 10),
    orderNumberPrefix: process.env.MARKETPLACE_ORDER_PREFIX || 'ORD',
    checkoutGroupPrefix: process.env.MARKETPLACE_CHECKOUT_PREFIX || 'CHK',
    platformStoreName:
      process.env.MARKETPLACE_PLATFORM_STORE_NAME || 'Bennie Cooperative Store',
    lowStockThreshold: parseInt(process.env.LOW_STOCK_THRESHOLD || '10', 10),
    refundWindowDays: parseInt(
      process.env.MARKETPLACE_REFUND_WINDOW_DAYS || '14',
      10,
    ),
    cartMaxItems: parseInt(process.env.CART_MAX_ITEMS || '30', 10),
    cartMaxQtyPerItem: parseInt(process.env.CART_MAX_QTY_PER_ITEM || '999', 10),
    merchantMaxActiveListings: parseInt(
      process.env.MERCHANT_MAX_ACTIVE_LISTINGS || '100',
      10,
    ),
    merchantMinPayoutNgn: parseInt(
      process.env.MERCHANT_MIN_PAYOUT_NGN || '1000',
      10,
    ),
  },

  prembly: {
    appId: process.env.PREMBLY_APP_ID || '',
    apiKey: process.env.PREMBLY_X_API_KEY || '',
    baseUrl: process.env.PREMBLY_BASE_URL || 'https://api.prembly.com',
  },

  requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',

  seerbit: {
    secretKey: process.env.SEERBIT_SECRET_KEY || '',
    publicKey: process.env.SEERBIT_PUBLIC_KEY || '',
    // REST API base — NOT checkout.* (which only serves the inline JS SDK).
    baseUrl: process.env.SEERBIT_BASE_URL || 'https://seerbitapi.com/api/v2',
    // Placeholder: SeerBit V2 publishes no default webhook signature scheme, so
    // this stays unused — the webhook credits only via server-side re-query.
    webhookSecret: process.env.SEERBIT_WEBHOOK_SECRET || '',
  },

  wallet: {
    numberPrefix: process.env.WALLET_NUMBER_PREFIX || 'WLT',
    // Live bank payouts (disbursement) — OFF this phase; withdrawals are a
    // ledger + approval workflow until SeerBit disbursement is enabled.
    livePayouts: process.env.WALLET_LIVE_PAYOUTS === 'true',
    limits: {
      defaultDaily: parseInt(process.env.DEFAULT_DAILY_LIMIT || '500000', 10),
      defaultMonthly: parseInt(
        process.env.DEFAULT_MONTHLY_LIMIT || '5000000',
        10,
      ),
      minDeposit: parseInt(process.env.MIN_DEPOSIT_AMOUNT || '100', 10),
      maxDeposit: parseInt(process.env.MAX_DEPOSIT_AMOUNT || '1000000', 10),
      minWithdrawal: parseInt(process.env.MIN_WITHDRAWAL_AMOUNT || '500', 10),
      maxWithdrawal: parseInt(
        process.env.MAX_WITHDRAWAL_AMOUNT || '500000',
        10,
      ),
    },
    fees: {
      cardDepositPercent: parseFloat(
        process.env.CARD_DEPOSIT_FEE_PERCENT || '1.5',
      ),
      withdrawalFlat: parseInt(process.env.WITHDRAWAL_FEE_FLAT || '50', 10),
      withdrawalPercent: parseFloat(
        process.env.WITHDRAWAL_FEE_PERCENT || '0.1',
      ),
      maxWithdrawalFee: parseInt(process.env.MAX_WITHDRAWAL_FEE || '500', 10),
      externalTransferFlat: parseInt(
        process.env.EXTERNAL_TRANSFER_FEE_FLAT || '50',
        10,
      ),
    },
    thresholds: {
      autoApproveWithdrawal: parseInt(
        process.env.AUTO_APPROVE_WITHDRAWAL_THRESHOLD || '50000',
        10,
      ),
      manualReviewTransaction: parseInt(
        process.env.MANUAL_REVIEW_TRANSACTION_THRESHOLD || '500000',
        10,
      ),
    },
  },

  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  },

  equipment: {
    bookingPrefix: process.env.EQUIPMENT_BOOKING_PREFIX || 'EQB',
    maxBookingDays: parseInt(process.env.MAX_BOOKING_DAYS || '30', 10),
    overdueFeePerDay: parseInt(process.env.OVERDUE_FEE_PER_DAY || '0', 10),
    cancellationFullRefundHours: parseInt(
      process.env.CANCELLATION_FULL_REFUND_HOURS || '24',
      10,
    ),
    depositPercent: parseInt(process.env.DEPOSIT_PERCENTAGE || '20', 10),
    gpsUpdateIntervalSeconds: parseInt(
      process.env.GPS_UPDATE_INTERVAL_SECONDS || '30',
      10,
    ),
    overspeedThresholdKmh: parseInt(
      process.env.OVERSPEED_THRESHOLD_KMH || '80',
      10,
    ),
    geofenceAlertEnabled: process.env.GEOFENCE_ALERT_ENABLED !== 'false',
  },

  contributions: {
    groupPrefix: process.env.CONTRIBUTION_GROUP_PREFIX || 'CGP',
    maxGroupSize: parseInt(process.env.MAX_GROUP_SIZE || '50', 10),
    defaultLateFeePercent: parseInt(
      process.env.DEFAULT_LATE_FEE_PERCENT || '5',
      10,
    ),
    defaultMissLimit: parseInt(process.env.DEFAULT_MISS_LIMIT || '3', 10),
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
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:3000',
      'https://bennie-connect-two.vercel.app',
    ],
  },

  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
}));
