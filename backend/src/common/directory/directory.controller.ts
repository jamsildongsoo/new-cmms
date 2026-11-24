import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { UserContext } from '../../auth/types/user-context.type';
import { DirectoryService } from './directory.service';

@UseGuards(JwtAuthGuard)
@Controller('directory')
export class DirectoryController {
  constructor(private readonly directory: DirectoryService) {}

  @Get('users')
  searchUsers(@CurrentUser() user: UserContext, @Query('q') query = '') {
    return this.directory.searchUsers(user.companyId, query);
  }

  @Get('departments')
  searchDepartments(@CurrentUser() user: UserContext, @Query('q') query = '') {
    return this.directory.searchDepartments(user.companyId, query);
  }

  @Get('equipment')
  searchEquipment(@CurrentUser() user: UserContext, @Query('q') query = '') {
    return this.directory.searchEquipment(user.companyId, query);
  }

  @Get('materials')
  searchMaterials(@CurrentUser() user: UserContext, @Query('q') query = '') {
    return this.directory.searchMaterials(user.companyId, query);
  }
}
