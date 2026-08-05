import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSkuToProducts1771083953234 implements MigrationInterface {
  name = 'AddSkuToProducts1771083953234';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) column না থাকলে add করবে, থাকলে skip করবে
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sku" varchar(40)`,
    );

    // 2) existing rows এ sku blank/null থাকলে fill করবে
    await queryRunner.query(`
      UPDATE "products"
      SET "sku" = 'PRD-' || LEFT(REPLACE("id"::text, '-', ''), 12)
      WHERE "sku" IS NULL OR TRIM("sku") = ''
    `);

    // 3) NOT NULL করবে
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "sku" SET NOT NULL`,
    );

    // 4) unique index না থাকলে create করবে
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_products_sku" ON "products" ("sku")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_products_sku"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "sku"`);
  }
}