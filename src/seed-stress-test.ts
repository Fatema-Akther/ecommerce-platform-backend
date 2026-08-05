// // src/seed-stress-test.ts

// import 'reflect-metadata';
// import { DataSource } from 'typeorm';
// import { config } from 'dotenv';

// import { Product } from './modules/products/product.entity';
// import { Category } from './modules/categories/category.entity';
// import { ProductMedia } from './modules/products/product-media.entity';
// import { ProductVariant } from './modules/products/product-variant.entity';

// config();

// console.log('SEED FILE STARTED');

// const AppDataSource = new DataSource({
//   type: 'postgres',
//   host: process.env.DB_HOST,
//   port: Number(process.env.DB_PORT || 5432),
//   username: process.env.DB_USER,
//   password: process.env.DB_PASS,
//   database: process.env.DB_NAME,
//   entities: [Product, Category, ProductMedia, ProductVariant],
//   synchronize: false,
//   ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
// });

// function rand(min: number, max: number) {
//   return Math.floor(Math.random() * (max - min + 1)) + min;
// }

// async function seed() {
//   await AppDataSource.initialize();

//   const categoryRepo = AppDataSource.getRepository(Category);
//   const productRepo = AppDataSource.getRepository(Product);
//   const mediaRepo = AppDataSource.getRepository(ProductMedia);
//   const variantRepo = AppDataSource.getRepository(ProductVariant);

//   console.log('Seeding started...');

//   const categories: Category[] = [];

//   for (let i = 1; i <= 20; i++) {
//     const category = categoryRepo.create({
//       name: `Stress Category ${i}`,
//       slug: `stress-category-${i}`,
//       isActive: true,
//     });

//     categories.push(await categoryRepo.save(category));
//   }

//   const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
//   const colors = ['Red', 'Blue', 'Black', 'White', 'Green'];

//   for (let i = 1; i <= 1000; i++) {
//     const price = rand(500, 5000);
//     const discountPrice = rand(300, price);
//     const totalStock = rand(20, 300);

//     const product = productRepo.create({
//       name: `Stress Product ${i}`,
//       slug: `stress-product-${i}`,
//       description: `Dummy product ${i} for Loader.io stress testing.`,
//       price,
//       discountPrice,
//       sku: `STRESS-SKU-${i}`,
//       stock: totalStock,
//       totalStock,
//       condition: 'new',
//       isFlashDeal: i <= 100,
//       flashStartAt: i <= 100 ? new Date() : null,
//       flashEndAt: i <= 100
//         ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
//         : null,
//       rating: Number((Math.random() * 5).toFixed(2)),
//       category: categories[rand(0, categories.length - 1)],
//       isPublished: true,
//       archivedAt: null,
//       hasVariants: true,
//       thumbnailUrl: `https://picsum.photos/seed/stress-${i}/600/800`,
//     } as any);

//     const savedProduct = await productRepo.save(product as any);

//     const mediaCount = rand(3, 5);

//     for (let m = 1; m <= mediaCount; m++) {
//       await mediaRepo.save({
//         product: savedProduct as any,
//         type: 'image',
//         url: `https://picsum.photos/seed/stress-${i}-${m}/600/800`,
//         position: m,
//         publicId: null,
//         width: 600,
//         height: 800,
//         format: 'jpg',
//       } as any);
//     }

//     const variantCount = rand(2, 5);

//     for (let v = 1; v <= variantCount; v++) {
//       const options = {
//         Size: sizes[v - 1],
//         Color: colors[rand(0, colors.length - 1)],
//       };

//       const combinationKey = Object.entries(options)
//         .sort(([a], [b]) => a.localeCompare(b))
//         .map(([key, value]) => `${key}:${value}`)
//         .join('|');

//       await variantRepo.save({
//         product: savedProduct as any,
//         options,
//         combinationKey,
//         extraPrice: rand(0, 300),
//         stock: rand(5, 80),
//         sku: `STRESS-${i}-${v}`,
//         isActive: true,
//         colorCode: null,
//       } as any);
//     }

//     if (i % 100 === 0) {
//       console.log(`${i} products inserted...`);
//     }
//   }

//   await AppDataSource.destroy();
// }

// seed()
//   .then(() => {
//     console.log('Seeding completed!');
//     process.exit(0);
//   })
//   .catch((err) => {
//     console.error('Seeding failed:', err);
//     process.exit(1);
//   });



// src/seed-production-stress.ts
import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';

import { Product } from './modules/products/product.entity';
import { Category } from './modules/categories/category.entity';
import { ProductMedia } from './modules/products/product-media.entity';
import { ProductVariant } from './modules/products/product-variant.entity';

config();

const ds = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Product, Category, ProductMedia, ProductVariant],
  synchronize: false,
  ssl: { rejectUnauthorized: false },
});

const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const cloudinaryImages = [
  "https://res.cloudinary.com/do5kmk79c/image/upload/v1781203882/client-0/images/fcegot3flcmjcwfxctqk.jpg",
  "https://res.cloudinary.com/do5kmk79c/image/upload/v1781278265/product4_gmksoe.jpg",
  "https://res.cloudinary.com/do5kmk79c/image/upload/v1781278265/banner8_qajllt.jpg",
  "https://res.cloudinary.com/do5kmk79c/image/upload/v1781278286/banner10_bkakey.png",
  "https://res.cloudinary.com/do5kmk79c/image/upload/v1781278286/newsletter-bg_imj4p5.jpg",
  "https://res.cloudinary.com/do5kmk79c/image/upload/v1781278286/newsletter-bg1_h894wj.jpg",
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing');

  await ds.initialize();
  console.log('Connected to production DB');

  const categoryRepo = ds.getRepository(Category);
  const productRepo = ds.getRepository(Product);
  const mediaRepo = ds.getRepository(ProductMedia);
  const variantRepo = ds.getRepository(ProductVariant);

  // const existingStress = await productRepo.count({ where: { slug: 'stress-product-1' as any } });
  // if (existingStress > 0) throw new Error('Stress products already exist. Stop to avoid duplicates.');

  // Categories
  const categories: Category[] = [];
for (let i = 1; i <= 20; i++) {
  const existingCategory = await categoryRepo.findOne({ where: { slug: `stress-category-${i}` } });
  if (!existingCategory) {
    const category = await categoryRepo.save({
      name: `Stress Category ${i}`,
      slug: `stress-category-${i}`,
      isActive: true,
    } as any);
    categories.push(category);
  } else {
    categories.push(existingCategory);
  }
}

  const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
  const colors = ['Red', 'Blue', 'Black', 'White', 'Green'];

  // Products
  for (let i = 1; i <= 1000; i++) {
  const slug = `stress-product-${i}`;

  // Skip if already exists
  const existingProduct = await productRepo.findOne({ where: { slug } });
  if (existingProduct) continue;

  const price = rand(500, 5000);
  const totalStock = rand(20, 300);

  const product = await productRepo.save({
    name: `Stress Product ${i}`,
    slug,
    description: `Dummy production stress-test product ${i}.`,
    price,
    discountPrice: rand(300, price),
    sku: `STRESS-SKU-${i}`,
    stock: totalStock,
    totalStock,
    condition: 'new',
    isFlashDeal: i <= 100,
    flashStartAt: i <= 100 ? new Date() : null,
    flashEndAt: i <= 100 ? new Date(Date.now() + 7*24*60*60*1000) : null,
    rating: Number((Math.random() * 5).toFixed(2)),
    category: categories[rand(0, categories.length - 1)],
    isPublished: true,
    archivedAt: null,
    hasVariants: true,
    thumbnailUrl: cloudinaryImages[i % cloudinaryImages.length],
  } as any);

  // Media
  for (let m = 0; m < rand(3,5); m++) {
    await mediaRepo.save({
      product,
      type: 'image',
      url: cloudinaryImages[(i+m) % cloudinaryImages.length],
      publicId: null,
      width: 600,
      height: 800,
      format: 'jpg',
      position: m + 1,
    } as any);
  }

  // Variants
  for (let v = 1; v <= rand(2,5); v++) {
    const options = { Size: sizes[v-1], Color: colors[rand(0, colors.length-1)] };
    const combinationKey = Object.entries(options)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([key,val]) => `${key}:${val}`)
      .join('|');

    await variantRepo.save({
      product,
      options,
      combinationKey,
      extraPrice: rand(0,300),
      stock: rand(5,80),
      sku: `STRESS-${i}-${v}`,
      isActive: true,
      colorCode: null,
    } as any);
  }

  if (i % 100 === 0) console.log(`${i} products processed`);

  }

  await ds.destroy();
  console.log('Production stress seed completed');
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});