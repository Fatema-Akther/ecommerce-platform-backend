
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { OrdersService } from './orders.service';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Product } from '../products/product.entity';
import { ProductVariant } from '../products/product-variant.entity';

type MockFn = (...args: any[]) => any;

describe('OrdersService', () => {
  let service: OrdersService;

  let orderRepo: any;
  let itemRepo: any;
  let cartRepo: any;
  let cartItemRepo: any;
  let paymentRepo: any;
  let variantRepo: any;
  let dataSource: any;
  let manager: any;
  let couriersService: any;

  const admin: any = {
    id: 'admin-1',
    role: 'admin',
  };

  const customer: any = {
    id: 'user-1',
    role: 'user',
  };

  const makeOrder = (overrides: any = {}) => ({
    id: 'order-1',
    user: customer,
    status: 'processing',
    paymentMethod: 'cod',
    items: [],
    adminReviewNote: undefined,
    fraudFlag: false,
    reviewStatus: 'clear',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    orderRepo = {
      find: jest.fn<MockFn>(),
      findOne: jest.fn<MockFn>(),
      create: jest.fn<MockFn>(),
      save: jest.fn<MockFn>(),
      count: jest.fn<MockFn>(),
      createQueryBuilder: jest.fn<MockFn>(),
    };

    itemRepo = {
      create: jest.fn<MockFn>(),
      save: jest.fn<MockFn>(),
    };

    cartRepo = {
      findOne: jest.fn<MockFn>(),
    };

    cartItemRepo = {
      delete: jest.fn<MockFn>(),
    };

    paymentRepo = {};

    variantRepo = {};

    manager = {
      findOne: jest.fn<MockFn>(),
      save: jest.fn<MockFn>(),
      create: jest.fn<MockFn>(),
      delete: jest.fn<MockFn>(),
      count: jest.fn<MockFn>(),
      getRepository: jest.fn<MockFn>(),
    };

    dataSource = {
      transaction: jest.fn<MockFn>(
        async (callback: MockFn) => callback(manager),
      ),
    };

    couriersService = {
      assignShipment: jest.fn<MockFn>(),
    };

    service = new OrdersService(
      orderRepo,
      itemRepo,
      cartRepo,
      cartItemRepo,
      paymentRepo,
      variantRepo,
      dataSource,
      couriersService,
    );
  });

  // ==========================================
  // AUTHORIZATION
  // ==========================================

  describe('Admin authorization', () => {
    it('should reject non-admin when updating order status', async () => {
      await expect(
        service.updateOrderStatus(customer, 'order-1', {
          status: 'shipped',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('should reject non-admin when reviewing an order', async () => {
      await expect(
        service.reviewOrder(customer, 'order-1', {
          action: 'approve',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // ORDER STATUS
  // ==========================================

  describe('updateOrderStatus', () => {
    it('should update processing order to shipped', async () => {
      const order = makeOrder({
        status: 'processing',
      });

      const updatedOrder = makeOrder({
        status: 'shipped',
      });

      manager.findOne
        .mockResolvedValueOnce(order)
        .mockResolvedValueOnce(updatedOrder);

      manager.save.mockResolvedValue(order);

      const result = await service.updateOrderStatus(
        admin,
        'order-1',
        { status: 'shipped' },
      );

     expect(order.status).toBe('shipped');
expect(manager.save).toHaveBeenCalledWith(Order, order);

if (!result) {
  throw new Error('Expected updated order to be returned');
}

expect(result.status).toBe('shipped');
    });

    it('should reject an invalid status transition', async () => {
      const order = makeOrder({
        status: 'awaiting_payment',
      });

      manager.findOne.mockResolvedValue(order);

      await expect(
        service.updateOrderStatus(admin, 'order-1', {
          status: 'processing',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(manager.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for unknown order', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(
        service.updateOrderStatus(admin, 'unknown-order', {
          status: 'shipped',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(manager.save).not.toHaveBeenCalled();
    });

    it('should reject refund for returned COD order', async () => {
      const order = makeOrder({
        status: 'returned',
        paymentMethod: 'cod',
      });

      manager.findOne.mockResolvedValue(order);

      await expect(
        service.updateOrderStatus(admin, 'order-1', {
          status: 'refunded',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(manager.save).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // STOCK RESTORATION
  // ==========================================

  describe('restoreStockForRefundedOrder', () => {
    it('should restore product stock', async () => {
      const product = {
        id: 'product-1',
        stock: 5,
      };

      const order = makeOrder({
        items: [
          {
            productId: 'product-1',
            quantity: 3,
          },
        ],
      });

      manager.findOne.mockResolvedValue(product);

      await service.restoreStockForRefundedOrder(
        manager,
        order,
      );

      expect(product.stock).toBe(8);

      expect(manager.save).toHaveBeenCalledWith(
        Product,
        product,
      );
    });

    it('should restore variant stock', async () => {
      const variant = {
        id: 'variant-1',
        stock: 10,
      };

      const order = makeOrder({
        items: [
          {
            variantId: 'variant-1',
            quantity: 4,
          },
        ],
      });

      manager.findOne.mockResolvedValue(variant);

      await service.restoreStockForRefundedOrder(
        manager,
        order,
      );

      expect(variant.stock).toBe(14);

      expect(manager.save).toHaveBeenCalledWith(
        ProductVariant,
        variant,
      );
    });

    it('should not restore stock for empty order items', async () => {
      const order = makeOrder({
        items: [],
      });

      await service.restoreStockForRefundedOrder(
        manager,
        order,
      );

      expect(manager.findOne).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('should ignore items with zero or negative quantity', async () => {
      const order = makeOrder({
        items: [
          {
            productId: 'product-1',
            quantity: 0,
          },
          {
            productId: 'product-2',
            quantity: -2,
          },
        ],
      });

      await service.restoreStockForRefundedOrder(
        manager,
        order,
      );

      expect(manager.findOne).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('should throw when product does not exist', async () => {
      const order = makeOrder({
        items: [
          {
            productId: 'missing-product',
            quantity: 2,
          },
        ],
      });

      manager.findOne.mockResolvedValue(null);

      await expect(
        service.restoreStockForRefundedOrder(
          manager,
          order,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================
  // ORDER REVIEW
  // ==========================================

  describe('reviewOrder', () => {
    function setupReviewQuery(order: any) {
      const queryBuilder = {
        where: jest.fn<MockFn>().mockReturnThis(),
        setLock: jest.fn<MockFn>().mockReturnThis(),
        getOne: jest.fn<MockFn>().mockResolvedValue(order),
      };

      const orderRepository = {
        createQueryBuilder: jest.fn<MockFn>(
          () => queryBuilder,
        ),
      };

      manager.getRepository.mockImplementation(
        (entity: any) => {
          if (entity === Order) {
            return orderRepository;
          }

          return {
            find: jest.fn<MockFn>().mockResolvedValue([]),
          };
        },
      );

      return queryBuilder;
    }

    it('should approve a pending verification COD order', async () => {
      const order = makeOrder({
        status: 'pending_verification',
        paymentMethod: 'cod',
        fraudFlag: true,
        reviewStatus: 'blocked',
      });

      const updatedOrder = makeOrder({
        status: 'processing',
        fraudFlag: false,
        reviewStatus: 'verified',
      });

      const qb = setupReviewQuery(order);

      manager.save.mockResolvedValue(order);
      manager.findOne.mockResolvedValue(updatedOrder);

      const result = await service.reviewOrder(
        admin,
        'order-1',
        {
          action: 'approve',
          note: 'Verified by admin',
        },
      );

      expect(qb.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
      );

      expect(order.status).toBe('processing');
      expect(order.fraudFlag).toBe(false);
      expect(order.reviewStatus).toBe('verified');

      expect(order.adminReviewNote).toBe(
        'Verified by admin',
      );

      expect(manager.save).toHaveBeenCalledWith(
        Order,
        order,
      );

if (!result) {
  throw new Error('Expected reviewed order to be returned');
}

expect(result.status).toBe('processing');
    });

    it('should approve a pending verification Stripe order', async () => {
      const order = makeOrder({
        status: 'pending_verification',
        paymentMethod: 'stripe',
      });

      const updatedOrder = makeOrder({
        status: 'awaiting_payment',
      });

      setupReviewQuery(order);

      manager.save.mockResolvedValue(order);
      manager.findOne.mockResolvedValue(updatedOrder);

      const result = await service.reviewOrder(
        admin,
        'order-1',
        { action: 'approve' },
      );

      expect(order.status).toBe('awaiting_payment');
   if (!result) {
  throw new Error('Expected reviewed order to be returned');
}

expect(result.status).toBe('awaiting_payment');
    });

    it('should reject an order that is not pending verification', async () => {
      const order = makeOrder({
        status: 'processing',
      });

      setupReviewQuery(order);

      await expect(
        service.reviewOrder(admin, 'order-1', {
          action: 'approve',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(manager.save).not.toHaveBeenCalled();
    });

    it('should throw when order does not exist', async () => {
      setupReviewQuery(null);

      await expect(
        service.reviewOrder(admin, 'missing-order', {
          action: 'approve',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(manager.save).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // CUSTOMER ORDER ACCESS
  // ==========================================

  describe('getOneForUser', () => {
    it('should return an order belonging to the user', async () => {
      const order = makeOrder({
        shipments: [],
      });

      orderRepo.findOne.mockResolvedValue(order);

      const result = await service.getOneForUser(
        customer,
        'order-1',
      );

      expect(orderRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'order-1',
            user: { id: 'user-1' },
          },
        }),
      );

      expect(result).toBe(order);
    });

    it('should reject access to another user order', async () => {
      orderRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getOneForUser(customer, 'another-order'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================
  // ADMIN ORDER ACCESS
  // ==========================================

  describe('getOneForAdmin', () => {
    it('should return an existing order', async () => {
      const order = makeOrder({
        shipments: [],
      });

      orderRepo.findOne.mockResolvedValue(order);

      const result = await service.getOneForAdmin(
        'order-1',
      );

      expect(result).toBe(order);
    });

    it('should throw when order does not exist', async () => {
      orderRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getOneForAdmin('missing-order'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
