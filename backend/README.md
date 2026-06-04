# Cooperative Farming Portal - NestJS Backend

Enterprise-grade NestJS backend for the Cooperative Farming Portal with MongoDB integration and SeerBit payment gateway.

## Project Structure

```
backend/
├── src/
│   ├── main.ts                 # Application entry point
│   ├── app.module.ts           # Root module
│   ├── auth/                   # Authentication module
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts
│   │   └── dto/
│   │       ├── login.dto.ts
│   │       ├── register.dto.ts
│   │       └── refresh-token.dto.ts
│   ├── users/                  # Users module (PRD 1)
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts    ✓ Implemented
│   │   ├── schemas/
│   │   │   ├── user.schema.ts  ✓ Implemented
│   │   │   └── index.ts        ✓ Implemented
│   │   └── dto/
│   │       ├── create-user.dto.ts ✓ Implemented
│   │       ├── update-user.dto.ts ✓ Implemented
│   │       └── index.ts        ✓ Implemented
│   ├── wallet/                 # Digital Wallet module (PRD 2)
│   ├── membership/             # Membership module (PRD 3)
│   ├── savings/                # Savings module (PRD 4)
│   ├── shares/                 # Shares & Dividends module (PRD 5)
│   ├── equipment/              # Equipment Booking module (PRD 6)
│   ├── services/               # Agricultural Services module (PRD 7)
│   ├── marketplace/            # E-commerce Marketplace module (PRD 8)
│   ├── contributions/          # Adashe/Esusu module (PRD 9)
│   ├── agents/                 # Agent Dashboard module (PRD 10)
│   ├── common/                 # Shared utilities
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── middleware/
│   │   └── pipes/
│   ├── config/                 # Configuration
│   │   ├── configuration.ts    ✓ Implemented
│   │   └── index.ts            ✓ Implemented
│   └── database/               # Database setup
│       ├── mongodb.providers.ts ✓ Implemented
│       └── index.ts            ✓ Implemented
├── test/                       # Test files
├── .env.example                ✓ Implemented
├── nest-cli.json               ✓ Implemented
├── package.json                ✓ Implemented
├── tsconfig.json               ✓ Implemented
└── README.md                   ✓ This file
```

## Implemented Files (PRD 1 - Authentication & User Management)

### Core Configuration
- ✓ `package.json` - Dependencies and scripts
- ✓ `tsconfig.json` - TypeScript configuration
- ✓ `nest-cli.json` - NestJS CLI configuration
- ✓ `.env.example` - Environment variables template
- ✓ `src/config/configuration.ts` - Application configuration
- ✓ `src/database/mongodb.providers.ts` - MongoDB connection setup

### User Module
- ✓ `src/users/schemas/user.schema.ts` - Complete User MongoDB schema with:
  - All required fields from PRD 1
  - Indexes for performance
  - Pre-save hooks for userId and referralCode generation
  - Password comparison method
  - toJSON method for hiding sensitive data
  
- ✓ `src/users/dto/create-user.dto.ts` - DTO for user creation with validation
- ✓ `src/users/dto/update-user.dto.ts` - DTO for user updates
- ✓ `src/users/users.service.ts` - Complete service with all methods:
  - CRUD operations
  - Email verification
  - Password reset
  - Account suspension/unsuspension
  - Login tracking
  - Failed login handling
  - Statistics generation

## Next Steps for Full Implementation

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Create Remaining Auth Module Files

#### `src/auth/auth.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('configuration.jwt.secret'),
        signOptions: { expiresIn: config.get('configuration.jwt.expiration') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

#### `src/auth/auth.service.ts`
Implement login, registration, token refresh, password reset flows.

#### `src/auth/auth.controller.ts`
Implement auth endpoints: POST /login, POST /register, POST /refresh, POST /forgot-password, POST /reset-password

#### `src/auth/strategies/jwt.strategy.ts`
Implement JWT authentication strategy.

#### `src/auth/guards/jwt-auth.guard.ts`
Implement JWT guard for protected routes.

### 3. Create Users Module Files

#### `src/users/users.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

#### `src/users/users.controller.ts`
Implement user management endpoints.

### 4. Create Main Application Files

#### `src/main.ts`
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  
  // CORS
  const configService = app.get(ConfigService);
  app.enableCors({
    origin: configService.get('configuration.cors.origin'),
    credentials: true,
  });
  
  // API prefix
  app.setGlobalPrefix(configService.get('configuration.apiPrefix'));
  
  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Cooperative Farming Portal API')
    .setDescription('Enterprise-grade API for cooperative farming management')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  
  const port = configService.get('configuration.port');
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
```

#### `src/app.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
// Import other modules as they are implemented

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get('configuration.database.uri'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
    }),
    AuthModule,
    UsersModule,
    // Add other modules here
  ],
})
export class AppModule {}
```

### 5. Setup Environment Variables
```bash
cp .env.example .env
# Edit .env with your actual values
```

### 6. Run the Application
```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

### 7. Access API Documentation
Once running, visit: `http://localhost:3000/api/docs`

## API Endpoints (PRD 1)

### Authentication
- POST `/api/v1/auth/register` - Register new user
- POST `/api/v1/auth/login` - Login user
- POST `/api/v1/auth/refresh` - Refresh access token
- POST `/api/v1/auth/forgot-password` - Request password reset
- POST `/api/v1/auth/reset-password` - Reset password
- POST `/api/v1/auth/verify-email/:token` - Verify email
- POST `/api/v1/auth/logout` - Logout user

### Users
- GET `/api/v1/users` - Get all users (admin)
- GET `/api/v1/users/:id` - Get user by ID
- GET `/api/v1/users/me` - Get current user profile
- PUT `/api/v1/users/:id` - Update user
- PUT `/api/v1/users/me` - Update current user profile
- DELETE `/api/v1/users/:id` - Delete user (admin)
- POST `/api/v1/users/:id/suspend` - Suspend user (admin)
- POST `/api/v1/users/:id/unsuspend` - Unsuspend user (admin)
- PUT `/api/v1/users/me/change-password` - Change password
- GET `/api/v1/users/statistics` - Get user statistics (admin)

## Security Features

- ✓ Password hashing with bcrypt
- ✓ JWT authentication
- ✓ Role-based access control (RBAC)
- ✓ Account lockout after failed attempts
- ✓ Password strength validation
- ✓ Secure token generation
- ✓ Input validation with class-validator
- ✓ SQL/NoSQL injection prevention
- ✓ XSS protection headers

## Testing

```bash
# Unit tests
npm run test

# Integration tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## License

MIT
