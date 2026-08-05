import { BadRequestException } from '@nestjs/common';

export const imageMulterOptions = {
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req: any, file: Express.Multer.File, cb: any) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(
        new BadRequestException('Only JPG, PNG, WEBP images are allowed'),
        false,
      );
    }
    cb(null, true);
  },
};
