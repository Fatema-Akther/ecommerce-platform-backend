import { OrderShipment } from '../order-shipment.entity';


export function resolveTrackingUrl(
  shipment: OrderShipment,
): string | undefined {

  const payload: any =
    shipment.responsePayload || {};


  /**
   * 1. Provider generated tracking URL
   * Highest priority
   */
  const directUrls = [
    payload?.label?.trackingUrl,
    payload?.label?.rawResponse?.tracking_url_provider,
    payload?.trackingUrl,
    payload?.shipment?.tracking_url_provider,
    payload?.consignment?.tracking_link,
  ];


  const directUrl =
    directUrls.find(
      (url) => !!url,
    );


  if (directUrl) {
    return directUrl;
  }


  /**
   * 2. Fallback pattern
   * USPS / UPS / FedEx etc.
   */
  const pattern =
    shipment.courierProvider
      ?.trackingUrlPattern;


  const trackingNumber =
    shipment.trackingNumber;


  if (
    !pattern ||
    !trackingNumber
  ) {
    return undefined;
  }


  const encoded =
    encodeURIComponent(
      trackingNumber,
    );


  return pattern
    .replace(
      /\{tracking_number\}/g,
      encoded,
    )
    .replace(
      /\{trackingNumber\}/g,
      encoded,
    );
}