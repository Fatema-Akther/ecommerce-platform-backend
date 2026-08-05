import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Category } from '../categories/category.entity';
import { ProductMedia } from './product-media.entity';
import { ProductVariant } from './product-variant.entity';


export type ProductCondition = 'new' | 'used' | 'refurbished';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 180 })
  name!: string;

  @Index({ unique: true })
  @Column({ length: 200 })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  discountPrice?: number;

 @Index({ unique: true })
  @Column({ type: "varchar", length: 64, nullable: true })
  sku!: string | null;


  @Column({ type: 'int', default: 0 })
  stock!: number;


  @Column({ type: 'varchar', length: 20, default: 'new' })
  condition!: ProductCondition;

  @Column({ default: false })
  isFlashDeal!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
flashStartAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  flashEndAt?: Date;

  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0 })
  rating!: number;

  @ManyToOne(() => Category, { nullable: false, onDelete: 'RESTRICT' })
  category!: Category;

  @OneToMany(() => ProductMedia, (m) => m.product, { cascade: true })
  media!: ProductMedia[];

  @OneToMany(() => ProductVariant, (v) => v.product, { cascade: true })
  variants!: ProductVariant[];

  

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'boolean', default: true })
isPublished!: boolean;

@Column({ type: 'timestamptz', nullable: true })
archivedAt?: Date | null;


  @Column({ type: 'int', default: 0 })
totalStock!: number;

@Column({ type: 'boolean', default: false })
hasVariants!: boolean;

@Column({
  type: 'text',
  nullable: true,
})
thumbnailUrl?: string | null;


//ekhane default value change korleo database migration lagbe
@Column({ type: 'numeric', precision: 10, scale: 2, default: 0.4 })
weight!: number;

@Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
length?: number;

@Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
width?: number;

@Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
height?: number;

}



