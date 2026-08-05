import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from './product.entity';

export type MediaType = 'image' | 'video' | 'youtube';

@Entity('product_media')
export class ProductMedia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Product, (p) => p.media, { onDelete: 'CASCADE' })
  product!: Product;

  @Column({ type: 'varchar', length: 20 })
  type!: MediaType;

  @Column()
  url!: string;

  // ✅ Cloudinary public id for delete
  @Column({ nullable: true })
  publicId?: string;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ type: 'int', nullable: true })
  width?: number;

  @Column({ type: 'int', nullable: true })
  height?: number;

  @Column({ nullable: true })
  format?: string;
}
