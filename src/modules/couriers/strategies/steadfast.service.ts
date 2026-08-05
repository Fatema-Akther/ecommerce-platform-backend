
// import { Injectable, BadRequestException } from '@nestjs/common';
// import { CourierStrategy } from './courier.strategy';
// import {  resolveCourierSecretConfig } from '../utils/courier-config.util';
// import { CourierProvider } from '../courier-provider.entity';
// import { Order } from 'src/modules/orders/order.entity';

// @Injectable()
// export class SteadfastService implements CourierStrategy {
//   private getCodAmount(order: Order) {
//     const paymentProvider = String((order as any).paymentProvider || '').toLowerCase();
//     const paymentRef = String((order as any).paymentRef || '').trim();

//     const prepaidProviders = ['bkash_manual', 'bkash_mock', 'bkash_real'];

//     const isPrepaidPaid =
//       prepaidProviders.includes(paymentProvider) && !!paymentRef;

//     return isPrepaidPaid ? 0 : Number(order.total || 0);
//   }

//   async createShipment(
//     order: Order,
//     provider: CourierProvider,
//     options?: { pickupAddress?: string },
//   ) {
//     if (!provider.apiConfig?.keyRef) {
//       throw new BadRequestException('Missing API config');
//     }

//    const config = resolveCourierSecretConfig(provider.apiConfig.keyRef);

//     const codAmount = this.getCodAmount(order);


//     const pickupAddress =
//   options?.pickupAddress?.trim() || process.env.BUSINESS_ADDRESS?.trim();

// if (!pickupAddress) {
//   throw new BadRequestException("Pickup address is required");
// }

//     const payload = {
//   invoice: `ORD-${order.id}`,
//   reference_id: order.id,
//   recipient_name: order.delivery.fullName,
//   recipient_phone: order.delivery.phone,
//   recipient_address: `${order.delivery.address}, ${order.delivery.area}, ${order.delivery.district}`,
//   pickup_address: pickupAddress,
//   cod_amount: codAmount,
//   note: order.delivery.note || '',
// };





//     const res = await fetch(`${config.baseUrl}/create_order`, {
//       method: 'POST',
//       headers: {
//         'Api-Key': config.apiKey,
//         'Secret-Key': config.secretKey,
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify(payload),
//     });

//     if (!res.ok) {
//   const errorText = await res.text();

//   throw new BadRequestException(
//     `Steadfast API error: ${res.status} - ${errorText}`,
//   );
// }

//     const data = await res.json();



//     if (data.status !== 200) {
//       throw new BadRequestException(JSON.stringify(data));
//     }

//     return {
//       trackingNumber: data.consignment.tracking_code,
//       consignmentId: String(data.consignment.consignment_id),
//       rawResponse: data,
//     };
//   }
// }