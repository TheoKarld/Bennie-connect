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
import { EquipmentService } from './equipment.service';
import { ListEquipmentDto } from './dto/list-equipment.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  CancelBookingDto,
  ListMyBookingsDto,
  RateBookingDto,
} from './dto/user-booking.dto';

/**
 * User-plane equipment + booking API. Base path `/api/v1/equipment`.
 * Guarded by the user JWT; the authenticated user is on `request.user`.
 */
@ApiTags('equipment')
@ApiBearerAuth()
@Controller('equipment')
@UseGuards(JwtAuthGuard)
export class EquipmentController {
  constructor(private readonly service: EquipmentService) {}

  private uid(user: UserDocument): string {
    return user._id.toString();
  }

  // --- Fleet ---

  @Get()
  @ApiOperation({
    summary: 'List available fleet (filters + date-availability)',
  })
  async list(@Query() query: ListEquipmentDto) {
    const data = await this.service.listAvailable(query);
    return { success: true, data };
  }

  // --- Bookings (declared before `/:id` so they are not shadowed) ---

  @Post('bookings')
  @ApiOperation({ summary: 'Request a booking → PENDING (no charge)' })
  async requestBooking(
    @CurrentUser() user: UserDocument,
    @Body() dto: CreateBookingDto,
  ) {
    const data = await this.service.requestBooking(this.uid(user), dto);
    return {
      success: true,
      message: 'Booking requested. Awaiting admin approval.',
      data,
    };
  }

  @Get('my-bookings')
  @ApiOperation({ summary: "The caller's bookings (paginated, filterable)" })
  async myBookings(
    @CurrentUser() user: UserDocument,
    @Query() query: ListMyBookingsDto,
  ) {
    const data = await this.service.listMyBookings(this.uid(user), query);
    return { success: true, data };
  }

  @Get('bookings/:id')
  @ApiOperation({ summary: 'Booking detail + cost breakdown + GPS trail' })
  async bookingDetail(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
  ) {
    const data = await this.service.getMyBooking(id, this.uid(user));
    return { success: true, data };
  }

  @Post('bookings/:id/pay')
  @ApiOperation({
    summary: 'Pay the full cost from wallet (only when APPROVED)',
  })
  async pay(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    const data = await this.service.payBooking(id, this.uid(user));
    return {
      success: true,
      message: 'Payment successful. Booking confirmed.',
      data,
    };
  }

  @Post('bookings/:id/cancel')
  @ApiOperation({ summary: 'Cancel a booking (per rules)' })
  async cancel(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ) {
    const data = await this.service.cancelBooking(
      id,
      this.uid(user),
      dto.reason,
    );
    return { success: true, message: 'Booking cancelled.', data };
  }

  @Get('bookings/:id/tracking')
  @ApiOperation({ summary: 'Live GPS snapshot + trail for the booking' })
  async tracking(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    const data = await this.service.getTracking(id, { userId: this.uid(user) });
    return { success: true, data };
  }

  @Post('bookings/:id/rate')
  @ApiOperation({ summary: 'Post-completion review (rating 1–5 + comment)' })
  async rate(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: RateBookingDto,
  ) {
    const data = await this.service.rateBooking(
      id,
      this.uid(user),
      dto.rating,
      dto.comment,
    );
    return { success: true, data };
  }

  // --- Equipment detail (kept last so `/bookings`, `/my-bookings` win) ---

  @Get(':id')
  @ApiOperation({ summary: 'Equipment detail (specs, rates, images)' })
  async detail(@Param('id') id: string) {
    const data = await this.service.getEquipment(id);
    return { success: true, data };
  }
}
