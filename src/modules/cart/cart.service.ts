



import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Cart } from './cart.entity';
import { CartItem } from './cart-item.entity';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';
import { ProductVariant } from '../products/product-variant.entity';
import { CartCacheService } from 'src/common/cache/cart-cache.service'
import { ProductMedia } from '../products/product-media.entity';

// const cartCache = new Map<string, { data: any; expire: number }>();

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart) private cartRepo: Repository<Cart>,
    @InjectRepository(CartItem) private itemRepo: Repository<CartItem>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
      @InjectRepository(ProductMedia) private mediaRepo: Repository<ProductMedia>,
      private readonly cartCache: CartCacheService,
        private dataSource: DataSource,
    @InjectRepository(ProductVariant) private variantRepo: Repository<ProductVariant>,

    
  ) {}

  // =========================
  // PRICE LOGIC
  // =========================
  private getEffectivePrice(product: Product) {
    const now = new Date();

    const price = Number(product.price ?? 0);
    const discount = Number(product.discountPrice ?? 0);

    const flashActive =
      !!product.isFlashDeal &&
      product.flashStartAt &&
      product.flashEndAt &&
      new Date(product.flashStartAt) <= now &&
      now <= new Date(product.flashEndAt) &&
      discount > 0 &&
      discount < price;

    return flashActive ? discount : price;
  }

  // =========================
  // STOCK CHECK
  // =========================
  private checkStock(limit: number, qty: number) {
    if (qty > limit) {
      throw new BadRequestException(`Only ${limit} item(s) available`);
    }
  }

  // =========================
  // VARIANT RESOLVER (SINGLE SOURCE OF TRUTH)
  // =========================
private resolveCartVariant(
  product: Product,
  variantMap: Map<string, ProductVariant>,
  variantId?: string,
  selectedOptionIds?: string[],
  selectedOptions?: Record<string, string>,
) {
  const variants = product.variants ?? [];

  // =========================
  // CASE 1: Direct Variant
  // =========================
  if (variantId) {
    const variant = variantMap.get(variantId);

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    const options = ((variant as any).options ?? {}) as Record<string, string>;

    return {
      variant,
      stock: Number((variant as any).stock ?? product.stock ?? 0),
      extraPrice: Number((variant as any).extraPrice ?? 0),

      // 🔥 FIX: ALWAYS return label
      label: Object.keys(options).length
        ? Object.entries(options)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ')
        : (variant as any).combinationKey || 'Variant',

      key: (variant as any).combinationKey ?? undefined,
    };
  }

  // =========================
  // CASE 2: Option-based Variant
  // =========================
  if (selectedOptions && Object.keys(selectedOptions).length) {
    const key = Object.entries(selectedOptions)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join('|');

    const variant = variantMap.get(key);

    if (!variant) {
      throw new BadRequestException('Invalid variant');
    }

    return {
      variant,
      stock: Number((variant as any).stock ?? product.stock ?? 0),
      extraPrice: Number((variant as any).extraPrice ?? 0),

      // 🔥 FIX: same label logic for consistency
      label: Object.entries(selectedOptions)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | '),

      key,
    };
  }

  // =========================
  // CASE 3: Simple Product
  // =========================
  return {
    variant: null,
    stock: Number(product.stock ?? 0),
    extraPrice: 0,
    label: undefined,
    key: undefined,
  };
}


private getVersionKey(userId: string) {
  return `cart:version:${userId}`;
}




private async getCartVersion(userId: string): Promise<number> {
  const key = this.getVersionKey(userId);

  const version = await this.cartCache.get(key);

 if (version === null || version === undefined) {
    await this.cartCache.set(key, 1);// no expiry
    return 1;
  }

  return Number(version);
}



private async incrementCartVersion(userId: string) {
  const key = this.getVersionKey(userId);

  const current = await this.getCartVersion(userId);
  const next = current + 1;

  // 🔥 RESET LOGIC (PLACE HERE)
  if (next > 1000) {
    await this.cartCache.set(key, 1);
    return 1;
  }

  await this.cartCache.set(key, next);
  return next;
}

  // =========================
  // CART GET OR CREATE
  // =========================
//  async getOrCreateCart(user: User) {
//   let cart = await this.cartRepo.findOne({
//     where: { user: { id: user.id } },
   
//   });

//     if (!cart) {
//       cart = await this.cartRepo.save(this.cartRepo.create({ user }));
//     }

//     return cart;
//   }
async getOrCreateCart(user: User) {
  let cart = await this.cartRepo.findOne({
    where: { user: { id: user.id } },
  });

  if (!cart) {
    cart = await this.cartRepo.save(
      this.cartRepo.create({ user })
    );
  }

  return cart;
}

  
  // =========================
  // ADD TO CART (OPTIMIZED)
  // =========================
//   async addToCart(
//     user: User,
//     productId: string,
//     qty: number,
//     variantId?: string,
//     variantLabel?: string,
//     selectedImage?: string,
//     selectedOptionIds?: string[],
//     selectedOptions?: Record<string, string>,
//   ) {
//     if (qty < 1) throw new BadRequestException('Invalid qty');

//  const product = await this.productRepo
//   .createQueryBuilder('p')
//   .leftJoinAndSelect('p.media', 'm')
//  .leftJoinAndSelect('p.variants', 'v')  // 👈 ADD THIS LINE
//   .where('p.id = :id', { id: productId })
  
//   .getOne();

//     if (!product) throw new NotFoundException('Product not found');
//     if (!product.isPublished) throw new BadRequestException('Product unavailable');





// // 👇 এখানেই ADD করবে (RIGHT AFTER variants fetch)
// const variantMap = new Map<string, ProductVariant>();

// for (const v of product.variants) {
//   variantMap.set(v.id, v);
//   variantMap.set((v as any).combinationKey, v);
// }



//    const resolved = this.resolveCartVariant(
//   product,
//   variantMap,
//   variantId,
//   selectedOptionIds,
//   selectedOptions,
// );

//     const cart = await this.getOrCreateCart(user);


//     const item = await this.itemRepo
//   .createQueryBuilder('item')
//   .setLock('pessimistic_write')
//   .where('item.productId = :productId', { productId })
//   .andWhere(
//   resolved.variant?.id
//     ? 'item.variantId = :variantId'
//     : 'item.variantId IS NULL',
//   { variantId: resolved.variant?.id }
// )
//   .andWhere('item.cartId = :cartId', { cartId: cart.id })
//   .getOne();

// const cartId = cart.id;


//     const existingQty = Number(item?.quantity ?? 0);



//     const price = this.getEffectivePrice(product) + resolved.extraPrice;

// const image =
//   selectedImage?.trim() ||
//   product.media?.find(m => m.type === 'image')?.url ||
//   product.thumbnailUrl ||
//   '';

// const productSnapshot = {
//   name: product.name,
//   slug: product.slug,
//   image,
//   price: price,
//   variant: resolved.variant
//     ? {
//         id: resolved.variant.id,
//         label: resolved.label,
//         extraPrice: resolved.extraPrice,
//       }
//     : null,
// };

   

// if (item) {
//   item.quantity += qty;
//   item.variantId = resolved.variant?.id ?? undefined;

//   item.productSnapshot = productSnapshot;

//   item.selectedOptionIds = selectedOptionIds;
//   item.selectedOptions = selectedOptions;

//   const saved = await this.itemRepo.save(item);

// await this.incrementCartVersion(user.id);
//   return saved;
// }
// const saved = await this.itemRepo.save(
//   this.itemRepo.create({
//     cart,
//     productId,
//     quantity: qty,

//     productSnapshot,

//     variantId: resolved.variant?.id ?? undefined,
//     selectedOptionIds,
//     selectedOptions,
//   }),
// );// 🔥 ADD THIS
// await this.incrementCartVersion(user.id);

// return saved;
//   }
async addToCart(
  user: User,
  productId: string,
  qty: number,
  variantId?: string,
  variantLabel?: string,
  selectedImage?: string,
  selectedOptionIds?: string[],
  selectedOptions?: Record<string, string>,
) {
  if (qty < 1) throw new BadRequestException('Invalid qty');

  return this.dataSource.transaction(async (manager) => {
    const productRepo = manager.getRepository(Product);
    const itemRepo = manager.getRepository(CartItem);

    const product = await productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.media', 'm')
      .leftJoinAndSelect('p.variants', 'v')
      .where('p.id = :id', { id: productId })
      .getOne();

    if (!product) throw new NotFoundException('Product not found');
    if (!product.isPublished) throw new BadRequestException('Product unavailable');

    const variantMap = new Map<string, ProductVariant>();

    for (const v of product.variants ?? []) {
      variantMap.set(v.id, v);
      variantMap.set((v as any).combinationKey, v);
    }

    const resolved = this.resolveCartVariant(
      product,
      variantMap,
      variantId,
      selectedOptionIds,
      selectedOptions,
    );

    const cart = await this.getOrCreateCart(user);

    const item = await itemRepo
      .createQueryBuilder('item')
      .setLock('pessimistic_write')
      .where('item.productId = :productId', { productId })
     .andWhere(
  resolved.variant?.id
    ? 'item.variantId = :variantId'
    : 'item.variantId IS NULL'
)
.setParameter('variantId', resolved.variant?.id ?? null)


      .andWhere('item.cartId = :cartId', { cartId: cart.id })
      .getOne();

    const price = this.getEffectivePrice(product) + resolved.extraPrice;

    const image =
      selectedImage?.trim() ||
      product.media?.find(m => m.type === 'image')?.url ||
      product.thumbnailUrl ||
      '';
const productSnapshot = {
  id: product.id, // 🔥 ADD THIS (IMPORTANT)
  name: product.name,
  slug: product.slug,
  image,
  price,

  // 🔥 ADD FULL VARIANT CONTEXT
  variants: product.variants?.map(v => ({
    id: v.id,
    options: (v as any).options ?? {},
    stock: v.stock,
    extraPrice: v.extraPrice,
    combinationKey: (v as any).combinationKey,
  })) ?? [],

  variant: resolved.variant
    ? {
        id: resolved.variant.id,
        label: resolved.label,
        extraPrice: resolved.extraPrice,
      }
    : null,
};

    if (item) {
      item.quantity += qty;
      item.variantId = resolved.variant?.id ?? undefined;
      item.productSnapshot = productSnapshot;
      item.selectedOptionIds = selectedOptionIds;
      item.selectedOptions = selectedOptions;

      const saved = await itemRepo.save(item);
      await this.incrementCartVersion(user.id);
      return saved;
    }

    const saved = await itemRepo.save(
      itemRepo.create({
         cartId: cart.id,
        cart,
        productId,
        quantity: qty,
           priceSnapshot: price, // ✅ REQUIRED FIX
        productSnapshot,
        variantId: resolved.variant?.id ?? undefined,
        selectedOptionIds,
        selectedOptions,
      }),
    );

    await this.incrementCartVersion(user.id);
    return saved;
  });
}

async getMyCart(user: User) {


 const version = await this.getCartVersion(user.id); // বা Redis থেকে
const key = `cart:${user.id}:v${version}`;

 const cached = await this.cartCache.get(key); 
  if (cached) return cached;

  const cart = await this.cartRepo.findOne({
    where: { user: { id: user.id } },
  });

  if (!cart) {
    const emptyCart = {
      id: null,
      items: [],
    };

    this.cartCache.set(key, emptyCart, 60000);
    return emptyCart;
  }

const items = await this.itemRepo.find({
  where: { cart: { id: cart.id } },
});

  const optimizedCart = {
    id: cart.id,
    items: items.map((item) => {
      const snap = item.productSnapshot ?? {
        name: '',
        slug: '',
        image: '',
        price: 0,
        variant: null,
      };

      return {
        id: item.id,
        productId: item.productId,
        name: snap.name,
     quantity: Number(item.quantity),
        price: snap.price,
        image: snap.image,
        variant: snap.variant ?? null,
        variantId: item.variantId,
      };
    }),
  };

  this.cartCache.set(key, optimizedCart, 60000);

  return optimizedCart;
}





  // =========================
  // UPDATE QTY
  // =========================
  async updateItemQty(user: User, itemId: string, qty: number) {
    if (qty < 1) throw new BadRequestException('Invalid qty');

    const item = await this.itemRepo.findOne({
      where: { id: itemId },
      relations: { cart: { user: true } },
    });

    if (!item || item.cart.user.id !== user.id) {
      throw new NotFoundException('Item not found');
    }



const product = await this.productRepo.findOne({
  where: { id: item.productId },
  relations: { variants: true },
});

if (!product) {
  throw new NotFoundException('Product not found');
}

// build variant map
const variantMap = new Map<string, ProductVariant>();

for (const v of product.variants ?? []) {
  variantMap.set(v.id, v);
  variantMap.set((v as any).combinationKey, v);
}

// resolve using CORRECT product
const resolved = this.resolveCartVariant(
  product,
  variantMap,
  item.variantId ?? undefined,
  item.selectedOptionIds,
  item.selectedOptions,
);
    this.checkStock(resolved.stock, qty);

    item.quantity = qty;

const saved = await this.itemRepo.save(item);

// 🔥 CACHE INVALIDATE (ADD HERE)
await this.incrementCartVersion(user.id);

return saved;
  }

  // =========================
  // REMOVE ITEM
  // =========================
  async removeItem(user: User, itemId: string) {
    const item = await this.itemRepo.findOne({
      where: { id: itemId },
      relations: { cart: { user: true } },
    });

    if (!item || item.cart.user.id !== user.id) {
      throw new NotFoundException('Item not found');
    }
await this.itemRepo.remove(item);

// 🔥 CACHE INVALIDATE (ADD HERE)
await this.incrementCartVersion(user.id);

return { success: true };
  }
}