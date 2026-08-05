import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Product } from './product.entity';
import { Category } from '../categories/category.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductMedia } from './product-media.entity';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { getCloudinary } from 'src/config/cloudinary.config';
import { FrontendProductDto, FrontendVariantDto, ProductCardDto } from './dto/product.dto';
import { createHash, randomBytes } from 'crypto';
import { ProductVariant } from './product-variant.entity';
import { OrderItem } from '../orders/order-item.entity';
import { CartItem } from '../cart/cart-item.entity';
import { CartCacheService } from 'src/common/cache/cart-cache.service';

@Injectable()
export class ProductsService {
  constructor(
  @InjectRepository(Product) private repo: Repository<Product>,
  @InjectRepository(Category) private catRepo: Repository<Category>,
  @InjectRepository(ProductMedia) private mediaRepo: Repository<ProductMedia>,
  @InjectRepository(ProductVariant) private variantRepo: Repository<ProductVariant>,
  private readonly cloud: CloudinaryService,
  @InjectRepository(OrderItem)
  private orderItemRepo: Repository<OrderItem>,
  @InjectRepository(CartItem)
  private cartItemRepo: Repository<CartItem>,

    private readonly cache: CartCacheService,
) {}




private applyPublishedFilter(
  qb: SelectQueryBuilder<Product>,
  alias = 'p',
) {
  return qb.andWhere(`${alias}.isPublished = :isPublished`, {
    isPublished: true,
  });
}

private async cleanupCartItemsByProductId(productId: string) {
  await this.cartItemRepo
    .createQueryBuilder()
    .delete()
    .from(CartItem)
    .where(`"productId" = :productId`, { productId })
    .execute();
}

private async getOrderUsageCount(productId: string) {
  return this.orderItemRepo
    .createQueryBuilder('oi')
    .innerJoin('oi.product', 'p')
    .where('p.id = :productId', { productId })
    .getCount();
}




private generateSku() {
  const rand = randomBytes(3).toString("hex").toUpperCase(); // 6
  return `PRD-${Date.now()}-${rand}`; // < 40 chars
}


private generateVariantSku(
  productSku: string | null | undefined,
  options: Record<string, string>,
) {
  const baseSku = productSku || this.generateSku();
  const combinationKey = this.buildCombinationKey(options);

  const hash = createHash('sha1')
    .update(combinationKey)
    .digest('hex')
    .slice(0, 6)
    .toUpperCase();

  return `${baseSku}-V-${hash}`.slice(0, 64);
}


private slugify(value: string) {
  const slug = String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || 'product';
}

private async generateUniqueSlug(nameOrSlug: string) {
  const baseSlug = this.slugify(nameOrSlug).slice(0, 180);
  let candidate = baseSlug;
  let counter = 2;

  while (true) {
    const exists = await this.repo.findOne({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!exists) return candidate;

    candidate = `${baseSlug}-${counter}`;
    counter++;

    if (candidate.length > 200) {
      const suffix = `-${counter}`;
      candidate = `${baseSlug.slice(0, 200 - suffix.length)}${suffix}`;
    }
  }
}



private getOptimizedCloudinaryUrl(url: string) {
  if (!url.includes("res.cloudinary.com")) return url;

  return url.replace(
    "/upload/",
    "/upload/f_auto,q_auto:good,c_limit,w_1200/"
  );
};

private toFrontendProduct(
  p: Product,
  soldCount = 0,
  variantSoldMap?: Map<string, number>,
): FrontendProductDto {
  const baseId = p.id;
  const now = new Date();
    const activeVariants = this.getActiveVariants(p);

    // NEW: O(1 lookup map
const variantMap = new Map<string, ProductVariant>();

for (const v of activeVariants) {
  variantMap.set(v.id, v);
  variantMap.set((v as any).combinationKey, v);
}

  const priceNum = Number(p.price ?? 0);

  const flashStarted = p.flashStartAt ? new Date(p.flashStartAt) <= now : true;
  const flashNotEnded = p.flashEndAt ? now <= new Date(p.flashEndAt) : true;
  const flashActive = !!p.isFlashDeal && flashStarted && flashNotEnded;

  const images =
    (p.media ?? [])
      .filter(
        (m) =>
          m.type === 'image' &&
          typeof m.url === 'string' &&
          m.url.startsWith('http'),
      )
     .map((m) => ({
  _id: m.id,
  image: {
    alterImage: null,
    public_id: m.publicId ?? '',
    secure_url: m.url,
    optimizeUrl: this.getOptimizedCloudinaryUrl(m.url),
  },
  alterImage: {
    public_id: m.publicId ?? '',
    secure_url: m.url,
    optimizeUrl: this.getOptimizedCloudinaryUrl(m.url),
  },
})) ?? [];

  const video =
    (p.media ?? [])
      .filter(
        (m) =>
          m.type === 'video' &&
          typeof m.url === 'string' &&
          m.url.startsWith('http'),
      )
      .map((m) => ({
        _id: m.id,
        video: {
          public_id: m.publicId ?? '',
          secure_url: m.url,
        },
        alterVideo: {
          public_id: m.publicId ?? '',
          secure_url: m.url,
        },
      })) ?? [];

/////
const variantGroups = (() => {
  const groupMap = new Map<
    string,
    Map<
      string,
      {
        id: string;
        value: string;
        stock: number;
        extraPrice: number;
          colorCode?: string | null;
      }
    >
  >();

for (const v of activeVariants) {
    const options = ((v as any).options ?? {}) as Record<string, string>;
    const comboStock = Number(v.stock ?? 0);

    for (const [groupNameRaw, optionValueRaw] of Object.entries(options)) {
      const groupName = String(groupNameRaw).trim();
      const optionValue = String(optionValueRaw).trim();

      if (!groupName || !optionValue) continue;

      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, new Map());
      }

      const valueMap = groupMap.get(groupName)!;

      if (!valueMap.has(optionValue)) {
       valueMap.set(optionValue, {
  id: `${groupName}:${optionValue}`,
  value: optionValue,
  stock: 0,
  extraPrice: 0,
  colorCode: null,
});
      }

      const current = valueMap.get(optionValue)!;
      current.stock += comboStock;

      if (
  groupName.toLowerCase() === 'color' &&
  !current.colorCode &&
  (v as any).colorCode
) {
  current.colorCode = (v as any).colorCode;
}
    }
  }

  return Array.from(groupMap.entries()).map(([name, valuesMap]) => ({
    name,
    values: Array.from(valuesMap.values()),
  }));
})();






 const computedVariants: FrontendVariantDto[] =
 activeVariants.map((v) => {
    const rawOptions = ((v as any).options ?? {}) as Record<string, unknown>;

    const options: Record<string, string> = Object.fromEntries(
      Object.entries(rawOptions).map(([key, value]) => [
        String(key),
        String(value),
      ]),
    );

    const optionValues: string[] = Object.values(options);

    const extraPriceNum = Number(v.extraPrice ?? 0);

    const regularPrice = priceNum + extraPriceNum;
    const offerPrice =
      flashActive && p.discountPrice != null
        ? Number(p.discountPrice) + extraPriceNum
        : regularPrice;

    const label = Object.entries(options)
      .map(([k, val]) => `${k}: ${val}`)
      .join(' | ');

    return {
      id: v.id,
      _id: v.id,
      productId: p.id,
      name: label || 'Variant',
      colorCode: (v as any).colorCode ?? null,
      image: null,
      barcode: '',
      sku: (v as any).sku ?? p.sku ?? '',
      selling_price: regularPrice.toFixed(2),
      condition: p.condition ?? 'new',
      discount_type: null,
      discount_percent: '0',
      discount_amount: '0',
      discount_start_date: p.flashStartAt
        ? new Date(p.flashStartAt).toISOString()
        : null,
      discount_end_date: p.flashEndAt
        ? new Date(p.flashEndAt).toISOString()
        : null,
      offer_price: offerPrice.toFixed(2),
      variants_stock: Number(v.stock ?? 0),
      variants_values: optionValues.length ? optionValues : null,
      total_sold: variantSoldMap?.get(v.id) ?? 0,
      isPublish: true,
      isPreOrder: false,
      options,
      combinationKey: String((v as any).combinationKey ?? ''),
    };
  }) ?? [];




  const defaultVariant = {
    id: baseId,
    _id: baseId,
    productId: baseId,
    name: 'Default',
    image: null,
    barcode: '',
    sku: p.sku ?? '',
    weight: Number(p.weight ?? 0),
    selling_price: priceNum.toFixed(2),
    condition: p.condition ?? 'new',
    discount_type: null,
    discount_percent:
      flashActive && p.discountPrice != null && Number(p.discountPrice) < priceNum
        ? String(
            Math.round(
              ((priceNum - Number(p.discountPrice)) / priceNum) * 100,
            ),
          )
        : '0',
    discount_amount:
      flashActive && p.discountPrice != null && Number(p.discountPrice) < priceNum
        ? (priceNum - Number(p.discountPrice)).toFixed(2)
        : '0',
    discount_start_date: p.flashStartAt
      ? new Date(p.flashStartAt).toISOString()
      : null,
    discount_end_date: p.flashEndAt
      ? new Date(p.flashEndAt).toISOString()
      : null,
    offer_price:
      flashActive && p.discountPrice != null
        ? Number(p.discountPrice).toFixed(2)
        : priceNum.toFixed(2),
    variants_stock: Number(p.stock ?? 0),
    variants_values: null,
   total_sold: soldCount,
    isPublish: true,
    isPreOrder: false,
  };

const variantsToSend: FrontendVariantDto[] =
  computedVariants.length > 0 ? computedVariants : [defaultVariant];

  const baseOfferNum =
    flashActive && p.discountPrice != null ? Number(p.discountPrice) : priceNum;

  return {
    sku: p.sku ?? '',
    id: p.id,
    _id: p.id,
     weight: Number(p.weight ?? 0),
    slug: p.slug ?? '',
    isFlashDeal: flashActive,
    flashEndAt: p.flashEndAt ? new Date(p.flashEndAt).toISOString() : null,
    flashdeal: flashActive
      ? {
          isFlashDeal: true,
          startAt: p.flashStartAt
            ? new Date(p.flashStartAt).toISOString()
            : null,
          endAt: p.flashEndAt ? new Date(p.flashEndAt).toISOString() : null,
          offerPrice: baseOfferNum,
          discountPercent:
            priceNum > 0 && baseOfferNum < priceNum
              ? Math.round(((priceNum - baseOfferNum) / priceNum) * 100)
              : 0,
        }
      : null,
    category_group: p.category?.parent
      ? [{ _id: p.category.parent.id, name: p.category.parent.name }]
      : p.category
      ? [{ _id: p.category.id, name: p.category.name }]
      : [],
    name: p.name ?? '',
    short_description: p.description ?? '',
    long_description: p.description ?? '',
    tags: [],
    images,
    video,
    brand: { _id: '', name: '' },
    sizeGuard: null,
    sub_category: p.category
      ? [{ _id: p.category.id, name: p.category.name }]
      : [],
      
   total_stock: this.getTotalStock(p),
   total_sold: soldCount,
   hasVariants: variantGroups.length > 0,
  variantGroups,
  variantsId: variantsToSend,
currency: (
  process.env.STORE_CURRENCY || 'USD'
).toUpperCase(),

  isPublish: p.isPublished !== false,
    selling_price: priceNum,
  };
}





// private toProductCard(p: Product): ProductCardDto {
//   const now = new Date();
//   const flashStarted = p.flashStartAt ? new Date(p.flashStartAt) <= now : true;
//   const flashNotEnded = p.flashEndAt ? now <= new Date(p.flashEndAt) : true;
//   const flashActive = !!p.isFlashDeal && flashStarted && flashNotEnded;

//   return {
//     id: p.id,
//     slug: p.slug,
//     name: p.name,
//     image: p.thumbnailUrl ? this.getOptimizedCloudinaryUrl(p.thumbnailUrl) : null,
//     price: Number(p.price),
//     offerPrice: flashActive && p.discountPrice ? Number(p.discountPrice) : Number(p.price),
//     stock: p.hasVariants ? Number(p.totalStock ?? 0) : Number(p.stock ?? 0),
//     hasVariants: !!p.hasVariants,

    
//     isFlashDeal: flashActive,
//   };
// }



private toProductCard(p: Product): ProductCardDto {
  const now = new Date();
  const flashStarted = p.flashStartAt ? new Date(p.flashStartAt) <= now : true;
  const flashNotEnded = p.flashEndAt ? now <= new Date(p.flashEndAt) : true;
  const flashActive = !!p.isFlashDeal && flashStarted && flashNotEnded;

  const activeVariants = this.getActiveVariants(p);

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    image: p.thumbnailUrl
      ? this.getOptimizedCloudinaryUrl(p.thumbnailUrl)
      : null,

    price: Number(p.price),

    offerPrice:
      flashActive && p.discountPrice
        ? Number(p.discountPrice)
        : Number(p.price),

    stock: p.hasVariants
      ? activeVariants.reduce(
          (sum, v) => sum + Number(v.stock ?? 0),
          0,
        )
      : Number(p.stock ?? 0),

    hasVariants: activeVariants.length > 0,

    variantsId: activeVariants.map((v) => ({
      id: v.id,
      _id: v.id,
      variants_stock: Number(v.stock ?? 0),
      variants_values: Object.values(v.options ?? {}),
    })),

    isFlashDeal: flashActive,
  };
}

private getFirstImageUrl(product: Product) {
  const firstImage = (product.media ?? []).find(
    (m) => m.type === 'image',
  );

  return firstImage?.url ?? null;
}



private applyActiveFlashFilter(qb: SelectQueryBuilder<Product>) {
  const now = new Date();

  return qb
    .andWhere('p.isFlashDeal = :isFlashDeal', { isFlashDeal: true })
    .andWhere('p.discountPrice IS NOT NULL')
    .andWhere('p.discountPrice > 0')
    .andWhere('p.discountPrice < p.price')
    .andWhere('(p.flashStartAt IS NULL OR p.flashStartAt <= :now)', { now })
    .andWhere('(p.flashEndAt IS NULL OR p.flashEndAt >= :now)', { now });
}


private getTotalStock(p: Product) {
  const variants = this.getActiveVariants(p);

  if (!variants.length) {
    return Number(p.stock ?? 0);
  }

  return variants.reduce((sum, variant) => {
    return sum + Number(variant.stock ?? 0);
  }, 0);
}




private async getProductSoldMap(productIds: string[]) {
  const ids = [...new Set(productIds.filter(Boolean))];
  const soldMap = new Map<string, number>();

  if (!ids.length) return soldMap;

  const rows = await this.orderItemRepo
    .createQueryBuilder('oi')
    .innerJoin('oi.order', 'o')
    .innerJoin('oi.product', 'p')
    .select('p.id', 'productId')
    .addSelect('COALESCE(SUM(oi.quantity), 0)', 'totalQty')
    .where('p.id IN (:...ids)', { ids })
    .andWhere('o.status = :status', { status: 'completed' })
    .groupBy('p.id')
    .getRawMany<{ productId: string; totalQty: string }>();

  for (const row of rows) {
    soldMap.set(row.productId, Number(row.totalQty ?? 0));
  }

  return soldMap;
}

private async getVariantSoldMap(variantIds: string[]) {
  const ids = [...new Set(variantIds.filter(Boolean))];
  const soldMap = new Map<string, number>();

  if (!ids.length) return soldMap;

  const rows = await this.orderItemRepo
    .createQueryBuilder('oi')
    .innerJoin('oi.order', 'o')
    .select('oi.variantId', 'variantId')
    .addSelect('COALESCE(SUM(oi.quantity), 0)', 'totalQty')
    .where('oi.variantId IN (:...ids)', { ids })
    .andWhere('o.status = :status', { status: 'completed' })
    .groupBy('oi.variantId')
    .getRawMany<{ variantId: string; totalQty: string }>();

  for (const row of rows) {
    soldMap.set(row.variantId, Number(row.totalQty ?? 0));
  }

  return soldMap;
}



private getEffectivePriceSql(alias = 'p') {
  return `
    CASE
      WHEN ${alias}."isFlashDeal" = true
        AND ${alias}."discountPrice" IS NOT NULL
        AND ${alias}."discountPrice" > 0
        AND ${alias}."discountPrice" < ${alias}.price
        AND (${alias}."flashStartAt" IS NULL OR ${alias}."flashStartAt" <= NOW())
        AND (${alias}."flashEndAt" IS NULL OR ${alias}."flashEndAt" >= NOW())
      THEN ${alias}."discountPrice"
      ELSE ${alias}.price
    END
  `;
}

private applyFindAllFilters(
  qb: SelectQueryBuilder<Product>,
  query: {
    categoryId?: string;
    categorySlug?: string;
    condition?: string;
    flash?: string;
    q?: string;
    minPrice?: number;
    maxPrice?: number;
  },
  includePriceFilter = true,
) {
 if (query.categoryId) {
  qb.andWhere('(c.id = :categoryId OR cp.id = :categoryId)', {
    categoryId: query.categoryId,
  });
}

  if (query.categorySlug) {
    qb.andWhere('(c.slug = :slug OR cp.slug = :slug)', {
      slug: query.categorySlug,
    });
  }

  if (query.condition) {
    qb.andWhere('p.condition = :cond', { cond: query.condition });
  }

  if (query.flash === 'true') {
    this.applyActiveFlashFilter(qb);
  }

  if (query.q) {
    qb.andWhere(
      '(p.name ILIKE :q OR p.slug ILIKE :q OR p.description ILIKE :q)',
      { q: `%${query.q}%` },
    );
  }

if (includePriceFilter) {
  const effectivePriceSql = this.getEffectivePriceSql('p');

  if (query.minPrice !== undefined && query.minPrice !== null) {
    qb.andWhere(`${effectivePriceSql} >= :minPrice`, {
      minPrice: Number(query.minPrice),
    });
  }

  if (query.maxPrice !== undefined && query.maxPrice !== null) {
    qb.andWhere(`${effectivePriceSql} <= :maxPrice`, {
      maxPrice: Number(query.maxPrice),
    });
  }
}
  return qb;
}



private resolveVariantStock(
  product: Product,
  variant?: { stock?: number | null } | null,
) {
  if (variant && variant.stock !== null && variant.stock !== undefined) {
    return Number(variant.stock);  // variant stock return করবে
  }

  // Fallback case: Variant stock not provided, use product.stock
  return Number(product.stock ?? 0);  // default to product stock
}




private normalizeVariantStockInput(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return Number(value);
}


private normalizeVariantOptions(input: Record<string, string>) {
  const entries = Object.entries(input || {})
    .map(([k, v]) => [String(k).trim(), String(v).trim()] as const)
    .filter(([k, v]) => k && v)
    .sort(([a], [b]) => a.localeCompare(b));

  if (!entries.length) {
    throw new BadRequestException('Variant options are required');
  }

  return Object.fromEntries(entries);
}


private normalizeVariantColorCode(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const colorCode = String(value).trim();

  if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(colorCode)) {
    throw new BadRequestException('Color code must be a valid hex code');
  }

  return colorCode;
}

private buildCombinationKey(options: Record<string, string>) {
  return Object.entries(options)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('|');
}



private async getVariantUsageCount(variantId: string) {
  const orderUsageCount = await this.orderItemRepo
    .createQueryBuilder('oi')
    .where('oi.variantId = :variantId', { variantId })
    .getCount();

  const cartUsageCount = await this.cartItemRepo
    .createQueryBuilder('ci')
    .where('ci.variantId = :variantId', { variantId })
    .getCount();

  return orderUsageCount + cartUsageCount;
}

private getActiveVariants(product: Product) {
  return (product.variants ?? []).filter((variant: any) => {
    return variant.isActive !== false;
  });
}

private async syncProductVariants(product: Product, incomingVariants: any[]) {
  const existingVariants = await this.variantRepo.find({
    where: {
      product: { id: product.id } as any,
    },
  });

  const existingByCombinationKey = new Map<string, ProductVariant>();

  for (const variant of existingVariants) {
    existingByCombinationKey.set(variant.combinationKey, variant);
  }

  const incomingKeys = new Set<string>();

  const cleanIncomingVariants = incomingVariants.filter(
    (variant: any) => variant?.options && typeof variant.options === 'object',
  );

  for (const incoming of cleanIncomingVariants) {
    const normalizedOptions = this.normalizeVariantOptions(incoming.options);
    const combinationKey = this.buildCombinationKey(normalizedOptions);

    if (incomingKeys.has(combinationKey)) {
      throw new BadRequestException(
        `Duplicate variant combination: ${combinationKey}`,
      );
    }

    incomingKeys.add(combinationKey);

    const existingVariant = existingByCombinationKey.get(combinationKey);

    if (existingVariant) {
      existingVariant.options = normalizedOptions;
      existingVariant.combinationKey = combinationKey;
      existingVariant.extraPrice = Number(incoming.extraPrice ?? 0);
      existingVariant.stock = Number(incoming.stock ?? 0);
existingVariant.sku =
  existingVariant.sku ||
  this.generateVariantSku(product.sku, normalizedOptions);
      existingVariant.isActive = true;
      if (Object.prototype.hasOwnProperty.call(incoming, 'colorCode')) {
  existingVariant.colorCode = this.normalizeVariantColorCode(incoming.colorCode);
}

      await this.variantRepo.save(existingVariant);
      continue;
    }

    const newVariant = this.variantRepo.create({
      product,
      options: normalizedOptions,
      combinationKey,
      extraPrice: Number(incoming.extraPrice ?? 0),
      stock: Number(incoming.stock ?? 0),
     sku: this.generateVariantSku(product.sku, normalizedOptions),
      isActive: true,
      colorCode: this.normalizeVariantColorCode(incoming.colorCode),
    });

    await this.variantRepo.save(newVariant);
  }

  const removedVariants = existingVariants.filter(
    (variant) => !incomingKeys.has(variant.combinationKey),
  );

  for (const removedVariant of removedVariants) {
    const usageCount = await this.getVariantUsageCount(removedVariant.id);

    if (usageCount > 0) {
      removedVariant.stock = 0;
      removedVariant.isActive = false;

      await this.variantRepo.save(removedVariant);
      continue;
    }

    await this.variantRepo.remove(removedVariant);
  }
}


async create(dto: CreateProductDto) {
  const category = await this.catRepo.findOne({ where: { id: dto.categoryId } });
  if (!category) throw new BadRequestException('Invalid categoryId');

const uniqueSlug = await this.generateUniqueSlug(dto.slug?.trim() || dto.name);
const productSku = this.generateSku();

const product = this.repo.create({
  name: dto.name,
slug: uniqueSlug,
  description: dto.description,
  price: dto.price,
  discountPrice: dto.discountPrice,

  // SKU always auto generated
 sku: productSku,

 

  stock: dto.stock ?? 0,
weight: dto.weight ?? undefined,
  length: dto.length,
  width: dto.width,
  height: dto.height,
  condition: dto.condition ?? 'new',
  isFlashDeal: dto.isFlashDeal ?? false,
  flashStartAt: dto.flashStartAt ? new Date(dto.flashStartAt) : undefined,
  flashEndAt: dto.flashEndAt ? new Date(dto.flashEndAt) : undefined,
  isPublished: true,
archivedAt: null,

  category,
  media: dto.media?.map((m) => ({
    type: m.type,
    url: m.url,
    publicId: m.publicId,
    position: m.position ?? 0,
    width: m.width,
    height: m.height,
    format: m.format,
  })),

  variants: dto.variants?.map((v) => {
  const normalizedOptions = this.normalizeVariantOptions(v.options);

  return {
    options: normalizedOptions,
    combinationKey: this.buildCombinationKey(normalizedOptions),
    extraPrice: v.extraPrice ?? 0,
    stock: Number(v.stock ?? 0),
sku: this.generateVariantSku(productSku, normalizedOptions),
    colorCode: this.normalizeVariantColorCode((v as any).colorCode),
  };
}),
});


product.thumbnailUrl =
  this.getFirstImageUrl(product);

this.recalculateProductMeta(product);





  for (let i = 0; i < 10; i++) { // 5 -> 10 (optional)
    try {
      const saved = await this.repo.save(product);

if (!saved.thumbnailUrl) {
  const firstImage = await this.mediaRepo.findOne({
    where: {
      product: { id: saved.id },
      type: 'image',
    },
    order: {
      position: 'ASC',
    },
  });

  if (firstImage) {
    saved.thumbnailUrl = firstImage.url;
    await this.repo.save(saved);
  }
}

      const full = await this.repo.findOne({
        where: { id: saved.id },
       relations: { category: { parent: true }, media: true, variants: true },
      });


     await this.cache.clearPattern('products:*');
await this.cache.clearPattern('product:*');
await this.cache.clearPattern('flash:*');

await this.bumpProductsVersion();

      return this.toFrontendProduct(full!);
    } catch (e: any) {
      if (e?.code === '23505') {
        product.sku = this.generateSku();
        continue;
      }
      throw e;
    }
  }

  throw new ConflictException('Could not generate unique SKU');
}



private recalculateProductMeta(
  product: Product,
) {
  const variants =
    this.getActiveVariants(product);

  product.hasVariants =
    variants.length > 0;

  product.totalStock =
    variants.length > 0
      ? variants.reduce(
          (sum, v) =>
            sum + Number(v.stock ?? 0),
          0,
        )
      : Number(product.stock ?? 0);
}




private applyAdminStatusFilter(
  qb: SelectQueryBuilder<Product>,
  status: 'active' | 'archived' | 'all' = 'active',
  alias = 'p',
) {
  if (status === 'active') {
    qb.andWhere(`${alias}.isPublished = :isPublished`, {
      isPublished: true,
    });
  } else if (status === 'archived') {
    qb.andWhere(`${alias}.isPublished = :isPublished`, {
      isPublished: false,
    });
  }

  return qb;
}


private async bumpProductsVersion() {
  await this.cache.set('products:version', Date.now());
}




async findAllForAdmin(query: {
  categoryId?: string;
  categorySlug?: string;
  condition?: string;
  flash?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
  status?: 'active' | 'archived' | 'all';
}) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(query.limit || 20)));
  const skip = (page - 1) * limit;
  const status = query.status ?? 'active';

  const rangeQb = this.repo
    .createQueryBuilder('p')
    .leftJoin('p.category', 'c')
    .leftJoin('c.parent', 'cp');

  this.applyAdminStatusFilter(rangeQb, status);
  this.applyFindAllFilters(rangeQb, query, false);

  const effectivePriceSql = this.getEffectivePriceSql('p');

  const rangeRaw = await rangeQb
    .select(`COALESCE(MIN(${effectivePriceSql}), 0)`, 'minPrice')
    .addSelect(`COALESCE(MAX(${effectivePriceSql}), 0)`, 'maxPrice')
    .getRawOne<{ minPrice: string; maxPrice: string }>();

  const qb = this.repo
    .createQueryBuilder('p')
    .leftJoinAndSelect('p.category', 'c')
    .leftJoinAndSelect('c.parent', 'cp')
    .leftJoinAndSelect('p.media', 'm')
    .leftJoinAndSelect('p.variants', 'v')
    .orderBy('p.createdAt', 'DESC');

  this.applyAdminStatusFilter(qb, status);
  this.applyFindAllFilters(qb, query, true);

  qb.skip(skip).take(limit);

  const [items, total] = await qb.getManyAndCount();

  const soldMap = await this.getProductSoldMap(items.map((p) => p.id));
  const variantSoldMap = await this.getVariantSoldMap(
    items.flatMap((p) => (p.variants ?? []).map((v) => v.id)),
  );

  return {
    items: items.map((p) =>
      this.toFrontendProduct(p, soldMap.get(p.id) ?? 0, variantSoldMap),
    ),
    page,
    limit,
    total,
    hasMore: skip + items.length < total,
    priceRange: {
      min: Number(rangeRaw?.minPrice ?? 0),
      max: Number(rangeRaw?.maxPrice ?? 0),
    },
  };
}




async getPriceRange(query: {
  categoryId?: string;
  categorySlug?: string;
  condition?: string;
  flash?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
}) {
  const qb = this.repo
    .createQueryBuilder('p')
    .leftJoin('p.category', 'c')
    .leftJoin('c.parent', 'cp');

  this.applyPublishedFilter(qb);
  this.applyFindAllFilters(qb, query, false);

  const effectivePriceSql = this.getEffectivePriceSql('p');

  const rangeRaw = await qb
    .select(`COALESCE(MIN(${effectivePriceSql}), 0)`, 'minPrice')
    .addSelect(`COALESCE(MAX(${effectivePriceSql}), 0)`, 'maxPrice')
    .getRawOne<{ minPrice: string; maxPrice: string }>();

  return {
    min: Number(rangeRaw?.minPrice ?? 0),
    max: Number(rangeRaw?.maxPrice ?? 0),
  };
}


async findAll(query: {
  categoryId?: string;
  categorySlug?: string;
  condition?: string;
  flash?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(query.limit || 20)));
  const skip = (page - 1) * limit;

  const versionKey = 'products:version';
  const version = (await this.cache.get(versionKey)) || 1;

  const cacheKey = `products:v${version}:${JSON.stringify({
    ...query,
    page,
    limit,
  })}`;

  // ✅ FIX 1: await missing ছিল
  const cached = await this.cache.get(cacheKey);
  if (cached) return cached;

 const qb = this.repo
  .createQueryBuilder('p')
  .leftJoin('p.category', 'c')
  .leftJoin('c.parent', 'cp')
  .leftJoinAndSelect('p.variants', 'v')
  .select([
  'p.id',
  'p.slug',
  'p.name',
  'p.price',
  'p.discountPrice',
  'p.stock',
  'p.totalStock',
  'p.hasVariants',
  'p.thumbnailUrl',
  'p.isFlashDeal',
  'p.flashStartAt',
  'p.flashEndAt',
  'p.isPublished',
  'p.createdAt',

  'v.id',
  'v.stock',
  'v.options',
  'v.isActive',
])
    .where('p.isPublished = :isPublished', { isPublished: true })
    .orderBy('p.createdAt', 'DESC');

  this.applyFindAllFilters(qb, query, true);

  qb.skip(skip).take(limit);


  const rangeQb = this.repo
  .createQueryBuilder('p')
  .leftJoin('p.category', 'c')
  .leftJoin('c.parent', 'cp');

this.applyPublishedFilter(rangeQb);
this.applyFindAllFilters(
  rangeQb,
  {
    categoryId: query.categoryId,
    categorySlug: query.categorySlug,
    condition: query.condition,
    flash: query.flash,
    q: undefined, // ❗ IMPORTANT
    minPrice: undefined,
    maxPrice: undefined,
  },
  false,
);

const effectivePriceSql = this.getEffectivePriceSql('p');

const rangeRaw = await rangeQb
  .select(`COALESCE(MIN(${effectivePriceSql}), 0)`, 'minPrice')
  .addSelect(`COALESCE(MAX(${effectivePriceSql}), 0)`, 'maxPrice')
  .getRawOne<{ minPrice: string; maxPrice: string }>();

  const [items, total] = await qb.getManyAndCount();

 const result = {
  items: items.map((p) => this.toProductCard(p)),
  page,
  limit,
  total,
  hasMore: skip + items.length < total,
  priceRange: {
    min: Number(rangeRaw?.minPrice ?? 0),
    max: Number(rangeRaw?.maxPrice ?? 0),
  },
};

  // ✅ FIX 2: avoid caching empty result (optional but safe)
  if (items.length > 0) {
    await this.cache.set(cacheKey, result, 10000);
  }

  return result;
}


async findOneBySlug(slug: string) {
  const cacheKey = `product:${slug}`;

 const cached = await this.cache.get(cacheKey);

if (cached) {
  return cached;
}

  const product = await this.repo.findOne({
    where: {
      slug,
      isPublished: true,
    },
    relations: {
      category: { parent: true },
      media: true,
      variants: true,
    },
  });

  if (!product) {
    throw new NotFoundException();
  }

  const soldMap = await this.getProductSoldMap([product.id]);

  const variantSoldMap = await this.getVariantSoldMap(
    (product.variants ?? []).map(v => v.id),
  );

  const result = this.toFrontendProduct(
    product,
    soldMap.get(product.id) ?? 0,
    variantSoldMap,
  );

  this.cache.set(cacheKey, result, 60000); // 1 min

  return result;
}




// async flashDeals(query: {
//   page?: number;
//   limit?: number;
// }) {
//   const page = Math.max(1, query.page || 1);
//   const limit = Math.min(50, query.limit || 20);
//   const skip = (page - 1) * limit;

//   const cacheKey = `flash:deals:${page}:${limit}`;
//  const cached = await this.cache.get(cacheKey);
// if (cached) return cached;

//   const qb = this.repo
//     .createQueryBuilder('p')
//     .select([
//       'p.id',
//       'p.slug',
//       'p.name',
//       'p.price',
//       'p.discountPrice',
//       'p.stock',
//       'p.totalStock',
//       'p.hasVariants',
//       'p.thumbnailUrl',
//       'p.isFlashDeal',
//       'p.flashStartAt',
//       'p.flashEndAt',
//       'p.createdAt',
//     ])
//     .where('p.isPublished = :isPublished', { isPublished: true })
//     .andWhere('p.isFlashDeal = :isFlashDeal', { isFlashDeal: true })
//     .andWhere('p.discountPrice IS NOT NULL')
//     .andWhere('p.discountPrice > 0')
//     .andWhere('p.discountPrice < p.price')
//     .andWhere('(p.flashStartAt IS NULL OR p.flashStartAt <= :now)', { now: new Date() })
//     .andWhere('(p.flashEndAt IS NULL OR p.flashEndAt >= :now)', { now: new Date() })
//     .orderBy('p.createdAt', 'DESC')
//     .skip(skip)
//     .take(limit);

//   const [items, total] = await qb.getManyAndCount();

//   const result = {
//     items: items.map((p) => this.toProductCard(p)),
//     page,
//     limit,
//     total,
//     hasMore: skip + items.length < total,
//   };

// await this.cache.set(cacheKey, result, 10000);
//   return result;
// }

async flashDeals(query: {
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(query.limit || 20)));
  const skip = (page - 1) * limit;

  const cacheKey = `flash:deals:${page}:${limit}`;

  const cached = await this.cache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const now = new Date();

  const qb = this.repo
    .createQueryBuilder('p')
    .leftJoinAndSelect(
      'p.variants',
      'v',
      'v.isActive = :variantIsActive',
      {
        variantIsActive: true,
      },
    )
    .select([
      'p.id',
      'p.slug',
      'p.name',
      'p.price',
      'p.discountPrice',
      'p.stock',
      'p.totalStock',
      'p.hasVariants',
      'p.thumbnailUrl',
      'p.isFlashDeal',
      'p.flashStartAt',
      'p.flashEndAt',
      'p.createdAt',

      'v.id',
      'v.stock',
      'v.options',
      'v.extraPrice',
      'v.sku',
      'v.colorCode',
      'v.combinationKey',
      'v.isActive',
    ])
    .where('p.isPublished = :isPublished', {
      isPublished: true,
    })
    .andWhere('p.isFlashDeal = :isFlashDeal', {
      isFlashDeal: true,
    })
    .andWhere('p.discountPrice IS NOT NULL')
    .andWhere('p.discountPrice > 0')
    .andWhere('p.discountPrice < p.price')
    .andWhere(
      '(p.flashStartAt IS NULL OR p.flashStartAt <= :now)',
      { now },
    )
    .andWhere(
      '(p.flashEndAt IS NULL OR p.flashEndAt >= :now)',
      { now },
    )
    .orderBy('p.createdAt', 'DESC')
    .skip(skip)
    .take(limit);

  const [items, total] = await qb.getManyAndCount();

  const result = {
    items: items.map((product) => this.toProductCard(product)),
    page,
    limit,
    total,
    hasMore: skip + items.length < total,
  };

  if (items.length > 0) {
    await this.cache.set(cacheKey, result, 10000);
  }

  return result;
}


async deleteProductMedia(productId: string, mediaId: string) {
  const media = await this.mediaRepo.findOne({
    where: {
      id: mediaId,
      product: { id: productId },
    },
    relations: { product: true },
  });

  if (!media) {
    throw new NotFoundException('Media not found');
  }






  
 // Cloudinary delete (image / video auto-handle)
if (media.publicId) {
  await this.cloud.deleteByPublicId(
    media.publicId,
    media.type === 'video' ? 'video' : 'image',
  );
}


  // 2️⃣ DB delete
 await this.mediaRepo.remove(media);

const firstImage = await this.mediaRepo.findOne({
  where: {
    product: { id: productId },
    type: 'image',
  },
  order: {
    position: 'ASC',
  },
});

await this.repo.update(productId, {
  thumbnailUrl: firstImage?.url ?? null,
});
await this.cache.clearPattern(`product:${productId}`);
await this.cache.clearPattern('products:*');

await this.bumpProductsVersion();
return { success: true };
}



async deleteProduct(productId: string) {
  const product = await this.repo.findOne({
    where: { id: productId },
    relations: { media: true },
  });

  if (!product) {
    throw new NotFoundException('Product not found');
  }

  // 1) আগে cart cleanup
  await this.cleanupCartItemsByProductId(productId);

  // 2) order history check
  const orderUsageCount = await this.getOrderUsageCount(productId);

  // 3) যদি order history থাকে → archive/unpublish
  if (orderUsageCount > 0) {
    const alreadyArchived = product.isPublished === false;

    product.isPublished = false;
    product.archivedAt = product.archivedAt ?? new Date();

    await this.repo.save(product);

    return {
      success: true,
      action: 'archived',
      message: alreadyArchived
        ? 'Product is already archived.'
        : 'Product has order history, so it was archived/unpublished instead of permanent delete.',
    };
  }

  // 4) order history না থাকলে → hard delete
  for (const media of product.media || []) {
    if (media.publicId) {
      await this.cloud.deleteByPublicId(
        media.publicId,
        media.type === 'video' ? 'video' : 'image',
      );
    }
  }

  await this.repo.remove(product);
await this.cache.clearPattern(`product:*`);
await this.cache.clearPattern('products:*');
await this.cache.clearPattern('flash:*');
await this.bumpProductsVersion();
  return {
    success: true,
    action: 'deleted',
    message: 'Product deleted successfully.',
  };




}


async archiveProduct(productId: string) {
  const product = await this.repo.findOne({
    where: { id: productId },
  });

  if (!product) {
    throw new NotFoundException('Product not found');
  }

  if (product.isPublished === false) {
    return {
      success: true,
      action: 'archived',
      message: 'Product is already archived.',
    };
  }

  product.isPublished = false;
  product.archivedAt = product.archivedAt ?? new Date();

  await this.repo.save(product);

  return {
    success: true,
    action: 'archived',
    message: 'Product archived successfully.',
  };
}

async restoreProduct(productId: string) {
  const product = await this.repo.findOne({
    where: { id: productId },
  });

  if (!product) {
    throw new NotFoundException('Product not found');
  }

  if (product.isPublished === true) {
    return {
      success: true,
      action: 'restored',
      message: 'Product is already published.',
    };
  }

  product.isPublished = true;
  product.archivedAt = null;

  await this.repo.save(product);


  await this.cache.clearPattern('products:*');
await this.cache.clearPattern('product:*');
await this.cache.clearPattern('flash:*');
await this.bumpProductsVersion();

  return {
    success: true,
    action: 'restored',
    message: 'Product restored and published successfully.',
  };
}





async fullUpdateProduct(
  productId: string,
  data: any,
  images: Express.Multer.File[],
  video?: Express.Multer.File,
) {
  const product = await this.repo.findOne({
    where: { id: productId },
    relations: { media: true, category: true, variants: true },
  });

  if (!product) throw new NotFoundException('Product not found');

  let nextCategory = product.category;

  if (data.categoryId && data.categoryId !== product.category?.id) {
    const category = await this.catRepo.findOne({
      where: { id: data.categoryId },
    });

    if (!category) {
      throw new BadRequestException('Invalid categoryId');
    }

    nextCategory = category;
  }

  

 Object.assign(product, {
  name: data.name ?? product.name,
 
  description: data.description ?? product.description,
  price: data.price ?? product.price,
  discountPrice:
    data.discountPrice !== undefined ? data.discountPrice : product.discountPrice,
 
  stock: data.stock ?? product.stock,

  weight:
    data.weight ?? product.weight,

  length:
    data.length ?? product.length,

  width:
    data.width ?? product.width,

  height:
    data.height ?? product.height,
  condition: data.condition ?? product.condition,
  isFlashDeal: data.isFlashDeal ?? product.isFlashDeal,
  flashStartAt: data.flashStartAt
    ? new Date(data.flashStartAt)
    : data.flashStartAt === null
    ? null
    : product.flashStartAt,
  flashEndAt: data.flashEndAt
    ? new Date(data.flashEndAt)
    : data.flashEndAt === null
    ? null
    : product.flashEndAt,
  category: nextCategory,
  isPublished:
    typeof data.isPublished === 'boolean'
      ? data.isPublished
      : product.isPublished,
  archivedAt:
    typeof data.isPublished === 'boolean'
      ? data.isPublished
        ? null
        : product.archivedAt ?? new Date()
      : product.archivedAt,
});

this.recalculateProductMeta(product);

const savedProduct = await this.repo.save(product);

if (Array.isArray(data.variants)) {
  await this.syncProductVariants(savedProduct, data.variants);
}


const incomingImages = Array.isArray(images) ? images : [];
const existingImageMedia = (product.media || []).filter(
  (m) => m.type === 'image',
);

if (incomingImages.length > 0) {
  if (!data.replaceImages && existingImageMedia.length + incomingImages.length > 10) {
    throw new BadRequestException('Maximum 10 images allowed per product');
  }

  if (data.replaceImages) {
    for (const m of existingImageMedia) {
      if (m.publicId) {
        await this.cloud.deleteByPublicId(m.publicId, 'image');
      }
    }
    if (existingImageMedia.length) {
      await this.mediaRepo.remove(existingImageMedia);
    }
  }

  const uploadedImages = await Promise.all(
    incomingImages.map((file) =>
      this.cloud.uploadImage(file.buffer, 'client-0/images'),
    ),
  );

  const mediaRows = uploadedImages.map((uploaded, index) =>
    this.mediaRepo.create({
      product: { id: savedProduct.id } as any, // ✅ FIXED
      type: 'image',
      url: uploaded.url,
      publicId: uploaded.publicId,
      position: index,
    }),
  );

  await this.mediaRepo.save(mediaRows);

  // ✅ thumbnail ONLY ONCE
  if (uploadedImages.length > 0) {
    await this.repo.update(savedProduct.id, {
      thumbnailUrl: uploadedImages[0].url,
    });
  }




}

  // ========================
  // Video replace
  // ========================
  if (data.replaceVideo && video) {
    const oldVideo = product.media?.find((m) => m.type === 'video');

    if (oldVideo) {
      if (oldVideo.publicId) {
        await this.cloud.deleteByPublicId(oldVideo.publicId, 'video');
      }
      await this.mediaRepo.remove(oldVideo);
    }

    const cloudinary = getCloudinary();
    const uploadedVideo = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'client-0/videos', resource_type: 'video' },
        (err, res) => (err ? reject(err) : resolve(res)),
      );
      stream.end(video.buffer);
    });

    await this.mediaRepo.save(
      this.mediaRepo.create({
        product,
        type: 'video',
        url: uploadedVideo.secure_url,
        publicId: uploadedVideo.public_id,
        format: uploadedVideo.format,
      }),
    );

    await this.cache.clearPattern('products:*');
await this.cache.clearPattern('product:*');
await this.cache.clearPattern('flash:*');
await this.bumpProductsVersion();
  }

  return { success: true };
}




async findOneById(id: string) {
  const product = await this.repo.findOne({
    where: { id },
    relations: { category: { parent: true }, media: true, variants: true },
  });

  if (!product) throw new NotFoundException('Product not found');

  const soldMap = await this.getProductSoldMap([product.id]);
  const variantSoldMap = await this.getVariantSoldMap(
    (product.variants ?? []).map((v) => v.id),
  );

  return this.toFrontendProduct(
    product,
    soldMap.get(product.id) ?? 0,
    variantSoldMap,
  );
}

}













