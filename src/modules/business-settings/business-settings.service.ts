import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BusinessSetting } from "./entities/business-setting.entity";
import { UpdateBusinessSettingDto } from "./dto/update-business-setting.dto";
import { CloudinaryService } from "../uploads/cloudinary.service";


@Injectable()
export class BusinessSettingsService {
  constructor(
    @InjectRepository(BusinessSetting)
    private readonly businessSettingsRepository: Repository<BusinessSetting>,

    private readonly cloudinaryService: CloudinaryService
  ) {}

  private async getOrCreateSettings() {
    let settings = await this.businessSettingsRepository.findOne({
      where: { id: 1 },
    });

    if (!settings) {
      settings = this.businessSettingsRepository.create({
        id: 1,
        businessName: "Your Brand",
      });

      settings = await this.businessSettingsRepository.save(settings);
    }

    return settings;
  }

  async findPublicSettings() {
    const settings = await this.getOrCreateSettings();

    return {
      id: settings.id,
      businessName: settings.businessName,
      logo: settings.logoUrl
        ? {
            url: settings.logoUrl,
            secure_url: settings.logoUrl,
          }
        : null,
      email: settings.email,
      phone: settings.phone,
      address: settings.address,
      facebookUrl: settings.facebookUrl,
      instagramUrl: settings.instagramUrl,
      tiktokUrl: settings.tiktokUrl,
      heroBanners: settings.heroBanners || [],
    };
  }

  async updateSettings(
    dto: UpdateBusinessSettingDto,
    logoFile?: Express.Multer.File,
    heroFiles?: Express.Multer.File[]
  ) {
    const settings = await this.getOrCreateSettings();

    Object.assign(settings, {
      businessName: dto.businessName ?? settings.businessName,
      email: dto.email ?? settings.email,
      phone: dto.phone ?? settings.phone,
      address: dto.address ?? settings.address,
      facebookUrl: dto.facebookUrl ?? settings.facebookUrl,
      instagramUrl: dto.instagramUrl ?? settings.instagramUrl,
      tiktokUrl: dto.tiktokUrl ?? settings.tiktokUrl,
     
    });

let finalBanners: string[] = [];

// 1. keep existing (after delete)
if (dto.existingHeroBanners) {
  try {
    finalBanners = JSON.parse(dto.existingHeroBanners);
  } catch {
    finalBanners = [];
  }
}

// 2. add newly uploaded banners
if (heroFiles?.length) {
  const uploadedBanners: string[] = [];

  for (const file of heroFiles) {
    if (!file.buffer) continue;

    const uploaded = await this.cloudinaryService.uploadImage(
      file.buffer,
      "business/hero"
    );

    uploadedBanners.push(uploaded.url);
  }

  finalBanners = [...finalBanners, ...uploadedBanners];
}

// 3. assign once
settings.heroBanners = finalBanners;


if (logoFile) {
  if (!logoFile.buffer) {
    throw new BadRequestException(
      "Logo file buffer is missing. Please check multer memoryStorage."
    );
  }

  try {
    const uploadedLogo = await this.cloudinaryService.uploadImage(
      logoFile.buffer,
      "business/logo"
    );

    const oldLogoPublicId = settings.logoPublicId;

    settings.logoUrl = uploadedLogo.url;
    settings.logoPublicId = uploadedLogo.publicId;

    if (oldLogoPublicId) {
      await this.cloudinaryService.deleteByPublicId(oldLogoPublicId, "image");
    }
  } catch (error) {
    console.error("Logo upload failed:", error);

    throw new InternalServerErrorException(
      "Logo upload failed. Please check Cloudinary configuration."
    );
  }
}
    const savedSettings = await this.businessSettingsRepository.save(settings);

    return {
      message: "Business settings updated successfully.",
      data: {
        id: savedSettings.id,
        businessName: savedSettings.businessName,
        logo: savedSettings.logoUrl
          ? {
              url: savedSettings.logoUrl,
              secure_url: savedSettings.logoUrl,
            }
          : null,
        email: savedSettings.email,
        phone: savedSettings.phone,
        address: savedSettings.address,
        facebookUrl: savedSettings.facebookUrl,
        instagramUrl: savedSettings.instagramUrl,
        tiktokUrl: savedSettings.tiktokUrl,
      },
    };
  }
}