import {
  Controller,
  Get,
  Param,
  Put,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserDocument } from './schemas/user.schema';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current user profile' })
  getMe(@CurrentUser() user: UserDocument) {
    return { success: true, data: user.toJSON() };
  }

  @Put('me')
  @ApiOperation({ summary: 'Update the current user profile' })
  async updateMe(
    @CurrentUser() user: UserDocument,
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.usersService.update(user._id, dto as any);
    return { success: true, data: updated.toJSON() };
  }

  @Get('statistics')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get user statistics (admin)' })
  async statistics() {
    const data = await this.usersService.getStatistics();
    return { success: true, data };
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'List users (admin)' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.usersService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
      { role, search },
    );
    return {
      success: true,
      data: result.data.map((u) => u.toJSON()),
      meta: { total: result.total, page: result.page, limit: result.limit },
    };
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get a user by id (admin)' })
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    return { success: true, data: user.toJSON() };
  }
}
