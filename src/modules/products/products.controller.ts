import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { getCloudinary } from '../../config/cloudinary.config';
import { imageMulterOptions } from '../uploads/image-multer.options';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';




interface UploadedImage {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
}

@Controller()
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  // =====================================================
  // 1️⃣ SINGLE IMAGE UPLOAD (Cloudinary)
  // =====================================================

  @UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')

  @Post('upload/product-image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      ...imageMulterOptions,
    }),
  )
  async uploadProductImage(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      return { message: 'No file uploaded' };
    }

    const cloudinary = getCloudinary();

    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'client-0/images',
          resource_type: 'image',
        },
        (error, res) => {
          if (error) return reject(error);
          resolve(res);
        },
      );

      stream.end(file.buffer);
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    };
  }

  // =====================================================
  // 2️⃣ MULTIPLE IMAGE UPLOAD (POSTMAN-READY)
  // key = file
  // =====================================================

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Post('upload/product-images')
@UseInterceptors(
  FilesInterceptor('file', 10, {
    storage: memoryStorage(),
    ...imageMulterOptions,
  }),
)
async uploadMultipleImages(
  @UploadedFiles() files: Express.Multer.File[],
) {
  if (!files || files.length === 0) {
    throw new BadRequestException('No files uploaded');
  }

  const cloudinary = getCloudinary();

  const uploaded = await Promise.all(
    files.map((file) => {
      return new Promise<UploadedImage>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'client-0/images',
            resource_type: 'image',
          },
          (error, result) => {
            if (error) return reject(error);

            if (!result) {
              return reject(new BadRequestException('Cloudinary upload failed'));
            }

            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              width: result.width,
              height: result.height,
              format: result.format,
            });
          },
        );

        stream.end(file.buffer);
      });
    }),
  );

  return uploaded;
}

  // =====================================================
  // 3️⃣ CREATE PRODUCT
  // =====================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
  @Post('products')
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  // =====================================================
  // 4️⃣ LIST PRODUCTS (filters)
  // =====================================================
@Get('products')
list(
  @Query('categoryId') categoryId?: string,
  @Query('categorySlug') categorySlug?: string,
  @Query('condition') condition?: string,
  @Query('flash') flash?: string,
  @Query('q') q?: string,
  @Query('minPrice') minPrice?: string,
  @Query('maxPrice') maxPrice?: string,
  @Query('page') page?: string,
  @Query('limit') limit?: string,
) {
  const parsedMinPrice =
    minPrice !== undefined && minPrice !== ''
      ? Number(minPrice)
      : undefined;

  const parsedMaxPrice =
    maxPrice !== undefined && maxPrice !== ''
      ? Number(maxPrice)
      : undefined;

  return this.service.findAll({
    categoryId,
    categorySlug,
    condition,
    flash,
    q,
    minPrice:
      parsedMinPrice !== undefined && !Number.isNaN(parsedMinPrice)
        ? parsedMinPrice
        : undefined,
    maxPrice:
      parsedMaxPrice !== undefined && !Number.isNaN(parsedMaxPrice)
        ? parsedMaxPrice
        : undefined,
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 20,
  });
}

@Get('products/price-range')
getPriceRange(
  @Query('categoryId') categoryId?: string,
  @Query('categorySlug') categorySlug?: string,
  @Query('condition') condition?: string,
  @Query('flash') flash?: string,
  @Query('q') q?: string,
  @Query('minPrice') minPrice?: string,
  @Query('maxPrice') maxPrice?: string,
) {
  return this.service.getPriceRange({
    categoryId,
    categorySlug,
    condition,
    flash,
    q,
    minPrice:
      minPrice !== undefined && minPrice !== '' ? Number(minPrice) : undefined,
    maxPrice:
      maxPrice !== undefined && maxPrice !== '' ? Number(maxPrice) : undefined,
  });
}


@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Get('admin/products')
adminList(
  @Query('categoryId') categoryId?: string,
  @Query('categorySlug') categorySlug?: string,
  @Query('condition') condition?: string,
  @Query('flash') flash?: string,
  @Query('q') q?: string,
  @Query('minPrice') minPrice?: string,
  @Query('maxPrice') maxPrice?: string,
  @Query('page') page?: string,
  @Query('limit') limit?: string,
  @Query('status') status?: string,
) {
  const parsedMinPrice =
    minPrice !== undefined && minPrice !== ''
      ? Number(minPrice)
      : undefined;

  const parsedMaxPrice =
    maxPrice !== undefined && maxPrice !== ''
      ? Number(maxPrice)
      : undefined;

  const normalizedStatus =
    status === 'archived' || status === 'all' ? status : 'active';

  return this.service.findAllForAdmin({
    categoryId,
    categorySlug,
    condition,
    flash,
    q,
    minPrice:
      parsedMinPrice !== undefined && !Number.isNaN(parsedMinPrice)
        ? parsedMinPrice
        : undefined,
    maxPrice:
      parsedMaxPrice !== undefined && !Number.isNaN(parsedMaxPrice)
        ? parsedMaxPrice
        : undefined,
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 20,
    status: normalizedStatus,
  });
}

  // =====================================================
  // 5️⃣ PRODUCT DETAILS (INTERNAL: BY ID)
  // =====================================================
  @Get('products/by-id/:id')
  byId(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOneById(id);
  }




  // =====================================================
  // 5️⃣ PRODUCT DETAILS
  // =====================================================
  @Get('products/:slug')
  bySlug(@Param('slug') slug: string) {
    return this.service.findOneBySlug(slug);
  }




  @Get('ping')
ping() {
  return {
    ok: true,
    time: Date.now(),
  };
}


  // =====================================================
  // 6️⃣ FLASH DEALS
  // =====================================================
 @Get('flash-deals')
flashDeals(
  @Query('page') page?: string,
  @Query('limit') limit?: string,
) {
  return this.service.flashDeals({
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 20,
  });
}




 

  @UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')

@Delete('products/:productId/media/:mediaId')
async deleteMedia(
  @Param('productId', new ParseUUIDPipe()) productId: string,
  @Param('mediaId', new ParseUUIDPipe()) mediaId: string,
) {
  return this.service.deleteProductMedia(productId, mediaId);
}


@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')

@Post('upload/product-video')
@UseInterceptors(
  FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith('video/')) {
        return cb(new BadRequestException('Only video files allowed'), false);
      }
      cb(null, true);
    },
  }),
)
async uploadProductVideo(
  @UploadedFile() file: Express.Multer.File,
) {
  if (!file) {
    return { message: 'No video uploaded' };
  }

  const cloudinary = getCloudinary();

  const result = await new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'client-0/videos',
        resource_type: 'video', // 🔥 IMPORTANT
      },
      (error, res) => {
        if (error) return reject(error);
        resolve(res);
      },
    );
    stream.end(file.buffer);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    duration: result.duration,
    format: result.format,
    bytes: result.bytes,
  };
}

  

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Delete('products/:productId')
async deleteProduct(
  @Param('productId', new ParseUUIDPipe()) productId: string,
) {
  return this.service.deleteProduct(productId);
}



@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Patch('admin/products/:productId/restore')
restoreProduct(
  @Param('productId', new ParseUUIDPipe()) productId: string,
) {
  return this.service.restoreProduct(productId);
}


@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Patch('admin/products/:productId/archive')
archiveProduct(
  @Param('productId', new ParseUUIDPipe()) productId: string,
) {
  return this.service.archiveProduct(productId);
}


@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')

@Patch('products/:productId/full-update')
@UseInterceptors(
  FileFieldsInterceptor(
    [
      { name: 'images', maxCount: 10 },
      { name: 'video', maxCount: 1 },
    ],
    {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    },
  ),
)
async fullUpdateProduct(
  @Param('productId', new ParseUUIDPipe()) productId: string,
  @UploadedFiles()
  files: {
    images?: Express.Multer.File[];
    video?: Express.Multer.File[];
  },
  @Body('data') data: string,
) {
  if (!data) {
    throw new BadRequestException('Product data is required');
  }




  // 👉 এখানেই বসাবে
  let parsedData: any;
  try {
    parsedData = JSON.parse(data);
  } catch {
    throw new BadRequestException('Invalid JSON in data field');
  }


  return this.service.fullUpdateProduct(
    productId,
    parsedData,
    files?.images || [],
    files?.video?.[0],
  );
}

}
