import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Order } from '../orders/order.entity';
import { CourierProvider } from './courier-provider.entity';
import { OrderShipment } from './order-shipment.entity';
import { CreateCourierProviderDto } from './dto/create-courier-provider.dto';
import { UpdateCourierProviderDto } from './dto/update-courier-provider.dto';

import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { CourierShipmentStatus } from './courier.types';
import { Product } from '../products/product.entity';
import { ProductVariant } from '../products/product-variant.entity';

import { CourierFactory } from './strategies/courier.factory';

import { AssignShipmentDto } from './dto/assign-shipment.dto';

@Injectable()
export class CouriersService implements OnModuleInit {
  
  constructor(
    @InjectRepository(CourierProvider)
    private providerRepo: Repository<CourierProvider>,

    @InjectRepository(OrderShipment)
    private shipmentRepo: Repository<OrderShipment>,

    @InjectRepository(Order)
    private orderRepo: Repository<Order>,

    @InjectRepository(Product)
private productRepo: Repository<Product>,

@InjectRepository(ProductVariant)
private variantRepo: Repository<ProductVariant>,

    private dataSource: DataSource,
      private courierFactory: CourierFactory,

       
  ) {}

  async onModuleInit() {
    await this.ensureDefaultCourierProviders();
  }

  private normalizeCode(code: string) {
    return code.trim().toLowerCase().replace(/\s+/g, '_');
  }

// private buildTrackingUrl(shipment: OrderShipment) {

//   const payload: any = shipment.responsePayload || {};

//   const trackingUrl =
//     payload.label?.rawResponse?.tracking_url_provider ||
//     payload.label?.trackingUrl ||
//     payload.tracking_url_provider ||
//     payload.trackingUrl;


//   if (trackingUrl) {
//     return trackingUrl;
//   }


//   const pattern =
//     shipment.courierProvider?.trackingUrlPattern;


//   if (!pattern || !shipment.trackingNumber) {
//     return undefined;
//   }


//   return pattern.replace(
//     '{tracking_number}',
//     encodeURIComponent(shipment.trackingNumber),
//   );
// }

private buildTrackingUrl(shipment: OrderShipment) {

  const payload: any = shipment.responsePayload || {};

  const trackingUrl =
    payload.label?.rawResponse?.tracking_url_provider ||
    payload.label?.rawResponse?.tracking_url ||
    payload.shipment?.transaction?.tracking_url_provider ||
    payload.shipment?.transaction?.tracking_url ||
    payload.shipment?.tracking_url_provider ||
    payload.tracking_url_provider ||
    shipment.trackingUrl;


  if (trackingUrl) {
    return trackingUrl;
  }


  const pattern =
    shipment.courierProvider?.trackingUrlPattern;


  if (!pattern || !shipment.trackingNumber) {
    return undefined;
  }


  return pattern.replace(
    '{tracking_number}',
    encodeURIComponent(shipment.trackingNumber),
  );
}

 private attachTrackingUrl<T extends OrderShipment | null>(shipment: T): T {
  if (!shipment) return shipment;

  const url = this.buildTrackingUrl(shipment);

 

  shipment.trackingUrl = url;

  return shipment;
}

  private attachTrackingUrlsToOrder<T extends Order | null>(order: T): T {
    if (!order) return order;

    const shipments = (order as any).shipments as OrderShipment[] | undefined;

    if (shipments?.length) {
      shipments.forEach((shipment) => this.attachTrackingUrl(shipment));
    }

    return order;
  }


   private mapSteadfastStatus(status: string): CourierShipmentStatus | null {
    const s = status.toLowerCase();

    if (['pending', 'created'].includes(s)) return 'ready_to_ship';
    if (['picked_up', 'pickup_done'].includes(s)) return 'picked_up';
    if (['in_transit', 'on_the_way'].includes(s)) return 'in_transit';
    if (['delivered', 'success'].includes(s)) return 'delivered';
    if (['returned', 'cancelled'].includes(s)) return 'returned';

    return null;
  }

private async restoreStockForCourierReturnedOrder(
  manager: EntityManager,
  order: Order,
) {
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

      variant.stock = Number(variant.stock ?? 0) + qty;
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

    product.stock = Number(product.stock ?? 0) + qty;
    await manager.save(Product, product);
  }
}

// private async syncOrderStatusFromCourierStatus(
//   manager: EntityManager,
//   order: Order,
//   courierStatus: CourierShipmentStatus,
// ) {
//   const currentStatus = order.status;

//   if (courierStatus === 'delivered') {
//     if (['processing', 'shipped'].includes(currentStatus)) {
//       order.status = 'delivered';
//       order.adminReviewNote = order.adminReviewNote
//         ? `${order.adminReviewNote}\n[COURIER_AUTO:delivered] Order marked as delivered from courier status`
//         : '[COURIER_AUTO:delivered] Order marked as delivered from courier status';

//       await manager.save(Order, order);
//     }

//     return;
//   }

//   if (courierStatus === 'returned') {
//     if (['cancelled', 'failed', 'refunded'].includes(currentStatus)) {
//       return;
//     }

//     const nextOrderStatus =
//       ['delivered', 'completed'].includes(currentStatus) ? 'refunded' : 'cancelled';

//     await this.restoreStockForCourierReturnedOrder(manager, order);

//     order.status = nextOrderStatus;
//     order.reviewedAt = new Date();
//     order.adminReviewNote = order.adminReviewNote
//       ? `${order.adminReviewNote}\n[COURIER_AUTO:returned] Order marked as ${nextOrderStatus} from courier returned status`
//       : `[COURIER_AUTO:returned] Order marked as ${nextOrderStatus} from courier returned status`;

//     await manager.save(Order, order);
//   }
// }


private async syncOrderStatusFromCourierStatus(
  manager: EntityManager,
  order: Order,
  courierStatus: CourierShipmentStatus,
) {
  const currentStatus = order.status;

  const terminalOrderStatuses = [
    'completed',
    'refunded',
    'cancelled',
    'returned',
  ];

  if (terminalOrderStatuses.includes(currentStatus)) {
    return;
  }

  const appendNote = (line: string) => {
    order.adminReviewNote = order.adminReviewNote
      ? `${order.adminReviewNote}\n${line}`
      : line;
  };

  if (
    [
      'assigned_to_courier',
      'picked_up',
      'in_transit',
      'out_for_delivery',
    ].includes(courierStatus)
  ) {
    if (['processing', 'paid'].includes(currentStatus)) {
      order.status = 'shipped';

      appendNote(
        `[COURIER_AUTO:${courierStatus}] Order marked as shipped`,
      );

      await manager.save(Order, order);
    }

    return;
  }

  if (courierStatus === 'delivered') {
    if (
      [
        'processing',
        'shipped',
        'delivery_failed',
      ].includes(currentStatus)
    ) {
      order.status = 'delivered';

      appendNote(
        '[COURIER_AUTO:delivered] Order marked as delivered',
      );

      await manager.save(Order, order);
    }

    return;
  }

  if (courierStatus === 'delivery_failed') {
    if (
      [
        'processing',
        'shipped',
      ].includes(currentStatus)
    ) {
      order.status = 'delivery_failed';

      appendNote(
        '[COURIER_AUTO:delivery_failed] Carrier reported a delivery exception',
      );

      await manager.save(Order, order);
    }

    return;
  }

  if (courierStatus === 'returned') {
    if (
      [
        'cancelled',
        'refunded',
        'returned',
      ].includes(currentStatus)
    ) {
      return;
    }

    /*
     * Stock restoration must happen only once,
     * when the shipment becomes definitively returned.
     */
    await this.restoreStockForCourierReturnedOrder(
      manager,
      order,
    );

    order.status = 'returned';
    order.reviewedAt = new Date();

    appendNote(
      '[COURIER_AUTO:returned] Shipment returned to sender and stock restored',
    );

    await manager.save(Order, order);
  }
}



  private async ensureDefaultCourierProviders() {
   const defaults: Array<Partial<CourierProvider>> = [
     

{
    name: 'Shippo',
    code: 'shippo',
    mode: 'api',
    websiteUrl: 'https://goshippo.com',
  trackingUrlPattern:
'https://tools.usps.com/go/TrackConfirmAction_input?origTrackNum={tracking_number}',
    isActive: true,
    isApiEnabled: true,
    apiConfig: {
      keyRef: 'SHIPPO',
    },
    sortOrder: 1,
  },
];



    for (const item of defaults) {
      const existing = await this.providerRepo.findOne({
        where: { code: item.code },
      });

      if (!existing) {
        await this.providerRepo.save(this.providerRepo.create(item));
      }
    }
  }


private validateDeliveryData(order: Order) {
  const d = order.delivery;

  if (!d?.fullName || d.fullName.trim().length < 3) {
    throw new BadRequestException('Invalid recipient name');
  }

  if (!d?.phone) {
    throw new BadRequestException('Phone is required');
  }

  const phone = d.phone.replace(/\s+/g, '');

  // International phone validation
  if (d.country === 'US') {
  if (!/^\+1\d{10}$/.test(phone)) {
    throw new BadRequestException(
      'Invalid US phone number'
    );
  }
} else {
  if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
    throw new BadRequestException(
      'Invalid international phone number'
    );
  }
}

  if (!d?.address || d.address.trim().length < 10) {
    throw new BadRequestException('Address too short');
  }

  if (!d?.city) {
    throw new BadRequestException('City is required');
  }

  if (!d?.state) {
    throw new BadRequestException('State is required');
  }

  if (d.country === 'US') {
  if (!/^\d{5}(-\d{4})?$/.test(d.postalCode)) {
    throw new BadRequestException(
      'Invalid US ZIP code'
    );
  }
}

  if (!d?.country) {
    throw new BadRequestException('Country is required');
  }
}


private calculateParcelWeight(items: any[]) {

  const DEFAULT_WEIGHT = 0.4;

  let totalWeight = 0;


  for (const item of items) {

    const weight =
      Number(item.product?.weight ?? DEFAULT_WEIGHT);

    totalWeight +=
      weight * Number(item.quantity ?? 1);

  }


  return totalWeight || DEFAULT_WEIGHT;
}




private mapShippoStatus(
  status?: string,
  substatusCode?: string,
  statusDetails?: string,
): CourierShipmentStatus | null {
  const normalizedStatus = String(status || '')
    .trim()
    .toUpperCase();

  const details = [
    substatusCode,
    statusDetails,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  switch (normalizedStatus) {
    case 'PRE_TRANSIT':
      return 'ready_to_ship';

    case 'TRANSIT':
      if (
        details.includes('out for delivery') ||
        details.includes('delivery today')
      ) {
        return 'out_for_delivery';
      }

      if (
        details.includes('picked up') ||
        details.includes('carrier received') ||
        details.includes('accepted')
      ) {
        return 'picked_up';
      }

      return 'in_transit';

    case 'DELIVERED':
      return 'delivered';

    case 'RETURNED':
      return 'returned';

    case 'FAILURE':
      return 'delivery_failed';

    case 'UNKNOWN':
    default:
      return null;
  }
}


// async getShippingRates(orderData:any) {


//   const provider =
//     await this.providerRepo.findOne({

//       where:{
//         code:'shippo',
//         isActive:true,
//         isApiEnabled:true,
//       },

//     });



//   if(!provider){

//     throw new NotFoundException(
//       'Shippo provider not available',
//     );

//   }



//   const strategy =
//     this.courierFactory.get(
//       provider.code,
//     );



//   const result =
//     await strategy.getShippingRates(
//       orderData,
//       provider,
//     );



//   return result.rates;

// }



async getShippingRates(orderData:any) {

  const items = orderData.items || [];


  const productIds =
    items.map(
      (item:any)=>item.productId
    );


  const products =
    await this.productRepo.findBy({
      id: In(productIds),
    });


  const itemsWithWeight =
    items.map((item:any)=>{

      const product =
        products.find(
          p=>p.id === item.productId
        );


      return {
        ...item,
        product,
      };

    });


  orderData.items = itemsWithWeight;


  const provider =
    await this.providerRepo.findOne({
      where:{
        code:'shippo',
        isActive:true,
        isApiEnabled:true,
      },
    });


  if(!provider){
    throw new NotFoundException(
      'Shippo provider not available',
    );
  }


  const strategy =
    this.courierFactory.get(
      provider.code,
    );


 const result =
  await strategy.getShippingRates(
    orderData,
    provider,
  );


return {
  rates: result.rates,

  rawResponse: {
    ...result.rawResponse,

    address_from: result.address_from,
    address_to: result.address_to,
  },
};

}

  async getCourierProviders() {
    return this.providerRepo.find({
      order: {
        sortOrder: 'ASC',
        createdAt: 'ASC',
      },
    });
  }

  async createCourierProvider(dto: CreateCourierProviderDto) {
    const code = this.normalizeCode(dto.code);

    const existing = await this.providerRepo.findOne({
      where: { code },
    });

    if (existing) {
      throw new BadRequestException('Courier provider code already exists');
    }

    const provider = this.providerRepo.create({
      name: dto.name.trim(),
      code,
      mode: dto.mode || 'manual',
      phone: dto.phone?.trim() || undefined,
      websiteUrl: dto.websiteUrl?.trim() || undefined,
      trackingUrlPattern: dto.trackingUrlPattern?.trim() || undefined,
      isActive: dto.isActive ?? true,
      isApiEnabled: dto.isApiEnabled ?? false,
      sortOrder: dto.sortOrder ?? 0,
        apiConfig: dto.apiConfig,
    });

    return this.providerRepo.save(provider);
  }

  async updateCourierProvider(id: string, dto: UpdateCourierProviderDto) {
    const provider = await this.providerRepo.findOne({
      where: { id },
    });

    if (!provider) {
      throw new NotFoundException('Courier provider not found');
    }

    if (dto.code) {
      const nextCode = this.normalizeCode(dto.code);

      const existing = await this.providerRepo.findOne({
        where: { code: nextCode },
      });

      if (existing && existing.id !== provider.id) {
        throw new BadRequestException('Courier provider code already exists');
      }

      provider.code = nextCode;
    }

    if (dto.name !== undefined) provider.name = dto.name.trim();
    if (dto.mode !== undefined) provider.mode = dto.mode;

    if (dto.apiConfig !== undefined) {
  provider.apiConfig = dto.apiConfig;
}

    if (dto.phone !== undefined) provider.phone = dto.phone.trim() || undefined;
    if (dto.websiteUrl !== undefined) {
      provider.websiteUrl = dto.websiteUrl.trim() || undefined;
    }
    if (dto.trackingUrlPattern !== undefined) {
      provider.trackingUrlPattern =
        dto.trackingUrlPattern.trim() || undefined;
    }
    if (dto.isActive !== undefined) provider.isActive = dto.isActive;
    if (dto.isApiEnabled !== undefined) {
      provider.isApiEnabled = dto.isApiEnabled;
    }
    if (dto.sortOrder !== undefined) provider.sortOrder = dto.sortOrder;

    return this.providerRepo.save(provider);
  }







async assignShipment(
  orderId: string,
  dto: AssignShipmentDto,
  existingManager?: EntityManager,
) {
  const run = async (manager: EntityManager) => {
   const order = await manager.findOne(Order, { 
  where: { id: orderId }, 
  relations: ['items'] 
});

if (!order) {
  throw new NotFoundException('Order not found');
}

this.validateDeliveryData(order);

    
   const provider = await manager.findOne(CourierProvider, { 
  where: { id: dto.courierProviderId } 
});

if (!provider) {
  throw new NotFoundException('Courier provider not found');
}


// ✅ ADD THIS HERE
const existingShipment = await manager.findOne(
  OrderShipment,
  {
    where: {
      order: {
        id: orderId,
      },
    },
  },
);


if (existingShipment) {
  throw new BadRequestException(
    'Shipment already exists for this order',
  );
}


// Existing code
const shipment = manager.create(OrderShipment, {

  order,

  courierProvider: provider,

  selectedRateId:
    order.shippingRateId,

});



    const finalPickupAddress =
  dto.pickupAddress?.trim() || process.env.BUSINESS_ADDRESS?.trim();

if (!finalPickupAddress) {
  throw new BadRequestException("Pickup address is required");
}

    // ✅ ONLY API PATH
    if (provider.mode === 'api' && provider.isApiEnabled) {
     try {
  // const strategy = this.courierFactory.get(provider.code);

  // failure হলেও pickupAddress response-এ দেখাবে
  shipment.pickupAddress = finalPickupAddress;




shipment.pickupAddress = finalPickupAddress;

shipment.courierStatus = 'ready_to_ship';

shipment.processingStatus = 'idle';

shipment.codAmount = Number(order.total || 0);

// shipment.selectedRateId = order.shippingRateId;

shipment.note =
  `[READY] ${provider.name} label creation pending`;

} catch (err: any) {
  const errorMessage =
    err?.response?.message ||
    err?.message ||
    JSON.stringify(err) ||
    'Unknown courier API error';

  shipment.pickupAddress = finalPickupAddress;
  shipment.processingStatus = 'failed';
  shipment.courierStatus = 'not_assigned';
  shipment.note = '[API FAILED] Requires manual override';
  shipment.errorMessage = errorMessage;

  shipment.responsePayload = {
    error: errorMessage,
    raw: err?.response || null,
  } as any;

  console.error('STEADFAST_ASSIGN_FAILED:', {
    orderId,
    providerCode: provider.code,
    pickupAddress: finalPickupAddress,
    errorMessage,
  });
}
    } else {
      // ❌ Remove manual completely
      throw new Error("Courier provider is not API enabled");
    }

    await manager.save(OrderShipment, shipment);
return shipment;
  };

  if (existingManager) {
    return run(existingManager);
  }

  return this.dataSource.transaction(run);
}



async createLabel(
  orderId: string,
  rateId: string,
) {

  if (!rateId) {
    throw new BadRequestException(
      'Shipping rate required',
    );
  }


  const order = await this.orderRepo.findOne({
    where: {
      id: orderId,
    },
  });


  if (!order) {
    throw new NotFoundException(
      'Order not found',
    );
  }


  if (!order.shippingRateId) {
    throw new BadRequestException(
      'Customer shipping rate not selected',
    );
  }


  // if (order.shippingRateId !== rateId) {
  //   throw new BadRequestException(
  //     'Selected rate does not match customer selected rate',
  //   );
  // }


  const shipment = await this.shipmentRepo.findOne({
    where: {
      orderId,
    },
    relations: {
      courierProvider: true,
    },
  });


  if (!shipment) {
    throw new NotFoundException(
      'Shipment not found'
    );
  }


let rate =
  shipment.adminSelectedRate ||
  shipment.selectedRate;


if (!rate || shipment.selectedRateId !== rateId && shipment.adminSelectedRateId !== rateId) {

  const availableRate =
    shipment.availableRates?.find(
      (r:any)=> r.id === rateId,
    );


  if (!availableRate) {
    throw new BadRequestException(
      'Selected shipping rate not found',
    );
  }


  rate = availableRate;

}

if (!rate) {
  throw new BadRequestException(
    'Selected shipping rate missing'
  );
}


  if (!rate) {
    throw new BadRequestException(
      'Invalid shipping rate'
    );
  }


  const strategy =
    this.courierFactory.get(
      shipment.courierProvider.code
    );


  if (
    shipment.courierProvider.code !== 'shippo'
  ) {
    throw new BadRequestException(
      'Only Shippo supported'
    );
  }


let result;

try {

  result =
    await strategy.createLabel(
      shipment,
      rateId
    );


} catch(error:any){


  shipment.processingStatus = "failed";

  shipment.errorMessage =
    error?.message ||
    "Label creation failed";


  shipment.responsePayload = {
    ...(shipment.responsePayload || {}),
    labelError:
      error?.response ||
      error,
  };


  shipment.courierStatus =
    "ready_to_ship";


  await this.shipmentRepo.save(
    shipment
  );


  throw error;

}


// ✅ success হলে পুরানো error clear হবে

shipment.processingStatus = "idle";

shipment.errorMessage = undefined;

if (shipment.responsePayload?.labelError) {

  delete shipment.responsePayload.labelError;

}


  // shipment.selectedRateId = rateId;

  // shipment.trackingNumber =
  //   result.trackingNumber;

  // shipment.responsePayload = {
  //   ...(shipment.responsePayload || {}),
  //   label: result,
  // };


if (shipment.adminSelectedRateId === rateId) {

  shipment.adminSelectedRateId = rateId;

  shipment.adminSelectedRate = rate;

} else {

  shipment.selectedRateId = rateId;

  shipment.selectedRate = rate;

}

shipment.trackingNumber =
  result.trackingNumber;


shipment.deliveryCharge =
  Number(rate.amount);


shipment.responsePayload = {
  ...(shipment.responsePayload || {}),

  shipment: {
  ...(shipment.responsePayload?.shipment || {}),

  transaction: result.rawResponse,

  selectedRate: rate,

  status: result.rawResponse?.status,

  object_id: result.rawResponse?.object_id,

  test: result.rawResponse?.test,

  address_from:
    shipment.responsePayload?.address_from ||
    shipment.responsePayload?.shipment?.address_from,

address_to:
    shipment.responsePayload?.address_to ||
    shipment.responsePayload?.shipment?.address_to,
},

  label: result,

  trackingUrl:
    result.trackingUrl,
};

  shipment.courierStatus =
    'assigned_to_courier';





  await this.shipmentRepo.save(
    shipment
  );


 const updatedOrder = await this.orderRepo.findOne({
  where: {
    id: orderId,
  },
  relations: {
    shipments: {
      courierProvider: true,
    },
  } as any,
});

return this.attachTrackingUrlsToOrder(updatedOrder);
}




async updateShipmentStatus(
  shipmentId: string,
  dto: UpdateShipmentStatusDto,
) {
  return this.dataSource.transaction(async (manager) => {
    const shipment = await manager.findOne(OrderShipment, {
      where: { id: shipmentId },
      relations: {
        order: {
          items: { product: { media: true } },
          user: true,
          shipments: { courierProvider: true },
        },
        courierProvider: true,
      } as any,
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }


    if (shipment.courierProvider?.mode === 'api') {
  throw new BadRequestException(
    'Cannot manually update API shipment',
  );
}
    // -------------------------
    // UPDATE STATUS
    // -------------------------
    shipment.courierStatus = dto.courierStatus;

    // -------------------------
    // OPTIONAL FIELDS
    // -------------------------
    if (dto.trackingNumber !== undefined) {
      shipment.trackingNumber = dto.trackingNumber.trim() || undefined;
    }

    if (dto.consignmentId !== undefined) {
      shipment.consignmentId = dto.consignmentId.trim() || undefined;
    }

    if (dto.note?.trim()) {
      const line = `[${dto.courierStatus}] ${dto.note.trim()}`;
      shipment.note = shipment.note
        ? `${shipment.note}\n${line}`
        : line;
    }

    // -------------------------
    // TIMESTAMPS
    // -------------------------
    if (
      ['assigned_to_courier', 'picked_up', 'in_transit'].includes(
        dto.courierStatus,
      )
    ) {
      shipment.sentAt = shipment.sentAt || new Date();
    }

    if (dto.courierStatus === 'delivered') {
      shipment.deliveredAt = new Date();
    }

    if (dto.courierStatus === 'returned') {
      shipment.returnedAt = new Date();
    }

    await manager.save(OrderShipment, shipment);

    // -------------------------
    // SYNC ORDER
    // -------------------------
    await this.syncOrderStatusFromCourierStatus(
      manager,
      shipment.order,
      shipment.courierStatus,
    );

    // -------------------------
    // RETURN UPDATED ORDER
    // -------------------------
    const updatedOrder = await manager.findOne(Order, {
      where: { id: shipment.orderId },
      relations: {
        items: { product: { media: true } },
        user: true,
        shipments: { courierProvider: true },
      } as any,
    });

    return this.attachTrackingUrlsToOrder(updatedOrder);
  });
}







async handleSteadfastWebhook(data: any, signature?: string) {
  // 1. VERIFY SIGNATURE
 const expectedSecret = process.env.STEADFAST_WEBHOOK_SECRET?.trim();

const receivedToken = String(signature || '')
  .replace(/^Bearer\s+/i, '')
  .trim();

if (!expectedSecret || receivedToken !== expectedSecret) {
  throw new BadRequestException('Invalid webhook token');
}

  // 2. VALIDATION
if (!data?.consignment_id) {
  throw new BadRequestException('Invalid webhook payload');
}

if (data.notification_type === 'tracking_update' && !data.status) {
  return {
    status: 'success',
    message: 'Tracking update received',
  };
}

if (!data?.status) {
  throw new BadRequestException('Invalid webhook payload');
}

const consignmentId = String(data.consignment_id).trim();

const shipment = await this.shipmentRepo.findOne({
  where: { consignmentId },
  relations: {
    order: {
      items: {
        product: true,
      },
    },
  } as any,
});
  if (!shipment) {
    return { message: 'Shipment not found' };
  }

  // 4. MAP STATUS
  const mappedStatus = this.mapSteadfastStatus(data.status);

  if (!mappedStatus) {
    return { message: 'Ignored unknown status' };
  }

  // 5. IDEMPOTENCY
  if (shipment.courierStatus === mappedStatus) {
    return { message: 'Already processed' };
  }

  // 6. UPDATE
  shipment.courierStatus = mappedStatus;

  if (mappedStatus === 'delivered') {
    shipment.deliveredAt = shipment.deliveredAt || new Date();
  }

  if (mappedStatus === 'returned') {
    shipment.returnedAt = shipment.returnedAt || new Date();
  }

  shipment.responsePayload = {
    ...(shipment.responsePayload || {}),
    webhook: data,
  };

  await this.shipmentRepo.save(shipment);

  // 7. SYNC ORDER
  await this.syncOrderStatusFromCourierStatus(
    this.dataSource.manager,
    shipment.order,
    mappedStatus,
  );

  return { success: true };
}



// async handleShippoWebhook(
//   data: any,
//   signature?: string,
// ) {

//   const eventType = data?.event;

//   if (!eventType) {
//     throw new BadRequestException(
//       'Invalid Shippo webhook payload',
//     );
//   }


//   const trackingNumber =
//     data?.data?.tracking_number;


//   if (!trackingNumber) {
//     return {
//       message: 'No tracking number',
//     };
//   }


//   const shipment =
//     await this.shipmentRepo.findOne({
//       where: {
//         trackingNumber,
//       },
//       relations: {
//         order: {
//           items: {
//             product: true,
//           },
//         },
//       } as any,
//     });


//   if (!shipment) {
//     return {
//       message: 'Shipment not found',
//     };
//   }


//   shipment.responsePayload = {
//     ...(shipment.responsePayload || {}),
//     webhook: data,
//   };


//   switch(eventType) {

//     case 'track_updated':

//       const status =
//         data.data.tracking_status?.status;


//       if (status === 'DELIVERED') {
//         shipment.courierStatus = 'delivered';
//         shipment.deliveredAt =
//           shipment.deliveredAt || new Date();
//       }


//       if (
//         [
//           'FAILURE',
//           'RETURNED',
//         ].includes(status)
//       ) {
//         shipment.courierStatus = 'returned';
//         shipment.returnedAt =
//           shipment.returnedAt || new Date();
//       }

//       break;


//     default:
//       return {
//         message:'Ignored event',
//       };
//   }


//   await this.shipmentRepo.save(shipment);


//   await this.syncOrderStatusFromCourierStatus(
//     this.dataSource.manager,
//     shipment.order,
//     shipment.courierStatus,
//   );


//   return {
//     success:true,
//   };
// }


// async handleShippoWebhook(
//   data: any,
//   signature?: string,
// ) {
//   if (data?.event !== 'track_updated') {
//     return {
//       success: true,
//       message: 'Ignored unsupported Shippo event',
//     };
//   }

//   const trackingNumber = String(
//     data?.data?.tracking_number || '',
//   ).trim();

//   if (!trackingNumber) {
//     return {
//       success: true,
//       message: 'No tracking number',
//     };
//   }

//   return this.dataSource.transaction(
//     async (manager) => {
//       const shipment = await manager.findOne(
//         OrderShipment,
//         {
//           where: {
//             trackingNumber,
//           },
//           relations: {
//             order: {
//               items: {
//                 product: true,
//               },
//             },
//             courierProvider: true,
//           } as any,
//           lock: {
//             mode: 'pessimistic_write',
//           },
//         },
//       );

//       if (!shipment) {
//         return {
//           success: true,
//           message: 'Shipment not found',
//         };
//       }

//       const trackingStatus =
//         data?.data?.tracking_status;

//       const mappedStatus =
//         this.mapShippoStatus(
//           trackingStatus?.status,
//           trackingStatus?.substatus?.code,
//           trackingStatus?.status_details,
//         );

//       shipment.responsePayload = {
//         ...(shipment.responsePayload || {}),
//         webhook: data,
//         lastWebhookAt: new Date().toISOString(),
//       };

//       if (!mappedStatus) {
//         await manager.save(
//           OrderShipment,
//           shipment,
//         );

//         return {
//           success: true,
//           message: 'Unknown status stored without changing shipment',
//         };
//       }

//       /*
//        * Repeated Shippo webhook হলে আবার stock restore বা
//        * status processing হবে না।
//        */
//       if (
//         shipment.courierStatus === mappedStatus
//       ) {
//         await manager.save(
//           OrderShipment,
//           shipment,
//         );

//         return {
//           success: true,
//           message: 'Already processed',
//         };
//       }

//       shipment.courierStatus =
//         mappedStatus;

//       if (
//         [
//           'assigned_to_courier',
//           'picked_up',
//           'in_transit',
//           'out_for_delivery',
//         ].includes(mappedStatus)
//       ) {
//         shipment.sentAt =
//           shipment.sentAt || new Date();
//       }

//       if (mappedStatus === 'delivered') {
//         shipment.deliveredAt =
//           shipment.deliveredAt || new Date();
//       }

//       if (mappedStatus === 'returned') {
//         shipment.returnedAt =
//           shipment.returnedAt || new Date();
//       }

//       shipment.note = shipment.note
//         ? `${shipment.note}\n[SHIPPO:${mappedStatus}] ${
//             trackingStatus?.status_details ||
//             trackingStatus?.status ||
//             'Tracking updated'
//           }`
//         : `[SHIPPO:${mappedStatus}] ${
//             trackingStatus?.status_details ||
//             trackingStatus?.status ||
//             'Tracking updated'
//           }`;

//       await manager.save(
//         OrderShipment,
//         shipment,
//       );

//       await this.syncOrderStatusFromCourierStatus(
//         manager,
//         shipment.order,
//         mappedStatus,
//       );

//       return {
//         success: true,
//         shipmentStatus: mappedStatus,
//         orderStatus: shipment.order.status,
//       };
//     },
//   );
// }

async handleShippoWebhook(
  data: any,
  signature?: string,
) {
  if (data?.event !== 'track_updated') {
    return {
      success: true,
      message: 'Ignored unsupported Shippo event',
    };
  }

  const trackingNumber = String(
    data?.data?.tracking_number || '',
  ).trim();

  if (!trackingNumber) {
    return {
      success: true,
      message: 'No tracking number',
    };
  }

  return this.dataSource.transaction(
    async (manager) => {
      /*
       * শুধু order_shipments row lock করুন।
       * Lock query-তে relations/LEFT JOIN ব্যবহার করবেন না।
       */
      const shipment = await manager
        .getRepository(OrderShipment)
        .createQueryBuilder('shipment')
        .where(
          'shipment.trackingNumber = :trackingNumber',
          { trackingNumber },
        )
        .setLock('pessimistic_write')
        .getOne();

      if (!shipment) {
        return {
          success: true,
          message: 'Shipment not found',
        };
      }

      /*
       * Order আলাদাভাবে load করুন।
       * Stock restore করার জন্য items প্রয়োজন।
       */
      const order = await manager.findOne(Order, {
        where: {
          id: shipment.orderId,
        },
        relations: {
          items: true,
        },
      });

      if (!order) {
        return {
          success: true,
          message: 'Order not found',
        };
      }

      shipment.order = order;

      const trackingStatus =
        data?.data?.tracking_status;

      const mappedStatus =
        this.mapShippoStatus(
          trackingStatus?.status,
          trackingStatus?.substatus?.code,
          trackingStatus?.status_details,
        );

      shipment.responsePayload = {
        ...(shipment.responsePayload || {}),
        webhook: data,
        lastWebhookAt: new Date().toISOString(),
      };

      if (!mappedStatus) {
        await manager.save(
          OrderShipment,
          shipment,
        );

        return {
          success: true,
          message:
            'Unknown status stored without changing shipment',
        };
      }

      /*
       * Duplicate webhook হলে stock দ্বিতীয়বার restore হবে না।
       */
      if (
        shipment.courierStatus === mappedStatus
      ) {
        await manager.save(
          OrderShipment,
          shipment,
        );

        return {
          success: true,
          message: 'Already processed',
        };
      }

      shipment.courierStatus =
        mappedStatus;

      if (
        [
          'assigned_to_courier',
          'picked_up',
          'in_transit',
          'out_for_delivery',
        ].includes(mappedStatus)
      ) {
        shipment.sentAt =
          shipment.sentAt || new Date();
      }

      if (mappedStatus === 'delivered') {
        shipment.deliveredAt =
          shipment.deliveredAt || new Date();
      }

      if (mappedStatus === 'returned') {
        shipment.returnedAt =
          shipment.returnedAt || new Date();
      }

      const statusDescription =
        trackingStatus?.status_details ||
        trackingStatus?.status ||
        'Tracking updated';

      const noteLine =
        `[SHIPPO:${mappedStatus}] ${statusDescription}`;

      shipment.note = shipment.note
        ? `${shipment.note}\n${noteLine}`
        : noteLine;

      await manager.save(
        OrderShipment,
        shipment,
      );

      await this.syncOrderStatusFromCourierStatus(
        manager,
        order,
        mappedStatus,
      );

      return {
        success: true,
        shipmentStatus: mappedStatus,
        orderStatus: order.status,
      };
    },
  );
}



async updateShipmentRate(
  shipmentId: string,
  rateId: string,
) {

  const shipment =
    await this.shipmentRepo.findOne({
      where:{
        id: shipmentId,
      },
      relations:{
        order:true,
      },
    });


  if (!shipment) {
    throw new NotFoundException(
      'Shipment not found',
    );
  }


  const availableRate =
    shipment.availableRates?.find(
      (rate:any)=>rate.id === rateId,
    );


  if (!availableRate) {
    throw new BadRequestException(
      'Selected rate not found',
    );
  }


  shipment.adminSelectedRateId = rateId;

  shipment.adminSelectedRate = availableRate;
shipment.processingStatus = 'idle';
shipment.errorMessage = undefined;

if (shipment.responsePayload?.labelError) {
  delete shipment.responsePayload.labelError;
}

  await this.shipmentRepo.save(shipment);



  const updatedOrder =
    await this.orderRepo.findOne({
      where:{
        id: shipment.orderId,
      },
      relations:{
        shipments:{
          courierProvider:true,
        },
      } as any,
    });


  return this.attachTrackingUrlsToOrder(
    updatedOrder,
  );
}
}