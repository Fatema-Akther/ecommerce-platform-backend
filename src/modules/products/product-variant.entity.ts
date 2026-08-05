import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Index } from 'typeorm';
import { Product } from './product.entity';

@Entity('product_variants')
@Index(['product', 'combinationKey'], { unique: true })
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Product, (p) => p.variants, { onDelete: 'CASCADE' })
  product!: Product;

  // Single group:  { "Size": "M" }
  // Multi group:   { "Color": "Red", "Size": "M" }
  @Column({ type: 'jsonb' })
  options!: Record<string, string>;

  @Column({ type: 'varchar', length: 255 })
  combinationKey!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  extraPrice!: number;

  @Column({ type: 'int', default: 0 })
  stock!: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sku?: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;


  @Column({ type: 'varchar', length: 20, nullable: true })
colorCode?: string | null;
}



