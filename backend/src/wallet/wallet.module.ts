import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { WalletService } from './wallet.service';
import { SeerbitService } from './seerbit.service';
import { WalletController } from './wallet.controller';
import { SeerbitWebhookController } from './webhook.controller';
import { Wallet, WalletSchema } from './schemas/wallet.schema';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import {
  DepositRequest,
  DepositRequestSchema,
} from './schemas/deposit-request.schema';
import {
  WithdrawalRequest,
  WithdrawalRequestSchema,
} from './schemas/withdrawal-request.schema';
import { BankAccount, BankAccountSchema } from './schemas/bank-account.schema';
import { UsersModule } from '../users/users.module';
import { NotificationModule } from '../notifications/notification.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    UsersModule,
    NotificationModule,
    // AuthModule exports JwtAuthGuard (+ JwtStrategy via provider) used by the
    // wallet controller. Wallet is imported into AuthModule via forwardRef in
    // that module only for the registration hook; here we consume the guard.
    forwardRef(() => AuthModule),
    MongooseModule.forFeature([
      { name: Wallet.name, schema: WalletSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: DepositRequest.name, schema: DepositRequestSchema },
      { name: WithdrawalRequest.name, schema: WithdrawalRequestSchema },
      { name: BankAccount.name, schema: BankAccountSchema },
    ]),
  ],
  controllers: [WalletController, SeerbitWebhookController],
  providers: [WalletService, SeerbitService],
  exports: [WalletService],
})
export class WalletModule {}
