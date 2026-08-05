import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { ProductMedia } from './product-media.entity';
import { ProductVariant } from './product-variant.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { CategoriesModule } from '../categories/categories.module';
import { UploadsModule } from '../uploads/uploads.module';
import { OrderItem } from '../orders/order-item.entity';
import { CartItem } from '../cart/cart-item.entity';
import { CartCacheService } from 'src/common/cache/cart-cache.service';


@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductMedia, ProductVariant,OrderItem,   CartItem,]),
    CategoriesModule, UploadsModule
  ],
  providers: [ProductsService, CartCacheService],
  controllers: [ProductsController],
})
export class ProductsModule {}
