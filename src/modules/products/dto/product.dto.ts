



export class FrontendImageDto {
  _id!: string;
  image!: {
    alterImage: any;
    public_id: string;
    secure_url: string;
    optimizeUrl: string;
  };
  alterImage!: {
    public_id: string;
    secure_url: string;
    optimizeUrl: string;
  };
}

export class FrontendVideoDto {
  _id!: string;
  video?: {
    public_id: string;
    secure_url: string;
  };
  alterVideo?: {
    public_id: string;
    secure_url: string;
  };
}

export class FrontendVariantDto {
  id: any;
  _id!: string;
  productId!: string;
  name!: string;
  image: any;
  barcode!: string;
  sku!: string;
  selling_price!: string;
  condition!: string;
  discount_type!: string | null;
  discount_percent!: string;
  discount_amount!: string;
  discount_start_date!: string | null;
  discount_end_date!: string | null;
  offer_price!: string;
  variants_stock!: number;
  variants_values!: string[] | null;
  total_sold!: number;
  isPublish!: boolean;
  isPreOrder!: boolean;

  options?: Record<string, string>;
  combinationKey?: string;
  colorCode?: string | null;
}

export class FrontendVariantGroupValueDto {
  id!: string;
  value!: string;
  stock!: number;
  extraPrice!: number;
}

export class FrontendVariantGroupDto {
  name!: string;
  values!: FrontendVariantGroupValueDto[];
}

export class FrontendSubCategoryDto {
  _id!: string;
  name!: string;
}




export class ProductCardDto {
  id!: string;
  slug!: string;
  name!: string;

  image!: string | null;

  price!: number;
  offerPrice!: number;

  stock!: number;

  hasVariants!: boolean;

  variantsId!: {
    id: string;
    _id: string;
    variants_stock: number;
    variants_values?: string[] | null;
  }[];
  isFlashDeal!: boolean;
}



export class FrontendProductDto {
  sku!: string;
  slug!: string;
  id: any;
    weight!: number;

  flashdeal!: {
    isFlashDeal: boolean;
    startAt: string | null;
    endAt: string | null;
    offerPrice: number;
    discountPercent: number;
  } | null;

  category_group!: any[];
  _id!: string;

  isFlashDeal!: boolean;
  flashEndAt!: string | null;

  name!: string;
  short_description!: string;
  long_description!: string;
  tags!: string[];

  images!: FrontendImageDto[];
  video!: FrontendVideoDto[];

  brand!: { _id: string; name: string };
  sizeGuard?: { _id: string; name: string } | null;

  sub_category!: FrontendSubCategoryDto[];
  total_stock!: number;
  total_sold!: number;
  hasVariants!: boolean;

  variantsId!: FrontendVariantDto[];
  variantGroups!: FrontendVariantGroupDto[];

  currency!: string;
  isPublish!: boolean;
  selling_price!: number;
}