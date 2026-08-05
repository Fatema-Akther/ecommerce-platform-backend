import { OrderShipment } from '../order-shipment.entity';

export interface CourierStrategy {

createShipment(
  order: any,
  provider: any,
  options?: { pickupAddress?: string }
): Promise<{
  trackingNumber?: string;
  consignmentId?: string;
  trackingUrl?: string;
  rates?: any[];
  rawResponse?: any;
}>;


 createLabel(
  shipment: OrderShipment,
  rateId: string,
): Promise<{
  trackingNumber?: string;
  labelUrl?: string;
  trackingUrl?: string;
  transactionId?: string;
  rawResponse?: any;
}>;



getShippingRates(
  orderData: any,
  provider: any,
): Promise<{
  rates: any[];
  rawResponse?: any;
  address_from?: any;
  address_to?: any;
}>;

}