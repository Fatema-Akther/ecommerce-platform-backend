import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { CategoriesModule } from './modules/categories/categories.module';
import { ProductsModule } from './modules/products/products.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/orders/payments/payments.module';
import { CouriersModule } from './modules/couriers/couriers.module';
import { DashboardModule } from './modules/admin/dashboard/dashboard.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BusinessSettingsModule } from './modules/business-settings/business-settings.module';
import { RedisModule } from '@nestjs-modules/ioredis';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // for local

RedisModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const useTLS = config.get<string>('REDIS_TLS') === 'true';

    return {
      type: 'single',
      options: {
        url: config.get<string>('REDIS_URL') || undefined,
        host: config.get<string>('REDIS_HOST') || '127.0.0.1',
        port: Number(config.get<string>('REDIS_PORT') || 6379),
        password: config.get<string>('REDIS_PASSWORD') || undefined,
        tls: useTLS ? {} : undefined,
      },
    };
  },
}),


//for live 

//  RedisModule.forRootAsync({
//       inject: [ConfigService],
//       useFactory: (config: ConfigService) => {
//         const redisUrl = config.get<string>('REDIS_URL');

//         if (!redisUrl) {
//           throw new Error('REDIS_URL is missing');
//         }

//         const url = new URL(redisUrl);

//         return {
//           type: 'single',
//           options: {
//             host: url.hostname,
//             port: Number(url.port) || 6379,
//             password: url.password || undefined,
//           },
//         };
//       },
//     }),

   

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        const isProduction = config.get<string>('NODE_ENV') === 'production';

        if (databaseUrl) {
          return {
            type: 'postgres',
            url: databaseUrl,
            synchronize: config.get<string>('DB_SYNC') === 'true',
            autoLoadEntities: true,
            ssl: isProduction ? { rejectUnauthorized: false } : false,

 extra: {
        max: 30,
     min: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    },

          };
        }

        return {
          type: 'postgres',
          host: config.get<string>('DB_HOST'),
          port: Number(config.get<string>('DB_PORT') || 5432),
          username: config.get<string>('DB_USER'),
          password: config.get<string>('DB_PASS'),
          database: config.get<string>('DB_NAME'),
          synchronize: config.get<string>('DB_SYNC') === 'true',
          autoLoadEntities: true,

          extra: {
        max: 30,
       min: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      },
        };
      },
    }),

    CategoriesModule,
    ProductsModule,
    UsersModule,
    AuthModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    CouriersModule,
    DashboardModule,

      BusinessSettingsModule,
       
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}