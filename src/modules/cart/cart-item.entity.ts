

import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Cart } from './cart.entity';
import { Product } from '../products/product.entity';
@Index(['cartId', 'productId', 'variantId'])
@Entity('cart_items')
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;


  
  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' })
  cart!: Cart;

  @Column()
cartId!: string;

  @Column()
productId!: string;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  priceSnapshot!: number;

  @Column({ nullable: true })
  variantId?: string;

  @Column({ nullable: true })
  variantLabel?: string;

  @Column({ nullable: true })
  imageSnapshot?: string;

  @Column({ nullable: true })
  nameSnapshot?: string;

@Column({ type: 'jsonb', nullable: true })
productSnapshot!: {
  name: string;
  slug: string;
  image: string;
  price: number;
  variant?: {
    id: string | null;
    label?: string;
    extraPrice?: number;
  } | null;
};


  @Column('text', { array: true, nullable: true })
  selectedOptionIds?: string[];

  @Column({ type: 'jsonb', nullable: true })
  selectedOptions?: Record<string, string>;


  

  
}