import axios from "axios";
import * as fs from "fs";

type ProductPoolItem = {
  productId: string;
  variantId: string | null;
};

const BASE_URL = "http://127.0.0.1:3001";

async function generate() {
  try {
    console.log("🚀 Fetching product list...");

    const res = await axios.get(
      `${BASE_URL}/products?page=1&limit=1000`
    );

    const products = res.data.items as any[];

    console.log(`📦 Products found: ${products.length}`);

    const pool: ProductPoolItem[] = [];

    for (const p of products) {
      try {
        let variants: any[] = [];

        /**
         * ✅ BEST RELIABLE METHOD:
         * Try detail endpoint first (because list API usually doesn't include variants)
         */
        try {
          const detailRes = await axios.get(
            `${BASE_URL}/products/${p.slug}`
          );

          variants = detailRes.data?.variants ?? [];
        } catch (err) {
          console.warn(`⚠️ Detail fetch failed for ${p.id}, fallback empty variants`);
        }

        // fallback safety
        if (!Array.isArray(variants)) {
          variants = [];
        }

        // random variant pick
        const variantId =
          variants.length > 0
            ? variants[Math.floor(Math.random() * variants.length)].id
            : null;

        pool.push({
          productId: p.id,
          variantId,
        });
      } catch (err) {
        console.error(`❌ Failed for product ${p.id}`, err);
      }
    }

    fs.writeFileSync(
      "product-pool.json",
      JSON.stringify(pool, null, 2)
    );

    const variantCount = pool.filter((p) => p.variantId !== null).length;

    console.log("====================================");
    console.log(`✅ Pool generated: ${pool.length} items`);
    console.log(`🎯 With variants: ${variantCount}`);
    console.log(`📦 Simple products: ${pool.length - variantCount}`);
    console.log("====================================");
  } catch (error) {
    console.error("❌ Failed to generate product pool:", error);
  }
}

generate();