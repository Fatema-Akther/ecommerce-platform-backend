import 'dotenv/config';
import { DataSource } from 'typeorm';

const isProduction = process.env.NODE_ENV === 'production';

const useSSL =
  process.env.DB_SSL === 'true' ||
  process.env.DATABASE_URL?.includes('sslmode=require');

const dataSource = new DataSource({
  type: 'postgres',

  url: process.env.DATABASE_URL || undefined,

  host: process.env.DATABASE_URL ? undefined : process.env.DB_HOST,
  port: process.env.DATABASE_URL
    ? undefined
    : Number(process.env.DB_PORT || 5432),
  username: process.env.DATABASE_URL ? undefined : process.env.DB_USER,
  password: process.env.DATABASE_URL ? undefined : process.env.DB_PASS,
  database: process.env.DATABASE_URL ? undefined : process.env.DB_NAME,

  entities: [isProduction ? 'dist/**/*.entity.js' : 'src/**/*.entity.ts'],

  migrations: [isProduction ? 'dist/migrations/*.js' : 'src/migrations/*.ts'],

  synchronize: false,

  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

export default dataSource;