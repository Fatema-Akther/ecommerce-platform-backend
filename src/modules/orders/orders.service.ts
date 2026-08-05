


import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, In } from 'typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Cart } from '../cart/cart.entity';
import { CartItem } from '../cart/cart-item.entity';
import { User } from '../users/user.entity';
import { CheckoutDto } from './dto/checkout.dto';
import { ReviewOrderDto } from './dto/review-order.dto';
import { Payment } from './payments/payment.entity';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Product } from '../products/product.entity';
import { ProductVariant } from '../products/product-variant.entity';
import { ProductMedia } from '../products/product-media.entity';
import { CouriersService } from '../couriers/couriers.service';
import { CourierProvider } from '../couriers/courier-provider.entity';
import { OrderShipment } from '../couriers/order-shipment.entity';

type RiskLevel = 'low' | 'medium' | 'high';

type RiskFactor = {
  title: string;
  description: string;
  points: number;
  level: RiskLevel;
};

type RiskSignals = {
  recentOrdersFromIp?: number;
  recentOrdersFromPhone?: number;
  previousCancelledOrdersByPhone?: number;
  accountAgeHours?: number;
  suspiciousKeywords?: string[];
  highValueCod?: boolean;
  missingAreaOrCity?: boolean;
  firstTimeCustomer?: boolean;

  riskLevel?: RiskLevel;
  riskFactors?: RiskFactor[];
};



@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private itemRepo: Repository<OrderItem>,
    @InjectRepository(Cart) private cartRepo: Repository<Cart>,
    @InjectRepository(CartItem) private cartItemRepo: Repository<CartItem>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(ProductVariant)
    private variantRepo: Repository<ProductVariant>,
    private dataSource: DataSource,
     private couriersService: CouriersService,
  ) {}

private calcDeliveryCharge(dto: CheckoutDto) {
  const country = dto.country.trim().toUpperCase();

  const rates: Record<string, number> = {
    US: 25,
    GB: 30,
    CA: 30,
    AU: 35,
  };

  return rates[country] ?? 30;
}

private normalizePhone(phone: string) {
  return phone
    .trim()
    .replace(/[^\d+]/g, '');
}

 private async detectFraud(
  order: Order,
  user: User,
  dto: CheckoutDto,
  userIp: string,
  userAgent: string,
) {
  let riskScore = 0;

const riskFactors: RiskFactor[] = [];

const signals: RiskSignals = {};

  order.ipAddress = userIp || undefined;
  order.userAgent = userAgent || undefined;

  const normalizedPhone = this.normalizePhone(dto.phone);

  /**
   * 1. Recent orders from same IP
   */
  if (userIp) {
    const recentIpOrders = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.ipAddress = :ip', { ip: userIp })
      .andWhere(`o."createdAt" >= NOW() - INTERVAL '30 minutes'`)
      .getCount();

    signals.recentOrdersFromIp = recentIpOrders;

    if (recentIpOrders >= 3) {
      riskScore += 25;
      riskFactors.push({
        title: 'Multiple orders from same IP',
        description: `Same IP placed ${recentIpOrders} orders within 30 minutes.`,
        points: 25,
        level: 'medium',
      });
    }

    if (recentIpOrders >= 5) {
      riskScore += 20;
      riskFactors.push({
        title: 'Very high order frequency from IP',
        description: `Same IP placed ${recentIpOrders} orders within 30 minutes.`,
        points: 20,
        level: 'high',
      });
    }
  }

  /**
   * 2. Recent orders from same phone number
   */
  const recentPhoneOrders = await this.orderRepo
    .createQueryBuilder('o')
    .where(
  `o.delivery->>'phone' = :phone`,
  {
    phone: normalizedPhone,
  },
)
    .andWhere(`o."createdAt" >= NOW() - INTERVAL '24 hours'`)
    .getCount();

  signals.recentOrdersFromPhone = recentPhoneOrders;

  if (recentPhoneOrders >= 3) {
    riskScore += 20;
    riskFactors.push({
      title: 'Multiple recent orders from same phone',
      description: `This phone number placed ${recentPhoneOrders} orders within 24 hours.`,
      points: 20,
      level: 'medium',
    });
  }

  if (recentPhoneOrders >= 5) {
    riskScore += 15;
    riskFactors.push({
      title: 'High order frequency from same phone',
      description: `This phone number placed ${recentPhoneOrders} orders within 24 hours.`,
      points: 15,
      level: 'high',
    });
  }

  /**
   * 3. Previous cancelled/failed orders from same phone
   */
  const previousCancelledOrdersByPhone = await this.orderRepo
    .createQueryBuilder('o')
    .where(
    `o.delivery->>'phone' = :phone`,
    {
      phone: normalizedPhone,
    },
  )
    .andWhere(`o.status IN (:...statuses)`, {
      statuses: ['cancelled', 'failed'],
    })
    .getCount();

  signals.previousCancelledOrdersByPhone = previousCancelledOrdersByPhone;

  if (previousCancelledOrdersByPhone >= 1) {
    riskScore += 15;
    riskFactors.push({
      title: 'Previous cancelled/failed order found',
      description: `This phone number has ${previousCancelledOrdersByPhone} previous cancelled/failed order(s).`,
      points: 15,
      level: 'medium',
    });
  }

  if (previousCancelledOrdersByPhone >= 2) {
    riskScore += 20;
    riskFactors.push({
      title: 'Repeated cancelled/failed order history',
      description: `This phone number has a high cancellation/failure history: ${previousCancelledOrdersByPhone} order(s).`,
      points: 20,
      level: 'high',
    });
  }

  /**
   * 4. New account / first-time customer
   */
  if ((user as any)?.createdAt) {
    const createdAt = new Date((user as any).createdAt);
    const ageHours = Math.floor(
      (Date.now() - createdAt.getTime()) / (1000 * 60 * 60),
    );

    signals.accountAgeHours = ageHours;

    if (ageHours < 24) {
      riskScore += 15;
      riskFactors.push({
        title: 'New customer account',
        description: `Account age is only ${ageHours} hour(s).`,
        points: 15,
        level: 'medium',
      });
    }

    if (ageHours < 3) {
      riskScore += 10;
      riskFactors.push({
        title: 'Very new account',
        description: 'Account was created less than 3 hours ago.',
        points: 10,
        level: 'high',
      });
    }
  } else {
    const previousUserOrders = await this.orderRepo.count({
      where: { user: { id: user.id } },
    });

    if (previousUserOrders === 0) {
      signals.firstTimeCustomer = true;
      riskScore += 10;

      riskFactors.push({
        title: 'First-time customer',
        description: 'This customer has no previous order history.',
        points: 10,
        level: 'low',
      });
    }
  }

  /**
   * 5. High value COD order
   */
  const paymentMethod = dto.paymentMethod || 'cod';
  const orderTotal = Number(order.total);

  if (paymentMethod === 'cod' && orderTotal >= 5000) {
    signals.highValueCod = true;
    riskScore += 20;

    riskFactors.push({
      title: 'High value COD order',
      description: `COD order amount is ৳${orderTotal}.`,
      points: 20,
      level: 'medium',
    });
  }

  if (paymentMethod === 'cod' && orderTotal >= 10000) {
    riskScore += 15;

    riskFactors.push({
      title: 'Very high value COD order',
      description: `COD order amount is ৳${orderTotal}, which is above ৳10,000.`,
      points: 15,
      level: 'high',
    });
  }

  /**
   * 6. COD order with incomplete delivery location
   */
 if (
  paymentMethod === 'cod' &&
  (!dto.city || !dto.state || !dto.postalCode)
) {
    signals.missingAreaOrCity = true;
    riskScore += 10;

    riskFactors.push({
      title: 'Incomplete delivery location',
     description: 'COD order is missing city, state, or postal code.',
      points: 10,
      level: 'low',
    });
  }

  /**
   * 7. Suspicious address words
   */
  const suspiciousWords = [
    'test',
    'abc',
    'fake',
    'unknown',
    'na',
    'n/a',
    'none',
    'asdf',
    'xxx',
  ];

  const lowerAddress = (dto.address || '').toLowerCase();

  const matchedWords = suspiciousWords.filter((word) =>
    lowerAddress.includes(word),
  );

  if (matchedWords.length > 0) {
    signals.suspiciousKeywords = matchedWords;
    riskScore += 20;

    riskFactors.push({
      title: 'Suspicious address keyword',
      description: `Address contains suspicious word(s): ${matchedWords.join(', ')}.`,
      points: 20,
      level: 'medium',
    });
  }

  /**
   * Final risk level
   */
  const riskLevel: 'low' | 'medium' | 'high' =
    riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low';

  order.riskScore = riskScore;

  order.riskSignals = {
  ...signals,
  riskLevel,
  riskFactors,
};






 /**
 * COD:
 * low/medium => processing
 * high       => pending_verification
 *
 * Stripe:
 * low/medium => awaiting_payment
 * high       => pending_verification
 */
const requiresOnlinePayment = paymentMethod === 'stripe';

const autoProcessStatus = requiresOnlinePayment
  ? 'awaiting_payment'
  : 'processing';

  if (riskLevel === 'high') {
    order.fraudFlag = true;
    order.reviewStatus = 'blocked';
    order.status = 'pending_verification';
  } else if (riskLevel === 'medium') {
    order.fraudFlag = true;
    order.reviewStatus = 'pending_review';
    order.status = autoProcessStatus;
  } else {
    order.fraudFlag = false;
    order.reviewStatus = 'clear';
    order.status = autoProcessStatus;
  }
}

  private ensureAdmin(user: User) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Admin only');
    }
  }

  private getEffectivePrice(product: Product) {
    const now = new Date();

    const priceNum = Number((product as any).price ?? 0);
    const discountNum = Number((product as any).discountPrice ?? 0);

    const flashStarted = (product as any).flashStartAt
      ? new Date((product as any).flashStartAt) <= now
      : true;

    const flashNotEnded = (product as any).flashEndAt
      ? now <= new Date((product as any).flashEndAt)
      : true;

    const flashActive =
      !!(product as any).isFlashDeal &&
      flashStarted &&
      flashNotEnded &&
      discountNum > 0 &&
      discountNum < priceNum;

    return flashActive ? discountNum : priceNum;
  }


private orderRelations() {
  return {
    items: {
      product: {
        media: true,
      },
    },
    user: true,
    shipments: { courierProvider: true },
    payments: true,
  } as any;
}

private attachShipmentTrackingUrls<T extends Order | null>(order: T): T {
  if (!order) return order;

  const shipments = (order as any).shipments || [];

  for (const shipment of shipments) {

    const trackingLink =
      shipment?.responsePayload?.consignment?.tracking_link;

    if (trackingLink) {
      shipment.trackingUrl = trackingLink;
      continue;
    }

    const pattern = shipment?.courierProvider?.trackingUrlPattern;
    const trackingNumber = shipment?.trackingNumber;

    if (!pattern || !trackingNumber) {
      shipment.trackingUrl = undefined;
      continue;
    }

    const encodedTracking = encodeURIComponent(trackingNumber);

    shipment.trackingUrl = pattern
      .replace(/\{tracking_number\}/g, encodedTracking)
      .replace(/\{trackingNumber\}/g, encodedTracking);
  }

  return order;
}




private attachShipmentTrackingUrlsToOrders(orders: Order[]) {
  return orders.map((order) => this.attachShipmentTrackingUrls(order));
}







private buildVariantLabelFromSelectedOptions(
  selectedOptions?: Record<string, string>,
  fallback?: string,
) {
  if (selectedOptions && Object.keys(selectedOptions).length) {
    return Object.entries(selectedOptions)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' | ');
  }

  return fallback?.trim() || undefined;
}




private async buildDirectCheckoutItem(
  manager: EntityManager,
  directItem: NonNullable<CheckoutDto['directItem']>,
) {
  const product = await manager.findOne(Product, {
    where: { id: directItem.productId },
    lock: { mode: 'pessimistic_write' },
  });

  if (!product) {
    throw new NotFoundException('Product not found');
  }

  if ((product as any).isPublished === false) {
    throw new BadRequestException('This product is no longer available');
  }

  const qty = Number(directItem.quantity ?? 0);

  if (qty < 1) {
    throw new BadRequestException('Quantity must be at least 1');
  }

  let effectivePrice = this.getEffectivePrice(product);

  let finalVariantId: string | undefined;
  let finalVariantLabel: string | undefined;

  const variantCount = await manager.count(ProductVariant, {
    where: { product: { id: product.id } as any },
  });

  const hasVariants = variantCount > 0;

  if (hasVariants) {
    if (!directItem.variantId) {
      throw new BadRequestException('Please select a valid variant');
    }

    const variant = await manager.findOne(ProductVariant, {
      where: {
        id: directItem.variantId,
        product: { id: product.id } as any,
      },
      lock: { mode: 'pessimistic_write' },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    const variantStock = Number(variant.stock ?? 0);

    if (variantStock <= 0) {
      throw new BadRequestException('This variant is out of stock');
    }

    if (qty > variantStock) {
      throw new BadRequestException(
        `Only ${variantStock} item(s) available for this variant`,
      );
    }

    effectivePrice += Number(variant.extraPrice ?? 0);
    finalVariantId = variant.id;
    finalVariantLabel =
      directItem.variantLabel?.trim() ||
      this.formatVariantOptions(variant.options);
  } else {
    const productStock = Number((product as any).stock ?? 0);

    if (productStock <= 0) {
      throw new BadRequestException('This product is out of stock');
    }

    if (qty > productStock) {
      throw new BadRequestException(
        `Only ${productStock} item(s) available for this product`,
      );
    }
  }

  const firstImageMedia = await manager.findOne(ProductMedia, {
    where: {
      product: { id: product.id } as any,
      type: 'image' as any,
    },
    order: { position: 'ASC' },
  });

  const firstImage = firstImageMedia?.url || undefined;

  return {
    productId: product.id, 
    quantity: qty,
    price: effectivePrice,
    lineTotal: effectivePrice * qty,
    variantId: finalVariantId,
    variantLabel: finalVariantLabel,
    imageSnapshot: directItem.image || firstImage,
    nameSnapshot: product.name || undefined,
  };
}

private async validateCartStockForCheckout(
  manager: EntityManager,
  cart: Cart,
) {
  if (!cart.items?.length) {
    throw new BadRequestException('Cart is empty');
  }

  for (const citem of cart.items) {
    const qty = Number(citem.quantity ?? 0);

 if (citem.productId) {
  const product = await manager.findOne(Product, {
    where: { id: citem.productId },
    select: ['id', 'name', 'isPublished'],
  });

  if (!product) {
    throw new BadRequestException(
      `Product "${citem.nameSnapshot || 'Unknown product'}" not found`,
    );
  }

  if (product.isPublished === false) {
    throw new BadRequestException(
      `Product "${citem.nameSnapshot || product.name}" is no longer available`,
    );
  }
}

    if (qty <= 0) {
      throw new BadRequestException('Invalid item quantity in cart');
    }

    if (citem.variantId) {
      const variant = await manager.findOne(ProductVariant, {
        where: { id: citem.variantId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!variant) {
        throw new NotFoundException(`Variant not found: ${citem.variantId}`);
      }

      const stock = Number(variant.stock ?? 0);

      if (stock <= 0) {
        throw new BadRequestException(
          `Variant "${citem.variantLabel || this.formatVariantOptions(variant.options)}" is out of stock`,
        );
      }

      if (stock < qty) {
        throw new BadRequestException(
          `Insufficient stock for variant "${citem.variantLabel || this.formatVariantOptions(variant.options)}". Available: ${stock}, required: ${qty}`,
        );
      }

      continue;
    }

  const productId = citem.productId;
    if (!productId) continue;

    const product = await manager.findOne(Product, {
      where: { id: productId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!product) {
      throw new NotFoundException(`Product not found: ${productId}`);
    }

    const currentStock = Number(product.stock ?? 0);

    if (currentStock <= 0) {
      throw new BadRequestException(`Product "${product.name}" is out of stock`);
    }

    if (currentStock < qty) {
      throw new BadRequestException(
        `Insufficient stock for product "${product.name}". Available: ${currentStock}, required: ${qty}`,
      );
    }
  }
}



  async updateOrderStatus(
    admin: User,
    orderId: string,
    dto: UpdateOrderStatusDto,
  ) {
    this.ensureAdmin(admin);

    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
       relations: {
  items: true,
  user: true,
},
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const current = order.status;
      const next = dto.status;
      if (
  current === 'returned' &&
  next === 'refunded' &&
  order.paymentMethod === 'cod'
) {
  throw new BadRequestException(
    'COD returned order does not require a refund',
  );
}


      const allowedTransitions: Record<string, string[]> = {
        pending: ['processing', 'cancelled'],
        paid: ['processing', 'cancelled'],
     awaiting_payment: [],
        pending_verification: ['cancelled'],
        processing: ['shipped', 'cancelled'],
        shipped: ['delivered', 'cancelled'],
        delivered: ['completed'],
        completed: ['refunded'],
        refunded: [],
        failed: [],
        cancelled: [],
      };

      const allowedNext = allowedTransitions[current] || [];

      if (!allowedNext.includes(next)) {
        throw new BadRequestException(
          `Cannot change order status from '${current}' to '${next}'`,
        );
      }

     if (next === 'completed') {
  order.reviewedAt = new Date();
}

   if (next === 'cancelled') {
  await this.restoreStockForRefundedOrder(
    manager,
    order,
  );

  order.reviewedAt = new Date();
}

if (next === 'refunded') {
  /*
   * returned webhook-এ stock ইতিমধ্যে restore হয়েছে।
   */
  if (current !== 'returned') {
    await this.restoreStockForRefundedOrder(
      manager,
      order,
    );
  }

  order.reviewedAt = new Date();
}
      order.status = next;

      order.adminReviewNote = dto.note?.trim()
        ? `${order.adminReviewNote ? `${order.adminReviewNote}\n` : ''}[STATUS:${next}] ${dto.note.trim()}`
        : order.adminReviewNote;

      await manager.save(Order, order);

      const updatedOrder = await manager.findOne(Order, {
  where: { id: order.id },
  relations: this.orderRelations(),
});

return this.attachShipmentTrackingUrls(updatedOrder);
    });
  }


 async restoreStockForRefundedOrder(manager: EntityManager, order: Order) {
  if (!order.items?.length) return;

  for (const item of order.items) {
    const qty = Number(item.quantity ?? 0);
    if (qty <= 0) continue;

    if (item.variantId) {
      const variant = await manager.findOne(ProductVariant, {
        where: { id: item.variantId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!variant) {
        throw new NotFoundException(`Variant not found: ${item.variantId}`);
      }

      variant.stock = (variant.stock ?? 0) + qty;
      await manager.save(ProductVariant, variant);
      continue;
    }

    const productId = item.productId;
    if (!productId) continue;

    const product = await manager.findOne(Product, {
      where: { id: productId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!product) {
      throw new NotFoundException(`Product not found: ${productId}`);
    }

    product.stock = (product.stock ?? 0) + qty;
    await manager.save(Product, product);
  }
}

 
private formatVariantOptions(options?: Record<string, string>) {
  if (!options) return '';

  return Object.entries(options)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' | ');
}


private async reserveStockForOrder(manager: EntityManager, order: Order) {
  if (!order.items?.length) return;

  for (const item of order.items) {
    const qty = Number(item.quantity ?? 0);
    if (qty <= 0) continue;

    // Check and reserve stock for product variants
    if (item.variantId) {
      const variant = await manager.findOne(ProductVariant, {
        where: { id: item.variantId },
        lock: { mode: 'pessimistic_write' },  // Lock the variant for stock reservation
      });

      if (!variant) {
        throw new NotFoundException(`Variant not found: ${item.variantId}`);
      }

      const currentVariantStock = Number(variant.stock ?? 0);

      if (currentVariantStock < qty) {
        throw new BadRequestException(
          `Insufficient stock for variant "${item.variantLabel}". Available: ${currentVariantStock}, required: ${qty}`
        );
      }

      // Temporarily reduce stock (reserving it)
      variant.stock = currentVariantStock - qty;
      await manager.save(ProductVariant, variant);
      continue;
    }

    // Check and reserve stock for the base product
    const productId = item.productId;
    if (!productId) continue;

    const product = await manager.findOne(Product, {
      where: { id: productId },
      lock: { mode: 'pessimistic_write' },  // Lock the product for stock reservation
    });

    if (!product) {
      throw new NotFoundException(`Product not found: ${productId}`);
    }

    const currentStock = Number(product.stock ?? 0);

    if (currentStock < qty) {
      throw new BadRequestException(
        `Insufficient stock for product "${product.name}". Available: ${currentStock}, required: ${qty}`
      );
    }

    // Temporarily reduce stock (reserving it)
    product.stock = currentStock - qty;
    await manager.save(Product, product);
  }
}


async checkout(
  user: User,
  dto: CheckoutDto,
  userIp: string,
  userAgent: string,
) {
  return this.dataSource.transaction(async (manager) => {
    let cart: Cart | null = null;
    let checkoutItems: Array<{
      productId: string;
      quantity: number;

      price: number;
      lineTotal: number;
      variantId?: string;
      variantLabel?: string;
      imageSnapshot?: string;
      nameSnapshot?: string;
      selectedOptionIds?: string[];
      selectedOptions?: Record<string, string>;
    }> = [];

    // 1️⃣ Direct item checkout
    if (dto.directItem) {
      const directItem = await this.buildDirectCheckoutItem(manager, dto.directItem);
      checkoutItems = [directItem];
    } else {
      // 2️⃣ Cart checkout
      cart = await manager.findOne(Cart, {
        where: { user: { id: user.id } },
       relations: { items: true }
      });

      if (!cart || !cart.items?.length) {
        throw new BadRequestException('Cart is empty');
      }

      await this.validateCartStockForCheckout(manager, cart);

    checkoutItems = cart.items.map((citem) => ({
  productId: citem.productId,
  quantity: citem.quantity,
  price: Number(citem.priceSnapshot),
  lineTotal: Number(citem.priceSnapshot) * citem.quantity,
  variantId: citem.variantId,
 variantLabel:
  citem.variantLabel ||
  (citem.productSnapshot as any)?.variant?.label ||
  null,
  imageSnapshot: citem.imageSnapshot,
  nameSnapshot: citem.nameSnapshot,
  selectedOptionIds: citem.selectedOptionIds,
  selectedOptions: citem.selectedOptions,
}));
    }

    // 3️⃣ Calculate totals
    const subtotal = checkoutItems.reduce((sum, i) => sum + i.lineTotal, 0);
   const deliveryCharge =
 Number(dto.shippingCost ?? 0);
    const total = subtotal + deliveryCharge;

    // 4️⃣ Create order
  // 4️⃣ Create order

console.log("CHECKOUT DTO SHIPPING:", {
  shippingRateId: dto.shippingRateId,
  shippingCost: dto.shippingCost,
  shippingMethod: dto.shippingMethod,
});


console.log(
  "SHIPPING PAYLOAD RECEIVED:",
  JSON.stringify(dto.shippingPayload, null, 2)
);


const order = this.orderRepo.create({
      user,
     delivery: {
  fullName: dto.fullName,
  phone: dto.phone,
  address: dto.address,
  city: dto.city,
  state: dto.state,
  postalCode: dto.postalCode,
  country: dto.country,
  note: dto.note,
},
      paymentMethod: dto.paymentMethod || 'cod',

     shippingRateId:
dto.shippingRateId,

shippingRate:
dto.shippingRate,

shippingMethod:
dto.shippingMethod,

shippingCost:
deliveryCharge,


      subtotal,
      deliveryCharge,
      total,
    });

    // 5️⃣ Fraud detection
    await this.detectFraud(order, user, dto, userIp, userAgent);

    const savedOrder = await manager.save(Order, order);


    



    // 6️⃣ Save order items
    const savedItems: OrderItem[] = [];
    for (const citem of checkoutItems) {
   const item = this.itemRepo.create({
  order: savedOrder,
       productId: citem.productId,
        quantity: citem.quantity,
        price: citem.price,
        lineTotal: citem.lineTotal,
        variantId: citem.variantId,
       variantLabel:
  citem.variantLabel ||
  (citem as any).productSnapshot?.variant?.label ||
  null,
        imageSnapshot: citem.imageSnapshot,
        nameSnapshot: citem.nameSnapshot,
        selectedOptionIds: citem.selectedOptionIds,
        selectedOptions: citem.selectedOptions,
      });

      savedItems.push(await manager.save(OrderItem, item));
    }
    savedOrder.items = savedItems;

    // 7️⃣ Reserve stock
    await this.reserveStockForOrder(manager, savedOrder);


    const shippoProvider = await manager.findOne(CourierProvider,{
  where:{
    code:'shippo',
    isActive:true,
    isApiEnabled:true,
  }
});


if(shippoProvider){

const shipment = manager.create(OrderShipment, {

  order: savedOrder,

  courierProvider: shippoProvider,

  selectedRateId:
    savedOrder.shippingRateId,

  selectedRate:
    savedOrder.shippingRate,

  availableRates:
    dto.shippingPayload?.rates || [],




    
  responsePayload: {
  shipment: {
    ...dto.shippingPayload?.shipment,

    parcels:
      dto.shippingPayload?.parcels ||
      [],
  },
},

  courierStatus:
    'not_assigned',

  processingStatus:
    'idle',

  codAmount:
    Number(savedOrder.total),

});

 await manager.save(OrderShipment, shipment);

}

   
   // 8️⃣ Auto assign shipment only for COD processing orders
// try {
//   const shouldAutoAssignCourier =
//     savedOrder.paymentMethod === 'cod' &&
//     savedOrder.status === 'processing';

//   if (shouldAutoAssignCourier) {
//     const steadfastProvider = await manager.findOne(CourierProvider, {
//       where: {
//         code: 'steadfast',
//         isActive: true,
//         isApiEnabled: true,
//       },
//     });

//     if (steadfastProvider) {
//     await this.couriersService.assignShipment(
//   savedOrder.id,
//   {
//     courierProviderId: steadfastProvider.id,
//   },
//   manager,
// );
//     }
//   }
// } catch (err) {
//   console.warn('Steadfast API failed, admin manual override required', err);
// }

    // 9️⃣ Clear cart if applicable
    if (cart) {
      await manager.delete(CartItem, { cart: { id: cart.id } });
    }

    //  🔟 Return saved order with tracking URLs
    const completedOrder = await manager.findOne(Order, {
      where: { id: savedOrder.id },
      relations: this.orderRelations(),
    });

    return this.attachShipmentTrackingUrls(completedOrder);
  });
}

 async myOrders(user: User) {
  const orders = await this.orderRepo.find({
    where: { user: { id: user.id } },
    relations: this.orderRelations(),
    order: { createdAt: 'DESC' },
  });

  return this.attachShipmentTrackingUrlsToOrders(orders);
}

async getOneForUser(user: User, orderId: string) {
  const order = await this.orderRepo.findOne({
    where: { id: orderId, user: { id: user.id } },
    relations: this.orderRelations(),
  });

  if (!order) throw new NotFoundException('Order not found');

  return this.attachShipmentTrackingUrls(order);
}

  async getPendingVerificationOrders() {
  const orders = await this.orderRepo.find({
    where: { status: 'pending_verification' },
    relations: this.orderRelations(),
    order: { createdAt: 'DESC' },
  });

  return this.attachShipmentTrackingUrlsToOrders(orders);
}

  async getAwaitingPaymentOrders() {
  const orders = await this.orderRepo.find({
    where: { status: 'awaiting_payment' },
    relations: this.orderRelations(),
    order: { createdAt: 'DESC' },
  });

  return this.attachShipmentTrackingUrlsToOrders(orders);
}

  async getAllOrdersForAdmin() {
  const orders = await this.orderRepo.find({
    relations: this.orderRelations(),
    order: { createdAt: 'DESC' },
  });

  return this.attachShipmentTrackingUrlsToOrders(orders);
}

//   async reviewOrder(orderId: string, dto: ReviewOrderDto) {
//   return this.dataSource.transaction(async (manager) => {
//     const order = await manager.findOne(Order, {
//       where: { id: orderId },
//       relations: {
//   items: true,
//   user: true,
// },
//     });

//     if (!order) {
//       throw new NotFoundException('Order not found');
//     }

//     if (order.status !== 'pending_verification') {
//       throw new BadRequestException(
//         'Only pending verification orders can be reviewed',
//       );
//     }

//     order.adminReviewNote = dto.note?.trim() || undefined;
//     order.reviewedAt = new Date();

//    if (dto.action === 'approve') {
//   order.fraudFlag = false;
//   order.reviewStatus = 'verified';
//   const requiresOnlinePayment = ['bkash_manual', 'stripe'].includes(
//   order.paymentMethod,
// );

// order.status = requiresOnlinePayment
//   ? 'awaiting_payment'
//   : 'processing';
// } else {
//       await this.restoreStockForRefundedOrder(manager, order);

//       order.fraudFlag = true;
//       order.reviewStatus = 'rejected';
//       order.status = 'failed';
//     }

//     await manager.save(Order, order);

//    const reviewedOrder = await manager.findOne(Order, {
//   where: { id: order.id },
//   relations: this.orderRelations(),
// });

// return this.attachShipmentTrackingUrls(reviewedOrder);
//   });
// }

async reviewOrder(
  admin: User,
  orderId: string,
  dto: ReviewOrderDto,
) {
  this.ensureAdmin(admin);

  return this.dataSource.transaction(async (manager) => {
    /*
     * প্রথমে শুধু orders table-এর row lock করব।
     * এখানে relations দেওয়া যাবে না।
     */
    const order = await manager
      .getRepository(Order)
      .createQueryBuilder('order')
      .where('order.id = :orderId', { orderId })
      .setLock('pessimistic_write')
      .getOne();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'pending_verification') {
      throw new BadRequestException(
        'Only pending verification orders can be reviewed',
      );
    }

    order.adminReviewNote = dto.note?.trim() || undefined;
    order.reviewedAt = new Date();

    if (dto.action === 'approve') {
      order.fraudFlag = false;
      order.reviewStatus = 'verified';

    const requiresOnlinePayment =
  order.paymentMethod === 'stripe';

      order.status = requiresOnlinePayment
        ? 'awaiting_payment'
        : 'processing';
    } else {
      /*
       * Stock restore করার জন্য শুধু reject-এর সময়
       * order items আলাদাভাবে load করব।
       */
      order.items = await manager
        .getRepository(OrderItem)
        .find({
          where: {
            order: { id: order.id },
          },
        });

      await this.restoreStockForRefundedOrder(
        manager,
        order,
      );

      order.fraudFlag = true;
      order.reviewStatus = 'rejected';
      order.status = 'failed';
    }

    await manager.save(Order, order);

    /*
     * Locking শেষ হওয়ার পর response-এর জন্য
     * relations সহ order load করা নিরাপদ।
     */
    const reviewedOrder = await manager.findOne(Order, {
      where: { id: order.id },
      relations: this.orderRelations(),
    });

    return this.attachShipmentTrackingUrls(
      reviewedOrder,
    );
  });
}


async getOneForAdmin(orderId: string) {
  const order = await this.orderRepo.findOne({
    where: { id: orderId },
    relations: this.orderRelations(),
  });

  if (!order) {
    throw new NotFoundException('Order not found');
  }

  return this.attachShipmentTrackingUrls(order);
}
}