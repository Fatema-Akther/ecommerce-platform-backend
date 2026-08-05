// import { Controller, Get, UseGuards } from '@nestjs/common';
// import { DashboardService } from './dashboard.service';
// import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
// import { RolesGuard } from 'src/modules/auth/roles.guard';
// import { Roles } from 'src/modules/auth/roles.decorator';

// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles('admin')
// @Controller('admin/dashboard')
// export class DashboardController {
//   constructor(private readonly service: DashboardService) {}

//   @Get('summary')
//   getSummary() {
//     return this.service.getSummary();
//   }
// }


import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/roles.guard';
import { Roles } from 'src/modules/auth/roles.decorator';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  getSummary(@Query('shipmentPeriod') shipmentPeriod?: string) {
    return this.service.getSummary(shipmentPeriod);
  }
}