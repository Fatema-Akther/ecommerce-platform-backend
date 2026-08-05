import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CourierFactory } from '../strategies/courier.factory';
import { Order } from '../../orders/order.entity';
import { OrderShipment } from '../order-shipment.entity';
import { CourierProvider } from '../courier-provider.entity';
import { FailedJob } from './failed-job.entity';

@Processor('shipment')
@Injectable()
export class ShipmentProcessor extends WorkerHost {
  private readonly logger = new Logger(ShipmentProcessor.name);

  constructor(
    private dataSource: DataSource,
    private courierFactory: CourierFactory,
  ) {
    super();
  }

  async process(job: Job) {
    if (job.name !== 'create-shipment') return;

    const { orderId, providerId } = job.data;

    this.logger.log(`Processing shipment job: ${orderId}`);

    try {
      await this.dataSource.transaction(async (manager) => {
        // -------------------------
        // LOAD DATA
        // -------------------------
       const order = await manager.findOne(Order, {
  where: { id: orderId },
  relations: {
    items: true, // optional but useful
  } as any,
});

        const provider = await manager.findOne(CourierProvider, {
          where: { id: providerId },
        });

        if (!order || !provider) {
          throw new Error('Invalid order/provider');
        }

        // -------------------------
        // EXISTING SHIPMENT CHECK (IDEMPOTENCY)
        let shipment = await manager.findOne(OrderShipment, {
  where: { orderId: order.id },
});

// already created → stop
if (shipment?.consignmentId) {
  return;
}

// -------------------------
// 🔐 PRE-SAVE (CRITICAL)
// -------------------------
shipment =
  shipment ||
  manager.create(OrderShipment, {
    order,
    orderId: order.id,
  });

shipment.courierProvider = provider;
shipment.courierProviderId = provider.id;
shipment.courierStatus = 'ready_to_ship';
shipment.processingStatus = 'processing'; // ✅ ADD THIS
shipment.note = '[PROCESSING] Creating via API';

await manager.save(OrderShipment, shipment);

// -------------------------
// 🚀 API CALL
// -------------------------
const strategy = this.courierFactory.get(provider.code);
const result = await strategy.createShipment(order, provider);

// -------------------------
// ✅ FINAL UPDATE
// -------------------------
shipment.trackingNumber = result.trackingNumber;
shipment.consignmentId = result.consignmentId;
shipment.courierStatus = 'assigned_to_courier';
shipment.processingStatus = 'idle'; // ✅ SUCCESS → done
shipment.responsePayload = result.rawResponse;
shipment.sentAt = new Date();
shipment.errorMessage = undefined;

await manager.save(OrderShipment, shipment);


        // UPDATE ORDER STATUS
// -------------------------
if (order.status === 'processing') {
  order.status = 'shipped';
  await manager.save(Order, order);
}

        this.logger.log(`Shipment created: ${shipment.id}`);
      });
    } catch (error) {
      let message = 'Unknown error';
      let stack: string | undefined;

      if (error instanceof Error) {
        message = error.message;
        stack = error.stack;
      }

      this.logger.error(`Shipment job failed for order ${orderId}`, stack);

      // -------------------------
      // REDIS UNAVAILABLE FALLBACK
      try {
       await this.dataSource.transaction(async (manager) => {
  const jobSaved = await manager.save(FailedJob, {
    type: 'shipment',
    payload: job.data,
    // ✅ convert error to string
    error: error instanceof Error ? error.message : String(error),
  });
  this.logger.warn('Redis unavailable or job failed, saved to DB as fallback', jobSaved);
});
      } catch (dbError) {
        this.logger.error(
          'Failed to save job to DB as fallback',
          dbError instanceof Error ? dbError.stack : dbError,
        );
      }

      // Only throw if Redis exists to allow BullMQ retry
      if (process.env.REDIS_HOST) throw error;
    }
  }
}