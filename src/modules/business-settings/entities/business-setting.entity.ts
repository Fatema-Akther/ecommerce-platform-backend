import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("business_settings")
export class BusinessSetting {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    name: "business_name",
    type: "varchar",
    length: 150,
    nullable: true,
  })
  businessName: string | null = null;

  @Column({ name: "logo_url", type: "text", nullable: true })
  logoUrl: string | null = null;

  @Column({
    name: "logo_public_id",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  logoPublicId: string | null = null;

  @Column({ type: "varchar", length: 150, nullable: true })
  email: string | null = null;

  @Column({ type: "varchar", length: 50, nullable: true })
  phone: string | null = null;

  @Column({ type: "text", nullable: true })
  address: string | null = null;

  @Column({ name: "facebook_url", type: "text", nullable: true })
  facebookUrl: string | null = null;

  @Column({ name: "instagram_url", type: "text", nullable: true })
  instagramUrl: string | null = null;

  @Column({ name: "tiktok_url", type: "text", nullable: true })
  tiktokUrl: string | null = null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;


  @Column({ name: "hero_banners", type: "simple-json", nullable: true })
heroBanners: string[] | null = null;
}