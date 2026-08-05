import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../orders/order.entity';
import { CourierProvider } from './courier-provider.entity';
import * as courierTypes from './courier.types';

@Entity('order_shipments')
export class OrderShipment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.shipments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order!: Order;

  @Index()
  @Column({ type: 'uuid' })
  courierProviderId!: string;

  @ManyToOne(() => CourierProvider, (provider) => provider.shipments)
  @JoinColumn({ name: 'courierProviderId' })
  courierProvider!: CourierProvider;

  @Column({ type: 'varchar', length: 100, nullable: true })
  trackingNumber?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  consignmentId?: string;

  @Column({ type: 'varchar', length: 40, default: 'not_assigned' })
  courierStatus!: courierTypes.CourierShipmentStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  codAmount?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  deliveryCharge?: number;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @Column({ type: 'jsonb', nullable: true })
  requestPayload?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  responsePayload?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'timestamp', nullable: true })
  sentAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  returnedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  trackingUrl?: string;

  @Column({
  type: 'varchar',
  length: 20,
  default: 'idle',
})
processingStatus!: 'idle' | 'queued' | 'processing' | 'failed';



@Column({ nullable: true })
  pickupAddress?: string;



@Column({
  type: 'jsonb',
  nullable: true,
})
availableRates?: any[];


@Column({
  type: 'varchar',
  length: 100,
  nullable: true,
})
selectedRateId?: string;


@Column({
 type:'jsonb',
 nullable:true,
})
selectedRate?: Record<string,any>;




@Column({
  type: 'varchar',
  length: 100,
  nullable: true,
})
adminSelectedRateId?: string;


@Column({
  type: 'jsonb',
  nullable: true,
})
adminSelectedRate?: Record<string, any>;
@Column({
  type: 'text',
  nullable: true,
})
rateOverrideReason?: string;
}