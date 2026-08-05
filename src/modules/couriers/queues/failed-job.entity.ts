// src/modules/couriers/entities/failed-job.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('failed_jobs')
export class FailedJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  type!: string;

  @Column('jsonb')
  payload!: Record<string, any>;

  @Column('text', { nullable: true })
  error?: string;

  @CreateDateColumn()
  createdAt!: Date;
}