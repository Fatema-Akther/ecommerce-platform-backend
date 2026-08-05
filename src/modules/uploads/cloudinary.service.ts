import { Injectable } from '@nestjs/common';
import { getCloudinary } from '../../config/cloudinary.config';

@Injectable()
export class CloudinaryService {
  async uploadImage(buffer: Buffer, folder = 'client-0/images') {
    const cloudinary = getCloudinary();

    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (error, res) => {
          if (error) return reject(error);
          resolve(res);
        },
      );
      stream.end(buffer);
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    };
  }

 async deleteByPublicId(publicId: string, resourceType: 'image' | 'video') {
  const cloudinary = getCloudinary();
  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
  });


  }
}
