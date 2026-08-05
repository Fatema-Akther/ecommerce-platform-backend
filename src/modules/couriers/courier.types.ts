export const COURIER_MODES = ['manual', 'api'] as const;

export type CourierMode = (typeof COURIER_MODES)[number];

export const COURIER_SHIPMENT_STATUSES = [
  'not_assigned',
  'ready_to_ship',
  'assigned_to_courier',
  'picked_up',
  'in_transit',
  'delivered',
  'returned',
  'cancelled',
] as const;

export type CourierShipmentStatus =
  (typeof COURIER_SHIPMENT_STATUSES)[number];