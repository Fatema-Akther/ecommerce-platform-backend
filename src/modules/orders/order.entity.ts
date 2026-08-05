



import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { OrderItem } from './order-item.entity';
import { OrderShipment } from '../couriers/order-shipment.entity';
import { Payment } from './payments/payment.entity';

export type OrderStatus =
  | 'pending'
  | 'pending_verification'
  | 'awaiting_payment'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
   | 'completed'
  
  | 'cancelled'
  | 'failed'
  | 'refunded'

export type ReviewStatus =
  | 'clear'
  | 'pending_review'
  | 'verified'
  | 'blocked'
  | 'rejected';

export type OrderPaymentMethod =
  | 'cod'

  | 'stripe';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User)
  user!: User;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status!: OrderStatus;

@Column({ type: 'jsonb' })
delivery!: {
  fullName: string;

  phone: string;

  address: string;

  city: string;

  state: string;

  postalCode: string;

  country: string;

  note?: string;
};

  @Column({ type: 'varchar', length: 30, default: 'cod' })
  paymentMethod!: OrderPaymentMethod;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  subtotal!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  deliveryCharge!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total!: number;

  @Column({ nullable: true })
  paymentProvider?: string;

  @Column({ nullable: true })
  paymentRef?: string;

  @OneToMany(() => OrderItem, (i) => i.order, { cascade: true })
  items!: OrderItem[];

  @OneToMany(() => OrderShipment, (shipment) => shipment.order)
shipments!: OrderShipment[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  ipAddress?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent?: string;

  @Column({ type: 'boolean', default: false })
  fraudFlag?: boolean;

  @Column({ type: 'int', default: 0 })
  riskScore!: number;

  @Column({ type: 'varchar', length: 30, default: 'clear' })
  reviewStatus!: ReviewStatus;

 @Column({ type: 'jsonb', nullable: true })
riskSignals?: {
  recentOrdersFromIp?: number;
  recentOrdersFromPhone?: number;
  previousCancelledOrdersByPhone?: number;
  accountAgeHours?: number;
  suspiciousKeywords?: string[];
  highValueCod?: boolean;
  missingAreaOrCity?: boolean;
  firstTimeCustomer?: boolean;

  riskLevel?: 'low' | 'medium' | 'high';

  riskFactors?: Array<{
    title: string;
    description: string;
    points: number;
    level: 'low' | 'medium' | 'high';
  }>;
};

  @Column({ type: 'text', nullable: true })
  adminReviewNote?: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt?: Date;

  @OneToMany(() => Payment, (payment) => payment.order)
payments!: Payment[];



@Column({nullable:true})
shippingRateId?: string;


@Column({nullable:true})
shippingMethod?: string;


@Column({type:'decimal',precision:10,scale:2,default:0})
shippingCost!: number;


@Column({
 type:'jsonb',
 nullable:true,
})
shippingRate?: Record<string,any>;
}