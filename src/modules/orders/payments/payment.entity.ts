import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Order } from '../order.entity';
import { User } from '../../users/user.entity';

export type PaymentProvider = 'cod' | 'stripe';
;

export type PaymentStatus =
  | 'initiated'
  | 'otp_sent'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'refunded';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  order!: Order;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @Column({ type: 'varchar', length: 20 })
  provider!: PaymentProvider;

  @Column({ type: 'varchar', length: 20, default: 'initiated' })
  status!: PaymentStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount!: number;

  @Column({
 type:'varchar',
 length:5,
 default:'USD'
})
currency!: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  otpHash?: string;

  @Column({ type: 'timestamptz', nullable: true })
  otpExpiresAt?: Date;

  @Column({ default: 0 })
  otpAttempts!: number;

  @Column({ nullable: true })
  providerPaymentId?: string;

  @Column({ nullable: true })
  providerTrxId?: string;

  @Column({ type: 'jsonb', nullable: true })
  providerMeta?: any;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 120 })
  idempotencyKey!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  otpResendAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil?: Date;
}