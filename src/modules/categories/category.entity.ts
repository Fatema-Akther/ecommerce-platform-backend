import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Index({ unique: true })
  @Column({ length: 160 })
  slug: string;

  @Column({ nullable: true })
  icon?: string;

  @Column({ default: true })
  isActive: boolean;

  // Self relation: parent -> children
  @ManyToOne(() => Category, (c) => c.children, { nullable: true, onDelete: 'SET NULL' })
  parent?: Category;

  @OneToMany(() => Category, (c) => c.parent)
  children: Category[];

  @CreateDateColumn()
  createdAt: Date;
}
