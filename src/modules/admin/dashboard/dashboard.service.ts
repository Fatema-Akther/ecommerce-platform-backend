




import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderShipment } from 'src/modules/couriers/order-shipment.entity';
import { Order } from 'src/modules/orders/order.entity';
import { Product } from 'src/modules/products/product.entity';
import { User } from 'src/modules/users/user.entity';
import { Repository, Between, In } from 'typeorm';

const SUCCESSFUL_ORDER_STATUSES = ['delivered', 'completed'] as const;

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sept',
  'Oct',
  'Nov',
  'Dec',
];

type ShipmentPeriod = 'today' | 'month' | 'all';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(Product)
    private productRepo: Repository<Product>,

    @InjectRepository(OrderShipment)
    private shipmentRepo: Repository<OrderShipment>,
  ) {}

  private toNumber(value: unknown) {
    const num = Number(value || 0);
    return Number.isFinite(num) ? num : 0;
  }

  private normalizeShipmentPeriod(period?: string): ShipmentPeriod {
    if (period === 'today' || period === 'month' || period === 'all') {
      return period;
    }

    return 'month';
  }

  private getShipmentDateRange(period: ShipmentPeriod) {
    if (period === 'all') {
      return null;
    }

    const start = new Date();

    if (period === 'today') {
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      return { start, end };
    }

    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    return { start, end };
  }

  async getSummary(shipmentPeriodInput?: string) {
    const currentYear = new Date().getFullYear();

    const shipmentPeriod = this.normalizeShipmentPeriod(shipmentPeriodInput);
    const shipmentRange = this.getShipmentDateRange(shipmentPeriod);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [
      totalSalesRaw,
      totalCustomers,
      totalProducts,
      totalOrders,
      shipmentRows,
      monthlyRows,
      recentOrders,
      successfulOrdersForCategory,
    ] = await Promise.all([
      this.orderRepo
        .createQueryBuilder('o')
        .select('COALESCE(SUM(o.total), 0)', 'total')
        .where('o.status IN (:...statuses)', {
          statuses: SUCCESSFUL_ORDER_STATUSES,
        })
        .getRawOne<{ total: string }>(),

      this.userRepo.count({
        where: { role: 'user' as any },
      }),

      this.productRepo.count(),

      this.orderRepo.count(),

      (() => {
        const qb = this.shipmentRepo
          .createQueryBuilder('s')
          .select('s.courierStatus', 'status')
          .addSelect('COUNT(*)', 'count');

        if (shipmentRange) {
          qb.where('s."createdAt" >= :start', {
            start: shipmentRange.start,
          }).andWhere('s."createdAt" < :end', {
            end: shipmentRange.end,
          });
        }

        return qb
          .groupBy('s.courierStatus')
          .getRawMany<{ status: string; count: string }>();
      })(),

      this.orderRepo
        .createQueryBuilder('o')
        .select('EXTRACT(MONTH FROM "o"."createdAt")', 'month')
        .addSelect('COALESCE(SUM(o.total), 0)', 'total')
        .where('o.status IN (:...statuses)', {
          statuses: SUCCESSFUL_ORDER_STATUSES,
        })
        .andWhere('EXTRACT(YEAR FROM "o"."createdAt") = :year', {
          year: currentYear,
        })
        .groupBy('EXTRACT(MONTH FROM "o"."createdAt")')
        .orderBy('EXTRACT(MONTH FROM "o"."createdAt")', 'ASC')
        .getRawMany<{ month: string; total: string }>(),

      this.orderRepo.find({
        where: {
          createdAt: Between(todayStart, todayEnd),
        },
        relations: {
          items: { product: true },
          user: true,
          shipments: { courierProvider: true },
        } as any,
        order: { createdAt: 'DESC' },
        take: 10,
      }),

      this.orderRepo.find({
        where: {
          status: In([...SUCCESSFUL_ORDER_STATUSES]),
        } as any,
        relations: {
          items: {
            product: {
              category: true,
            },
          },
        } as any,
      }),
    ]);

    const shipmentStatus = {
      delivered: 0,
      onDelivery: 0,
      returned: 0,
      cancelled: 0,
      readyToShip: 0,
      assigned: 0,
    };

    for (const row of shipmentRows) {
      const status = row.status;
      const count = this.toNumber(row.count);

      if (status === 'delivered') {
        shipmentStatus.delivered += count;
      } else if (status === 'picked_up' || status === 'in_transit') {
        shipmentStatus.onDelivery += count;
      } else if (status === 'returned') {
        shipmentStatus.returned += count;
      } else if (status === 'cancelled') {
        shipmentStatus.cancelled += count;
      } else if (status === 'ready_to_ship') {
        shipmentStatus.readyToShip += count;
      } else if (status === 'assigned_to_courier') {
        shipmentStatus.assigned += count;
      }
    }

    const monthlySales = MONTHS.map((month, index) => {
      const found = monthlyRows.find(
        (row) => Number(row.month) === index + 1,
      );

      return {
        month,
        total: this.toNumber(found?.total),
      };
    });

    const mappedRecentOrders = recentOrders.map((order) => {
      const firstItem = order.items?.[0];

      const itemCount =
        order.items?.reduce(
          (sum, item) => sum + this.toNumber((item as any).quantity),
          0,
        ) || 0;

      return {
        id: order.id,
        customerName: order.delivery?.fullName || order.user?.fullName || 'N/A',
        customerPhone: order.delivery?.phone || '',
        productName:
          (firstItem as any)?.nameSnapshot ||
          (firstItem as any)?.product?.name ||
          'Product',
        itemCount,
        total: this.toNumber(order.total),
        status: order.status,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        courierStatus: order.shipments?.[0]?.courierStatus || 'not_assigned',
        courierName: order.shipments?.[0]?.courierProvider?.name || null,
      };
    });

    const categorySalesMap = new Map<string, number>();


    const productSalesMap = new Map<
  string,
  {
    productId: string;
    name: string;
    quantitySold: number;
    amount: number;
  }
>();

   for (const order of successfulOrdersForCategory) {
  for (const item of order.items || []) {
    const anyItem = item as any;
    const product = anyItem.product as any;

    const productId = product?.id || anyItem.productId || anyItem.id;
    const productName =
      anyItem.nameSnapshot || product?.name || 'Unknown Product';

    const categoryName = product?.category?.name || 'Uncategorized';

    const quantity = this.toNumber(anyItem.quantity || 1);
    const unitPrice = this.toNumber(anyItem.price || 0);
    const lineTotal = this.toNumber(anyItem.lineTotal || unitPrice * quantity);

    categorySalesMap.set(
      categoryName,
      (categorySalesMap.get(categoryName) || 0) + lineTotal,
    );

    const existingProduct = productSalesMap.get(productId);

    productSalesMap.set(productId, {
      productId,
      name: productName,
      quantitySold: (existingProduct?.quantitySold || 0) + quantity,
      amount: (existingProduct?.amount || 0) + lineTotal,
    });
  }
}


    const totalCategorySales = Array.from(categorySalesMap.values()).reduce(
      (sum, value) => sum + value,
      0,
    );

    const categorySales = Array.from(categorySalesMap.entries())
      .map(([name, amount]) => ({
        name,
        amount: this.toNumber(amount),
        percent:
          totalCategorySales > 0
            ? Number(
                ((this.toNumber(amount) / totalCategorySales) * 100).toFixed(1),
              )
            : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);


const totalProductQuantity = Array.from(productSalesMap.values()).reduce(
  (sum, item) => sum + item.quantitySold,
  0,
);

const productSales = Array.from(productSalesMap.values())
  .map((item) => ({
    productId: item.productId,
    name: item.name,
    quantitySold: item.quantitySold,
    amount: this.toNumber(item.amount),
    percent:
      totalProductQuantity > 0
        ? Number(((item.quantitySold / totalProductQuantity) * 100).toFixed(1))
        : 0,
  }))
  .sort((a, b) => b.quantitySold - a.quantitySold)
  .slice(0, 5);






    return {
      totalSales: this.toNumber(totalSalesRaw?.total),
      totalCustomers,
      totalProducts,
      totalOrders,
      shipmentPeriod,
      shipmentStatus,
      monthlySales,
      recentOrders: mappedRecentOrders,
        categorySales,
      productSales,
};
  }
}