import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BusinessSetting } from "./entities/business-setting.entity";
import { BusinessSettingsController } from "./business-settings.controller";
import { BusinessSettingsService } from "./business-settings.service";
import { UploadsModule } from "../uploads/uploads.module";


@Module({
  imports: [TypeOrmModule.forFeature([BusinessSetting]), UploadsModule],
  controllers: [BusinessSettingsController],
  providers: [BusinessSettingsService],
  exports: [BusinessSettingsService],
})
export class BusinessSettingsModule {}