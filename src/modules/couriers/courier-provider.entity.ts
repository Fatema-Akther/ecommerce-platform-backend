import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { CourierMode } from './courier.types';
import { OrderShipment } from './order-shipment.entity';


@Entity('courier_providers')
export class CourierProvider {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50 })
  code!: string;

 @Column({ type: 'varchar', length: 20, default: 'api' }) // আগে manual ছিল
mode!: CourierMode;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  websiteUrl?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  trackingUrlPattern?: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

@Column({ type: 'boolean', default: true })
isApiEnabled!: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @OneToMany(() => OrderShipment, (shipment) => shipment.courierProvider)
  shipments!: OrderShipment[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;


 @Column({ type: 'jsonb', nullable: true })
apiConfig?: {
  keyRef: string;
};
}