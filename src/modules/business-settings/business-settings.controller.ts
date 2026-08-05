import {
  Body,
  Controller,
  Get,
  Patch,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UploadedFiles,
} from "@nestjs/common";
import { FileFieldsInterceptor, FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { BusinessSettingsService } from "./business-settings.service";
import { UpdateBusinessSettingDto } from "./dto/update-business-setting.dto";

@Controller()
export class BusinessSettingsController {
  constructor(
    private readonly businessSettingsService: BusinessSettingsService
  ) {}

  @Get("business-settings")
  findPublicSettings() {
    return this.businessSettingsService.findPublicSettings();
  }

  @Patch("admin/business-settings")
  @UseInterceptors(
  FileFieldsInterceptor(
    [
      { name: "logo", maxCount: 1 },
      { name: "heroBanners", maxCount: 5 },
    ],
    {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (req, file, callback) => {
        const allowedTypes = ["image/png","image/jpeg","image/jpg","image/webp"];
        if (!allowedTypes.includes(file.mimetype)) {
          return callback(new BadRequestException("Invalid file type") as any, false);
        }
        callback(null, true);
      },
    }
  )
)
  updateSettings(
  @Body() dto: UpdateBusinessSettingDto,
  @UploadedFiles() files: {
    logo?: Express.Multer.File[];
    heroBanners?: Express.Multer.File[];
  }
) {
  return this.businessSettingsService.updateSettings(
    dto,
    files?.logo?.[0],
    files?.heroBanners
  );
}
}