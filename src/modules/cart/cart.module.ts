import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from './cart.entity';
import { CartItem } from './cart-item.entity';

import { Product } from '../products/product.entity';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { ProductVariant } from '../products/product-variant.entity';

import { ProductMedia } from '../products/product-media.entity';
import { CartCacheService } from 'src/common/cache/cart-cache.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cart, CartItem, Product,ProductVariant,ProductMedia]),

  ],
  providers: [CartService, CartCacheService  ],
  controllers: [CartController],
})
export class CartModule {}
