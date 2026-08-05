import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from './order.entity';
import { Product } from '../products/product.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Order, (o) => o.items, { onDelete: 'CASCADE' })
  order!: Order;


  @Column()
productId!: string;

@Column({ nullable: true })
variantId?: string;



  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  lineTotal!: number;

  @Column({ nullable: true })
  variantLabel?: string;

  @Column({ nullable: true })
  imageSnapshot?: string;

  @Column({ nullable: true })
  nameSnapshot?: string;

  @Column('text', { array: true, nullable: true })
selectedOptionIds?: string[];

@Column({ type: 'jsonb', nullable: true })
selectedOptions?: Record<string, string>;

@ManyToOne(() => Product)
@JoinColumn({ name: 'productId' })
product!: Product;
}