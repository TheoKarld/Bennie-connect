import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { WalletService } from './wallet.service';
import {
  InitiateDepositDto,
  InternalTransferDto,
  ListTransactionsDto,
  ListWithdrawalsDto,
  ResolveTransferDto,
  VerifyDepositDto,
  WithdrawDto,
} from './dto';

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Get (or lazily create) the current user wallet' })
  async getWallet(@CurrentUser() user: UserDocument) {
    const data = await this.walletService.getBalanceView(user._id, user.email);
    return { success: true, data };
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List wallet transactions (paginated, filterable)' })
  async listTransactions(
    @CurrentUser() user: UserDocument,
    @Query() query: ListTransactionsDto,
  ) {
    const data = await this.walletService.listTransactions(user._id, query);
    return { success: true, data };
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get a single transaction' })
  async getTransaction(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
  ) {
    const data = await this.walletService.getTransaction(user._id, id);
    return { success: true, data };
  }

  // --- Deposit -------------------------------------------------------------

  @Post('deposit/initiate')
  @ApiOperation({
    summary: 'Create a deposit intent + return the SeerBit inline SDK params',
  })
  async initiateDeposit(
    @CurrentUser() user: UserDocument,
    @Body() dto: InitiateDepositDto,
  ) {
    const data = await this.walletService.initiateDeposit(
      user._id,
      user.email,
      dto,
    );
    return { success: true, data };
  }

  @Post('deposit/verify')
  @ApiOperation({
    summary: 'Verify a deposit against SeerBit and credit idempotently',
  })
  async verifyDeposit(
    @CurrentUser() user: UserDocument,
    @Body() dto: VerifyDepositDto,
  ) {
    const data = await this.walletService.verifyDeposit(
      user._id,
      dto.reference,
    );
    return { success: true, data };
  }

  // --- Banks & transfer resolution -----------------------------------------

  @Get('banks')
  @ApiOperation({ summary: 'Static Nigerian bank list (name + code)' })
  getBanks() {
    return { success: true, data: this.walletService.getBanks() };
  }

  @Get('banks/resolve')
  @ApiOperation({
    summary: 'Resolve a bank name from its code (static list, no name-enquiry)',
  })
  resolveBank(
    @Query('accountNumber') accountNumber: string,
    @Query('bankCode') bankCode: string,
  ) {
    const data = this.walletService.resolveBank(
      accountNumber || '',
      bankCode || '',
    );
    return { success: true, data };
  }

  @Get('transfer/resolve')
  @ApiOperation({ summary: 'Resolve an internal-transfer recipient by email' })
  async resolveTransfer(
    @CurrentUser() user: UserDocument,
    @Query() query: ResolveTransferDto,
  ) {
    const data = await this.walletService.resolveRecipient(query.email);
    return { success: true, data: { name: data.name } };
  }

  @Post('transfer/internal')
  @ApiOperation({ summary: 'Transfer to another registered user by email' })
  async internalTransfer(
    @CurrentUser() user: UserDocument,
    @Body() dto: InternalTransferDto,
  ) {
    const data = await this.walletService.internalTransfer(user._id, dto);
    return { success: true, data };
  }

  // --- Withdrawal ----------------------------------------------------------

  @Post('withdraw')
  @ApiOperation({ summary: 'Request a withdrawal to a bank account' })
  async withdraw(@CurrentUser() user: UserDocument, @Body() dto: WithdrawDto) {
    const data = await this.walletService.withdraw(user._id, dto);
    return {
      success: true,
      message: 'Withdrawal request submitted successfully',
      data,
    };
  }

  @Get('withdrawals')
  @ApiOperation({ summary: 'List withdrawal requests (paginated)' })
  async listWithdrawals(
    @CurrentUser() user: UserDocument,
    @Query() query: ListWithdrawalsDto,
  ) {
    const data = await this.walletService.listWithdrawals(user._id, query);
    return { success: true, data };
  }

  @Get('withdrawals/:id')
  @ApiOperation({ summary: 'Get a single withdrawal request' })
  async getWithdrawal(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
  ) {
    const data = await this.walletService.getWithdrawal(user._id, id);
    return { success: true, data };
  }
}
