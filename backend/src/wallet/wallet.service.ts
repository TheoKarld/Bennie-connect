import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Connection, Model, Types, ClientSession } from 'mongoose';
import { randomBytes } from 'crypto';
import { Wallet, WalletDocument } from './schemas/wallet.schema';
import {
  Transaction,
  TransactionCategory,
  TransactionDocument,
  TransactionType,
} from './schemas/transaction.schema';
import {
  DepositRequest,
  DepositRequestDocument,
} from './schemas/deposit-request.schema';
import {
  WithdrawalRequest,
  WithdrawalRequestDocument,
} from './schemas/withdrawal-request.schema';
import { UsersService } from '../users/users.service';
import { NotificationService } from '../notifications/notification.service';
import { SeerbitService } from './seerbit.service';
import { WalletException } from './wallet.errors';
import { NIGERIAN_BANKS, bankNameForCode } from './constants/nigerian-banks';

interface LedgerEntry {
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  description: string;
  narration?: string;
  reference: string;
  externalReference?: string;
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  counterparty?: Record<string, any>;
  seerBitData?: Record<string, any>;
  metadata?: Record<string, any>;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Wallet.name)
    private readonly walletModel: Model<WalletDocument>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(DepositRequest.name)
    private readonly depositRequestModel: Model<DepositRequestDocument>,
    @InjectModel(WithdrawalRequest.name)
    private readonly withdrawalRequestModel: Model<WithdrawalRequestDocument>,
    private readonly usersService: UsersService,
    private readonly notificationService: NotificationService,
    private readonly seerbitService: SeerbitService,
    private readonly configService: ConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // References & config
  // ---------------------------------------------------------------------------

  private genReference(prefix: string): string {
    return `${prefix}${Date.now()}${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private genWalletNumber(): string {
    const prefix =
      this.configService.get<string>('configuration.wallet.numberPrefix') ||
      'WLT';
    return `${prefix}${Date.now()}${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')}`;
  }

  private cfg<T = any>(path: string, fallback: T): T {
    const v = this.configService.get<T>(`configuration.wallet.${path}`);
    return v === undefined || v === null ? fallback : v;
  }

  // ---------------------------------------------------------------------------
  // Wallet lifecycle
  // ---------------------------------------------------------------------------

  async getOrCreateWallet(
    userId: string | Types.ObjectId,
    _userEmail?: string,
  ): Promise<WalletDocument> {
    const uid = new Types.ObjectId(userId);
    const existing = await this.walletModel.findOne({ userId: uid });
    if (existing) {
      return existing;
    }

    try {
      const wallet = await this.walletModel.create({
        userId: uid,
        walletNumber: this.genWalletNumber(),
        balance: { available: 0, pending: 0, locked: 0 },
        currency: 'NGN',
        status: 'ACTIVE',
        kycStatus: 'PENDING',
        dailyTransactionLimit: this.cfg('limits.defaultDaily', 500000),
        monthlyTransactionLimit: this.cfg('limits.defaultMonthly', 5000000),
        totalDeposited: 0,
        totalWithdrawn: 0,
      });
      // Back-link the wallet on the user (best-effort, never blocks).
      this.walletModel
        .db!.collection('users')
        .updateOne({ _id: uid }, { $set: { wallet: wallet._id } })
        .catch(() => undefined);
      return wallet;
    } catch (error: any) {
      // Race on the unique userId index — fetch the winner.
      if (error?.code === 11000) {
        const w = await this.walletModel.findOne({ userId: uid });
        if (w) {
          return w;
        }
      }
      throw error;
    }
  }

  /** Fire-and-forget wallet creation for use in auth flows. Never throws. */
  async ensureWalletSafe(
    userId: string | Types.ObjectId,
    userEmail?: string,
  ): Promise<void> {
    try {
      await this.getOrCreateWallet(userId, userEmail);
    } catch (error: any) {
      this.logger.warn(
        `ensureWalletSafe failed for user ${userId.toString()}: ${error?.message}`,
      );
    }
  }

  private assertActive(wallet: WalletDocument): void {
    if (wallet.status === 'SUSPENDED') {
      throw new WalletException('WALLET_003', HttpStatus.FORBIDDEN);
    }
    if (wallet.status === 'CLOSED') {
      throw new WalletException(
        'WALLET_003',
        HttpStatus.FORBIDDEN,
        undefined,
        'Wallet is closed',
      );
    }
  }

  buildBalanceView(wallet: WalletDocument): Record<string, any> {
    return {
      id: wallet._id.toString(),
      walletNumber: wallet.walletNumber,
      balance: {
        available: wallet.balance?.available || 0,
        pending: wallet.balance?.pending || 0,
        locked: wallet.balance?.locked || 0,
      },
      currency: wallet.currency,
      status: wallet.status,
      kycStatus: wallet.kycStatus,
      dailyTransactionLimit: wallet.dailyTransactionLimit,
      monthlyTransactionLimit: wallet.monthlyTransactionLimit,
      totalDeposited: wallet.totalDeposited,
      totalWithdrawn: wallet.totalWithdrawn,
    };
  }

  async getBalanceView(
    userId: string | Types.ObjectId,
    userEmail?: string,
  ): Promise<Record<string, any>> {
    const wallet = await this.getOrCreateWallet(userId, userEmail);
    return this.buildBalanceView(wallet);
  }

  // ---------------------------------------------------------------------------
  // Transactions (read)
  // ---------------------------------------------------------------------------

  async listTransactions(
    userId: string | Types.ObjectId,
    filters: {
      page?: number;
      limit?: number;
      type?: string;
      category?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<Record<string, any>> {
    const wallet = await this.getOrCreateWallet(userId);
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = { walletId: wallet._id };
    if (filters.type) query.type = filters.type;
    if (filters.category) query.category = filters.category;
    if (filters.status) query.status = filters.status;
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    const [items, total] = await Promise.all([
      this.transactionModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.transactionModel.countDocuments(query),
    ]);

    return { items, total, page, limit };
  }

  async getTransaction(
    userId: string | Types.ObjectId,
    id: string,
  ): Promise<Record<string, any>> {
    const wallet = await this.getOrCreateWallet(userId);
    if (!Types.ObjectId.isValid(id)) {
      throw new WalletException('WALLET_010', HttpStatus.NOT_FOUND);
    }
    const tx = await this.transactionModel
      .findOne({ _id: new Types.ObjectId(id), walletId: wallet._id })
      .lean();
    if (!tx) {
      throw new WalletException('WALLET_010', HttpStatus.NOT_FOUND);
    }
    return tx;
  }

  // ---------------------------------------------------------------------------
  // Fee & limit calculators
  // ---------------------------------------------------------------------------

  /** Withdrawal fee: <₦10k → ₦25; ₦10k–₦50k → ₦50; >₦50k → 0.1% (max ₦500). */
  calcWithdrawalFee(amount: number): number {
    const percent = this.cfg('fees.withdrawalPercent', 0.1);
    const maxFee = this.cfg('fees.maxWithdrawalFee', 500);
    if (amount < 10000) return 25;
    if (amount <= 50000) return this.cfg('fees.withdrawalFlat', 50);
    return Math.min(Math.round((amount * percent) / 100), maxFee);
  }

  // ---------------------------------------------------------------------------
  // Core ledger writes (atomic)
  // ---------------------------------------------------------------------------

  /**
   * Apply one or more balance deltas + ledger rows to a wallet inside a single
   * Mongo transaction. `deltas` mutates the three balance buckets; each ledger
   * entry records balanceBefore/After against the AVAILABLE balance (the
   * primary spendable figure).
   */
  private async applyLedger(
    wallet: WalletDocument,
    deltas: { available?: number; pending?: number; locked?: number },
    entries: LedgerEntry[],
    session: ClientSession,
    extraWalletSet?: Record<string, number>,
  ): Promise<TransactionDocument[]> {
    const beforeAvailable = wallet.balance.available;
    let running = beforeAvailable;

    const created: TransactionDocument[] = [];
    for (const entry of entries) {
      const before = running;
      running =
        entry.type === 'CREDIT'
          ? running + entry.amount
          : running - entry.amount;
      const [doc] = await this.transactionModel.create(
        [
          {
            walletId: wallet._id,
            type: entry.type,
            category: entry.category,
            amount: entry.amount,
            balanceBefore: before,
            balanceAfter: running,
            status: entry.status || 'COMPLETED',
            reference: entry.reference,
            externalReference: entry.externalReference,
            description: entry.description,
            narration: entry.narration,
            counterparty: entry.counterparty,
            seerBitData: entry.seerBitData,
            metadata: entry.metadata,
          },
        ],
        { session },
      );
      created.push(doc);
    }

    const inc: Record<string, number> = {};
    if (deltas.available) inc['balance.available'] = deltas.available;
    if (deltas.pending) inc['balance.pending'] = deltas.pending;
    if (deltas.locked) inc['balance.locked'] = deltas.locked;
    if (extraWalletSet) {
      for (const [k, v] of Object.entries(extraWalletSet)) {
        inc[k] = (inc[k] || 0) + v;
      }
    }

    await this.walletModel.updateOne(
      { _id: wallet._id },
      { $inc: inc },
      { session },
    );

    return created;
  }

  private async withTxn<T>(
    fn: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.connection.startSession();
    try {
      let result: T;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result!;
    } finally {
      await session.endSession();
    }
  }

  // ---------------------------------------------------------------------------
  // Deposit
  // ---------------------------------------------------------------------------

  async initiateDeposit(
    userId: string | Types.ObjectId,
    userEmail: string,
    dto: { amount: number; method?: 'CARD' | 'BANK_TRANSFER' | 'USSD' },
  ): Promise<Record<string, any>> {
    const wallet = await this.getOrCreateWallet(userId, userEmail);
    this.assertActive(wallet);

    const min = this.cfg('limits.minDeposit', 100);
    const max = this.cfg('limits.maxDeposit', 1000000);
    if (dto.amount < min) {
      throw new WalletException('WALLET_014', HttpStatus.BAD_REQUEST, {
        min,
      });
    }
    if (dto.amount > max) {
      throw new WalletException('WALLET_015', HttpStatus.BAD_REQUEST, {
        max,
      });
    }

    const reference = this.genReference('DEP');
    await this.depositRequestModel.create({
      walletId: wallet._id,
      userId: new Types.ObjectId(userId),
      amount: dto.amount,
      method: dto.method || 'CARD',
      status: 'PENDING',
      reference,
      seerBitData: { orderId: reference },
    });

    const user = await this.usersService.findOne(userId);

    return {
      reference,
      amount: dto.amount,
      currency: 'NGN',
      email: user.email,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      publicKey:
        this.configService.get<string>('configuration.seerbit.publicKey') || '',
    };
  }

  async verifyDeposit(
    userId: string | Types.ObjectId,
    reference: string,
  ): Promise<Record<string, any>> {
    const deposit = await this.depositRequestModel.findOne({ reference });
    if (!deposit) {
      throw new WalletException('WALLET_010', HttpStatus.NOT_FOUND);
    }
    // Ownership guard on the authenticated path.
    if (userId && deposit.userId.toString() !== userId.toString()) {
      throw new WalletException('WALLET_010', HttpStatus.NOT_FOUND);
    }
    return this.creditDeposit(reference);
  }

  /**
   * Shared verify-and-credit path for both the authenticated /deposit/verify
   * call and the webhook. Idempotent on the deposit reference: a second call on
   * an already-COMPLETED deposit returns the existing transaction, no double
   * credit. Credits ONLY from the server-side SeerBit query result.
   */
  async creditDeposit(reference: string): Promise<Record<string, any>> {
    const deposit = await this.depositRequestModel.findOne({ reference });
    if (!deposit) {
      throw new WalletException('WALLET_010', HttpStatus.NOT_FOUND);
    }

    // Idempotency: already credited → return the existing ledger row.
    if (deposit.status === 'COMPLETED') {
      const [wallet, tx] = await Promise.all([
        this.walletModel.findById(deposit.walletId),
        this.transactionModel.findOne({ reference }).lean(),
      ]);
      return {
        alreadyCredited: true,
        wallet: wallet ? this.buildBalanceView(wallet) : null,
        transaction: tx,
      };
    }

    // Source of truth: server-side query. Never trust webhook body.
    const verify = await this.seerbitService.verifyPayment(reference);
    if (verify.notAvailable) {
      throw new WalletException(
        'WALLET_020',
        HttpStatus.BAD_REQUEST,
        { reference, reason: 'not_available' },
        'Could not confirm payment with SeerBit',
      );
    }
    if (!verify.success) {
      // Distinguish "still pending" from an outright failure so the frontend's
      // pending-vs-error UX is accurate. Log the raw SeerBit response for triage.
      this.logger.warn(
        `Deposit ${reference} not yet successful — SeerBit status="${verify.status}" raw=${JSON.stringify(verify.raw)}`,
      );
      throw new WalletException(
        'WALLET_020',
        HttpStatus.BAD_REQUEST,
        {
          reference,
          reason: 'payment_not_successful',
          status: verify.status,
          gatewayMessage: verify.gatewayMessage,
        },
        'Payment not successful yet',
      );
    }
    // Amount/currency must match the DepositRequest. SeerBit returns money as a
    // number or a string ("375.00"), and `payments.amount` may be fee-inclusive
    // (feeBearer=CUSTOMER) — verify.amount is the reconciled PRINCIPAL. Compare
    // with a small epsilon so "100.00" vs 100 is never a false mismatch.
    if (verify.amount !== undefined) {
      const expected = Number.parseFloat(String(deposit.amount));
      const got = Number.parseFloat(String(verify.amount));
      if (Math.abs(got - expected) > 0.01) {
        this.logger.warn(
          `Deposit ${reference} amount mismatch — expected principal=${expected}, ` +
            `SeerBit principal=${got} (gross=${verify.grossAmount}, fee=${verify.fee}) ` +
            `raw=${JSON.stringify(verify.raw)}`,
        );
        throw new WalletException(
          'WALLET_019',
          HttpStatus.BAD_REQUEST,
          {
            reference,
            reason: 'amount_mismatch',
            expected,
            got,
            grossAmount: verify.grossAmount,
            fee: verify.fee,
          },
          'Deposit verification mismatch',
        );
      }
    }
    if (verify.currency && verify.currency !== 'NGN') {
      this.logger.warn(
        `Deposit ${reference} currency mismatch — got ${verify.currency}, expected NGN`,
      );
      throw new WalletException(
        'WALLET_019',
        HttpStatus.BAD_REQUEST,
        {
          reference,
          reason: 'currency_mismatch',
          currency: verify.currency,
        },
        'Deposit verification mismatch',
      );
    }

    const wallet = await this.walletModel.findById(deposit.walletId);
    if (!wallet) {
      throw new WalletException('WALLET_002', HttpStatus.NOT_FOUND);
    }

    try {
      const created = await this.withTxn(async (session) => {
        // Re-read the deposit inside the transaction to re-check idempotency.
        const fresh = await this.depositRequestModel
          .findOne({ reference })
          .session(session);
        if (!fresh || fresh.status === 'COMPLETED') {
          return null;
        }

        const txs = await this.applyLedger(
          wallet,
          { available: deposit.amount },
          [
            {
              type: 'CREDIT',
              category: 'DEPOSIT',
              amount: deposit.amount,
              description: 'Wallet deposit',
              reference, // shared with the deposit for idempotency
              externalReference: verify.gatewayRef,
              status: 'COMPLETED',
              seerBitData: {
                transactionRef: verify.gatewayRef,
                orderId: reference,
                status: verify.status || 'SUCCESS',
                paidAt: new Date(),
              },
            },
          ],
          session,
          { totalDeposited: deposit.amount },
        );

        fresh.status = 'COMPLETED';
        fresh.completedAt = new Date();
        fresh.seerBitData = {
          ...(fresh.seerBitData || {}),
          transactionRef: verify.gatewayRef,
          orderId: reference,
        };
        await fresh.save({ session });

        return txs[0];
      });

      // A concurrent call already completed it → return current state.
      const updatedWallet = await this.walletModel.findById(deposit.walletId);
      const tx =
        created || (await this.transactionModel.findOne({ reference }).lean());

      if (created) {
        this.notificationService
          .notify({
            recipientType: 'user',
            recipientId: deposit.userId.toString(),
            event: 'wallet.deposit.success',
            type: 'success',
            title: 'Deposit successful',
            body: `Your wallet has been credited with ₦${deposit.amount.toLocaleString()}.`,
            data: { reference, amount: deposit.amount },
          })
          .catch(() => undefined);
      }

      return {
        alreadyCredited: !created,
        wallet: updatedWallet ? this.buildBalanceView(updatedWallet) : null,
        transaction: tx,
      };
    } catch (error: any) {
      // Unique-reference clash means another path already credited it.
      if (error?.code === 11000) {
        const [w, tx] = await Promise.all([
          this.walletModel.findById(deposit.walletId),
          this.transactionModel.findOne({ reference }).lean(),
        ]);
        return {
          alreadyCredited: true,
          wallet: w ? this.buildBalanceView(w) : null,
          transaction: tx,
        };
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Generic domain payment / refund (reused by equipment, marketplace, etc.)
  // ---------------------------------------------------------------------------

  /**
   * Debit a user's LIVE wallet for a domain PAYMENT (e.g. an equipment booking).
   * Atomic + idempotent on the caller-supplied `reference`: a repeat call with a
   * reference that already has a COMPLETED transaction returns that transaction
   * and does not debit again. Throws `WALLET_001` on insufficient balance.
   *
   * Returns the created (or pre-existing) transaction reference + the fresh
   * balance view so callers can persist `walletPaymentRef` and echo the balance.
   */
  async debitForPayment(
    userId: string | Types.ObjectId,
    input: {
      amount: number;
      reference: string;
      description: string;
      narration?: string;
      category?: TransactionCategory;
      metadata?: Record<string, any>;
    },
  ): Promise<{
    reference: string;
    alreadyProcessed: boolean;
    amount: number;
    wallet: Record<string, any>;
  }> {
    const wallet = await this.getOrCreateWallet(userId);
    this.assertActive(wallet);

    // Idempotency: a transaction with this reference already exists → no re-debit.
    const existing = await this.transactionModel
      .findOne({ reference: input.reference })
      .lean();
    if (existing) {
      return {
        reference: input.reference,
        alreadyProcessed: true,
        amount: existing.amount,
        wallet: this.buildBalanceView(wallet),
      };
    }

    if (wallet.balance.available < input.amount) {
      throw new WalletException('WALLET_001', HttpStatus.BAD_REQUEST, {
        required: input.amount,
        available: wallet.balance.available,
      });
    }

    try {
      await this.withTxn(async (session) => {
        // Re-check balance inside the transaction to guard concurrent debits.
        const fresh = await this.walletModel
          .findById(wallet._id)
          .session(session);
        if (!fresh || fresh.balance.available < input.amount) {
          throw new WalletException('WALLET_001', HttpStatus.BAD_REQUEST, {
            required: input.amount,
            available: fresh?.balance.available ?? 0,
          });
        }
        await this.applyLedger(
          fresh,
          { available: -input.amount },
          [
            {
              type: 'DEBIT',
              category: input.category || 'PAYMENT',
              amount: input.amount,
              description: input.description,
              narration: input.narration,
              reference: input.reference,
              status: 'COMPLETED',
              metadata: input.metadata,
            },
          ],
          session,
        );
      });
    } catch (error: any) {
      // Unique-reference clash → another path already debited it. Treat as done.
      if (error?.code === 11000) {
        const updated = await this.walletModel.findById(wallet._id);
        return {
          reference: input.reference,
          alreadyProcessed: true,
          amount: input.amount,
          wallet: updated
            ? this.buildBalanceView(updated)
            : this.buildBalanceView(wallet),
        };
      }
      throw error;
    }

    const updated = await this.walletModel.findById(wallet._id);
    return {
      reference: input.reference,
      alreadyProcessed: false,
      amount: input.amount,
      wallet: updated
        ? this.buildBalanceView(updated)
        : this.buildBalanceView(wallet),
    };
  }

  /**
   * Credit a user's LIVE wallet with a REFUND (e.g. an equipment deposit refund).
   * Atomic + idempotent on `reference`. A zero/negative amount is a no-op that
   * still reports success so callers can settle a fully-consumed deposit.
   */
  async creditRefund(
    userId: string | Types.ObjectId,
    input: {
      amount: number;
      reference: string;
      description: string;
      narration?: string;
      category?: TransactionCategory;
      metadata?: Record<string, any>;
    },
  ): Promise<{
    reference: string;
    alreadyProcessed: boolean;
    amount: number;
    wallet: Record<string, any>;
  }> {
    const wallet = await this.getOrCreateWallet(userId);

    if (!input.amount || input.amount <= 0) {
      return {
        reference: input.reference,
        alreadyProcessed: false,
        amount: 0,
        wallet: this.buildBalanceView(wallet),
      };
    }

    const existing = await this.transactionModel
      .findOne({ reference: input.reference })
      .lean();
    if (existing) {
      return {
        reference: input.reference,
        alreadyProcessed: true,
        amount: existing.amount,
        wallet: this.buildBalanceView(wallet),
      };
    }

    try {
      await this.withTxn(async (session) => {
        const fresh = await this.walletModel
          .findById(wallet._id)
          .session(session);
        if (!fresh) {
          throw new WalletException('WALLET_002', HttpStatus.NOT_FOUND);
        }
        await this.applyLedger(
          fresh,
          { available: input.amount },
          [
            {
              type: 'CREDIT',
              category: input.category || 'REFUND',
              amount: input.amount,
              description: input.description,
              narration: input.narration,
              reference: input.reference,
              status: 'COMPLETED',
              metadata: input.metadata,
            },
          ],
          session,
        );
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        const updated = await this.walletModel.findById(wallet._id);
        return {
          reference: input.reference,
          alreadyProcessed: true,
          amount: input.amount,
          wallet: updated
            ? this.buildBalanceView(updated)
            : this.buildBalanceView(wallet),
        };
      }
      throw error;
    }

    const updated = await this.walletModel.findById(wallet._id);
    return {
      reference: input.reference,
      alreadyProcessed: false,
      amount: input.amount,
      wallet: updated
        ? this.buildBalanceView(updated)
        : this.buildBalanceView(wallet),
    };
  }

  // ---------------------------------------------------------------------------
  // Internal transfer
  // ---------------------------------------------------------------------------

  async resolveRecipient(
    email: string,
  ): Promise<{ name: string; userId: string; email: string }> {
    const recipient = await this.usersService.findByEmail(
      email.toLowerCase().trim(),
    );
    if (!recipient) {
      throw new WalletException('WALLET_016', HttpStatus.NOT_FOUND);
    }
    return {
      name: `${recipient.firstName} ${recipient.lastName}`.trim(),
      userId: recipient._id.toString(),
      email: recipient.email,
    };
  }

  async internalTransfer(
    senderId: string | Types.ObjectId,
    dto: { recipientEmail: string; amount: number; narration?: string },
  ): Promise<Record<string, any>> {
    const recipient = await this.usersService.findByEmail(
      dto.recipientEmail.toLowerCase().trim(),
    );
    if (!recipient) {
      throw new WalletException('WALLET_016', HttpStatus.NOT_FOUND);
    }
    if (recipient._id.toString() === senderId.toString()) {
      throw new WalletException('WALLET_017', HttpStatus.BAD_REQUEST);
    }

    const senderWallet = await this.getOrCreateWallet(senderId);
    this.assertActive(senderWallet);
    const recipientWallet = await this.getOrCreateWallet(
      recipient._id,
      recipient.email,
    );
    this.assertActive(recipientWallet);

    if (senderWallet.balance.available < dto.amount) {
      throw new WalletException('WALLET_001', HttpStatus.BAD_REQUEST, {
        required: dto.amount,
        available: senderWallet.balance.available,
      });
    }

    const sender = await this.usersService.findOne(senderId);
    const correlation = this.genReference('TRF');
    const outRef = `${correlation}-OUT`;
    const inRef = `${correlation}-IN`;

    await this.withTxn(async (session) => {
      await this.applyLedger(
        senderWallet,
        { available: -dto.amount },
        [
          {
            type: 'DEBIT',
            category: 'TRANSFER_OUT',
            amount: dto.amount,
            description: 'Internal transfer sent',
            narration: dto.narration,
            reference: outRef,
            status: 'COMPLETED',
            counterparty: {
              walletId: recipientWallet._id,
              userId: recipient._id,
              name: `${recipient.firstName} ${recipient.lastName}`.trim(),
            },
            metadata: { correlation },
          },
        ],
        session,
      );

      await this.applyLedger(
        recipientWallet,
        { available: dto.amount },
        [
          {
            type: 'CREDIT',
            category: 'TRANSFER_IN',
            amount: dto.amount,
            description: 'Internal transfer received',
            narration: dto.narration,
            reference: inRef,
            status: 'COMPLETED',
            counterparty: {
              walletId: senderWallet._id,
              userId: sender._id,
              name: `${sender.firstName} ${sender.lastName}`.trim(),
            },
            metadata: { correlation },
          },
        ],
        session,
      );
    });

    // Notify both parties (best-effort).
    this.notificationService
      .notify({
        recipientType: 'user',
        recipientId: senderId.toString(),
        event: 'wallet.transfer.out',
        type: 'info',
        title: 'Transfer sent',
        body: `You sent ₦${dto.amount.toLocaleString()} to ${recipient.firstName} ${recipient.lastName}.`,
        data: { reference: outRef, amount: dto.amount },
      })
      .catch(() => undefined);
    this.notificationService
      .notify({
        recipientType: 'user',
        recipientId: recipient._id.toString(),
        event: 'wallet.transfer.in',
        type: 'success',
        title: 'Transfer received',
        body: `You received ₦${dto.amount.toLocaleString()} from ${sender.firstName} ${sender.lastName}.`,
        data: { reference: inRef, amount: dto.amount },
      })
      .catch(() => undefined);

    const updated = await this.walletModel.findById(senderWallet._id);
    return {
      wallet: updated ? this.buildBalanceView(updated) : null,
      reference: correlation,
      recipient: {
        name: `${recipient.firstName} ${recipient.lastName}`.trim(),
        email: recipient.email,
      },
      amount: dto.amount,
    };
  }

  // ---------------------------------------------------------------------------
  // Withdrawal
  // ---------------------------------------------------------------------------

  getBanks(): { name: string; code: string }[] {
    return NIGERIAN_BANKS;
  }

  resolveBank(accountNumber: string, bankCode: string): Record<string, any> {
    const bankName = bankNameForCode(bankCode);
    if (!bankName) {
      throw new WalletException('WALLET_007', HttpStatus.BAD_REQUEST, {
        bankCode,
      });
    }
    return {
      accountNumber,
      accountName: '', // no live name-enquiry this phase
      bankName,
      bankCode,
      verified: false,
    };
  }

  async withdraw(
    userId: string | Types.ObjectId,
    dto: {
      amount: number;
      bankCode: string;
      accountNumber: string;
      accountName?: string;
      narration?: string;
    },
  ): Promise<Record<string, any>> {
    const wallet = await this.getOrCreateWallet(userId);
    this.assertActive(wallet);

    const min = this.cfg('limits.minWithdrawal', 500);
    const max = this.cfg('limits.maxWithdrawal', 500000);
    if (dto.amount < min) {
      throw new WalletException('WALLET_014', HttpStatus.BAD_REQUEST, { min });
    }
    if (dto.amount > max) {
      throw new WalletException('WALLET_015', HttpStatus.BAD_REQUEST, { max });
    }

    const bankName = bankNameForCode(dto.bankCode);
    if (!bankName) {
      throw new WalletException('WALLET_006', HttpStatus.BAD_REQUEST, {
        bankCode: dto.bankCode,
      });
    }

    const fee = this.calcWithdrawalFee(dto.amount);
    const totalAmount = dto.amount + fee;

    if (wallet.balance.available < totalAmount) {
      throw new WalletException('WALLET_001', HttpStatus.BAD_REQUEST, {
        required: totalAmount,
        available: wallet.balance.available,
      });
    }

    const autoApproveThreshold = this.cfg(
      'thresholds.autoApproveWithdrawal',
      50000,
    );
    const autoApprove = dto.amount <= autoApproveThreshold;
    const reference = this.genReference('WDR');
    const livePayouts = !!this.configService.get<boolean>(
      'configuration.wallet.livePayouts',
    );

    const withdrawal = await this.withTxn(async (session) => {
      // Lock funds: available → locked (amount + fee).
      await this.walletModel.updateOne(
        { _id: wallet._id },
        {
          $inc: {
            'balance.available': -totalAmount,
            'balance.locked': totalAmount,
          },
        },
        { session },
      );

      const [wr] = await this.withdrawalRequestModel.create(
        [
          {
            walletId: wallet._id,
            userId: new Types.ObjectId(userId),
            amount: dto.amount,
            fee,
            totalAmount,
            status: autoApprove ? 'APPROVED' : 'PENDING',
            reference,
            narration: dto.narration,
            accountNumber: dto.accountNumber,
            accountName: dto.accountName,
            bankCode: dto.bankCode,
            bankName,
            approvedAt: autoApprove ? new Date() : undefined,
            metadata: { autoApproved: autoApprove, livePayouts },
          },
        ],
        { session },
      );

      return wr;
    });

    // Notify: requested (+ approved if auto).
    this.notificationService
      .notify({
        recipientType: 'user',
        recipientId: userId.toString(),
        event: 'wallet.withdrawal.requested',
        type: 'info',
        title: 'Withdrawal requested',
        body: `Your withdrawal of ₦${dto.amount.toLocaleString()} to ${bankName} is being processed.`,
        data: { reference, amount: dto.amount, fee, status: withdrawal.status },
      })
      .catch(() => undefined);

    if (autoApprove) {
      this.notificationService
        .notify({
          recipientType: 'user',
          recipientId: userId.toString(),
          event: 'wallet.withdrawal.approved',
          type: 'success',
          title: 'Withdrawal approved',
          body: `Your withdrawal of ₦${dto.amount.toLocaleString()} has been approved and is pending settlement.`,
          data: { reference, amount: dto.amount },
        })
        .catch(() => undefined);
    }

    const updated = await this.walletModel.findById(wallet._id);
    return {
      reference,
      amount: dto.amount,
      fee,
      totalAmount,
      status: withdrawal.status,
      bankName,
      livePayoutsExecuted: false,
      note: livePayouts
        ? 'Approved — awaiting settlement'
        : 'Funds locked; settlement occurs off-platform (WALLET_LIVE_PAYOUTS=false).',
      wallet: updated ? this.buildBalanceView(updated) : null,
    };
  }

  async listWithdrawals(
    userId: string | Types.ObjectId,
    filters: { page?: number; limit?: number; status?: string },
  ): Promise<Record<string, any>> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {
      userId: new Types.ObjectId(userId),
    };
    if (filters.status) query.status = filters.status;

    const [items, total] = await Promise.all([
      this.withdrawalRequestModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.withdrawalRequestModel.countDocuments(query),
    ]);

    return { items, total, page, limit };
  }

  async getWithdrawal(
    userId: string | Types.ObjectId,
    id: string,
  ): Promise<Record<string, any>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new WalletException('WALLET_010', HttpStatus.NOT_FOUND);
    }
    const wr = await this.withdrawalRequestModel
      .findOne({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      })
      .lean();
    if (!wr) {
      throw new WalletException('WALLET_010', HttpStatus.NOT_FOUND);
    }
    return wr;
  }
}
