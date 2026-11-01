
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ConflictException,   NotFoundException, } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';

type MockFn = (...args: any[]) => any;

describe('ProductsService - Create Product', () => {
  let service: ProductsService;

  let repo: any;
  let catRepo: any;
  let mediaRepo: any;
  let variantRepo: any;
  let cloud: any;
  let orderItemRepo: any;
  let cartItemRepo: any;
  let cache: any;

  const category = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Electronics',
    parent: null,
  };

  const makeDto = (
    overrides: Partial<CreateProductDto> = {},
  ): CreateProductDto => ({
    name: 'Wireless Mouse',
    categoryId: category.id,
    price: 1200,
    stock: 10,
    ...overrides,
  });

  beforeEach(() => {
    repo = {
  create: jest.fn<MockFn>((data: any) => data),
  save: jest.fn<MockFn>(),
  findOne: jest.fn<MockFn>(),
  remove: jest.fn<MockFn>(),
  update: jest.fn<MockFn>(),
};

    catRepo = {
      findOne: jest.fn<MockFn>(),
    };

    mediaRepo = {
      findOne: jest.fn<MockFn>(),
    };

    variantRepo = {
      find: jest.fn<MockFn>(),
      save: jest.fn<MockFn>(),
      create: jest.fn<MockFn>(),
      remove: jest.fn<MockFn>(),
    };

    cloud = {
      deleteByPublicId: jest.fn<MockFn>(),
      uploadImage: jest.fn<MockFn>(),
    };

    orderItemRepo = {
      createQueryBuilder: jest.fn<MockFn>(),
    };

    cartItemRepo = {
      createQueryBuilder: jest.fn<MockFn>(),
    };

    cache = {
      get: jest.fn<MockFn>(),
      set: jest.fn<MockFn>().mockResolvedValue(undefined),
      clearPattern: jest.fn<MockFn>().mockResolvedValue(undefined),
    };

    service = new ProductsService(
      repo,
      catRepo,
      mediaRepo,
      variantRepo,
      cloud,
      orderItemRepo,
      cartItemRepo,
      cache,
    );

    catRepo.findOne.mockResolvedValue(category);

    repo.findOne.mockImplementation(async (options: any) => {
      if (options?.where?.slug) {
        return null;
      }

      if (options?.where?.id) {
        return {
          id: options.where.id,
          name: 'Wireless Mouse',
          slug: 'wireless-mouse',
          price: 1200,
          stock: 10,
          sku: 'PRD-TEST',
          isPublished: true,
          isFlashDeal: false,
          category,
          media: [],
          variants: [],
        };
      }

      return null;
    });

    repo.save.mockImplementation(async (product: any) => ({
      ...product,
      id: product.id ?? 'product-1',
    }));
  });

  it('should create a product successfully', async () => {
    const result = await service.create(makeDto());

    expect(result.id).toBe('product-1');
    expect(result.name).toBe('Wireless Mouse');
    expect(result.slug).toBe('wireless-mouse');
    expect(result.selling_price).toBe(1200);

    expect(repo.create).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
  });

  it('should reject an invalid category', async () => {
    catRepo.findOne.mockResolvedValue(null);

    await expect(service.create(makeDto())).rejects.toThrow(
      BadRequestException,
    );

    expect(repo.save).not.toHaveBeenCalled();
  });

  it('should generate a slug from the product name', async () => {
    await service.create(makeDto({ name: 'Gaming Keyboard Pro' }));

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'gaming-keyboard-pro',
      }),
    );
  });

  it('should generate a unique slug when the first slug exists', async () => {
    repo.findOne.mockImplementation(async (options: any) => {
      if (options?.where?.slug === 'wireless-mouse') {
        return { id: 'existing-product' };
      }

      if (options?.where?.slug) {
        return null;
      }

      return {
        id: 'product-1',
        name: 'Wireless Mouse',
        slug: 'wireless-mouse-2',
        price: 1200,
        stock: 10,
        category,
        media: [],
        variants: [],
      };
    });

    await service.create(makeDto());

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'wireless-mouse-2',
      }),
    );
  });

  it('should automatically generate a product SKU', async () => {
    await service.create(makeDto());

    const createdProduct = repo.create.mock.calls[0][0];

    expect(createdProduct.sku).toMatch(
      /^PRD-\d+-[A-F0-9]{6}$/,
    );
  });

  it('should use the first image as thumbnail', async () => {
    await service.create(
      makeDto({
        media: [
          {
            type: 'image',
            url: 'https://example.com/mouse.jpg',
            publicId: 'mouse-image',
          },
        ],
      }),
    );

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        media: [
          expect.objectContaining({
            type: 'image',
            url: 'https://example.com/mouse.jpg',
          }),
        ],
      }),
    );

    const savedProduct = repo.save.mock.calls[0][0];

    expect(savedProduct.thumbnailUrl).toBe(
      'https://example.com/mouse.jpg',
    );
  });

  it('should calculate total stock from variants', async () => {
    await service.create(
      makeDto({
        variants: [
          {
            options: { Color: 'Black' },
            stock: 5,
            extraPrice: 0,
          },
          {
            options: { Color: 'White' },
            stock: 8,
            extraPrice: 100,
          },
        ],
      }),
    );

    const savedProduct = repo.save.mock.calls[0][0];

    expect(savedProduct.hasVariants).toBe(true);
    expect(savedProduct.totalStock).toBe(13);
    expect(savedProduct.variants).toHaveLength(2);

    expect(savedProduct.variants[0].combinationKey).toBe(
      'Color:Black',
    );
  });

  it('should retry when a unique constraint error occurs', async () => {
    let attempts = 0;

    repo.save.mockImplementation(async (product: any) => {
      attempts++;

      if (attempts === 1) {
        throw { code: '23505' };
      }

      return {
        ...product,
        id: 'product-1',
      };
    });

    const result = await service.create(makeDto());

    expect(result.id).toBe('product-1');
    expect(repo.save).toHaveBeenCalledTimes(2);
  });

  it('should throw other database errors without retrying', async () => {
    repo.save.mockRejectedValue(new Error('Database unavailable'));

    await expect(service.create(makeDto())).rejects.toThrow(
      'Database unavailable',
    );

    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('should throw ConflictException after 10 failed SKU attempts', async () => {
    repo.save.mockRejectedValue({ code: '23505' });

    await expect(service.create(makeDto())).rejects.toThrow(
      ConflictException,
    );

    expect(repo.save).toHaveBeenCalledTimes(10);
  });

  it('should invalidate product caches after successful creation', async () => {
    await service.create(makeDto());

    expect(cache.clearPattern).toHaveBeenCalledWith('products:*');
    expect(cache.clearPattern).toHaveBeenCalledWith('product:*');
    expect(cache.clearPattern).toHaveBeenCalledWith('flash:*');

    expect(cache.set).toHaveBeenCalledWith(
      'products:version',
      expect.any(Number),
    );
  });
  // ============================================================
  // PHASE 2: DELETE, ARCHIVE & RESTORE TESTS
  // ============================================================

  function mockDeleteQueryBuilders(orderUsageCount = 0) {
    const cartQb = {
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
    execute: jest.fn<() => Promise<{ affected: number }>>()
  .mockResolvedValue({ affected: 2 }),
    };

    const orderQb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
    getCount: jest.fn<() => Promise<number>>()
  .mockResolvedValue(orderUsageCount),
    };

    cartItemRepo.createQueryBuilder.mockReturnValue(cartQb);
    orderItemRepo.createQueryBuilder.mockReturnValue(orderQb);

    return { cartQb, orderQb };
  }

  describe('deleteProduct', () => {
    it('should permanently delete product without order history', async () => {
      const product = {
        id: 'product-1',
        isPublished: true,
        media: [],
      };

      repo.findOne.mockResolvedValue(product);
      repo.remove.mockResolvedValue(product);

      mockDeleteQueryBuilders(0);

      const result = await service.deleteProduct('product-1');

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          action: 'deleted',
        }),
      );

      expect(repo.remove).toHaveBeenCalledWith(product);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should archive product when order history exists', async () => {
      const product = {
        id: 'product-1',
        isPublished: true,
        archivedAt: null,
        media: [],
      };

      repo.findOne.mockResolvedValue(product);
      repo.save.mockImplementation(async (p: any) => p);

      mockDeleteQueryBuilders(3);

      const result = await service.deleteProduct('product-1');

      expect(result.action).toBe('archived');
      expect(product.isPublished).toBe(false);
      expect(product.archivedAt).toBeInstanceOf(Date);

      expect(repo.save).toHaveBeenCalledWith(product);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('should clean cart items before checking order history', async () => {
      const product = {
        id: 'product-1',
        isPublished: true,
        media: [],
      };

      repo.findOne.mockResolvedValue(product);
      repo.remove.mockResolvedValue(product);

      const { cartQb } = mockDeleteQueryBuilders(0);

      await service.deleteProduct('product-1');

      expect(cartItemRepo.createQueryBuilder).toHaveBeenCalled();
      expect(cartQb.delete).toHaveBeenCalled();
      expect(cartQb.where).toHaveBeenCalledWith(
        '"productId" = :productId',
        { productId: 'product-1' },
      );
      expect(cartQb.execute).toHaveBeenCalled();
    });

    it('should delete Cloudinary images and videos before deleting product', async () => {
      const product = {
        id: 'product-1',
        isPublished: true,
        media: [
          {
            publicId: 'product-image',
            type: 'image',
          },
          {
            publicId: 'product-video',
            type: 'video',
          },
        ],
      };

      repo.findOne.mockResolvedValue(product);
      repo.remove.mockResolvedValue(product);

      mockDeleteQueryBuilders(0);

      await service.deleteProduct('product-1');

      expect(cloud.deleteByPublicId).toHaveBeenCalledWith(
        'product-image',
        'image',
      );

      expect(cloud.deleteByPublicId).toHaveBeenCalledWith(
        'product-video',
        'video',
      );

      expect(repo.remove).toHaveBeenCalledWith(product);
    });

    it('should invalidate product caches after permanent deletion', async () => {
      const product = {
        id: 'product-1',
        isPublished: true,
        media: [],
      };

      repo.findOne.mockResolvedValue(product);
      repo.remove.mockResolvedValue(product);

      mockDeleteQueryBuilders(0);

      await service.deleteProduct('product-1');

      expect(cache.clearPattern).toHaveBeenCalledWith('product:*');
      expect(cache.clearPattern).toHaveBeenCalledWith('products:*');
      expect(cache.clearPattern).toHaveBeenCalledWith('flash:*');

      expect(cache.set).toHaveBeenCalledWith(
        'products:version',
        expect.any(Number),
      );
    });

    it('should throw NotFoundException when product does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.deleteProduct('unknown-product'),
      ).rejects.toThrow(NotFoundException);

      expect(repo.remove).not.toHaveBeenCalled();
      expect(cartItemRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should propagate Cloudinary deletion errors', async () => {
      const product = {
        id: 'product-1',
        isPublished: true,
        media: [
          {
            publicId: 'product-image',
            type: 'image',
          },
        ],
      };

      repo.findOne.mockResolvedValue(product);

      mockDeleteQueryBuilders(0);

      cloud.deleteByPublicId.mockRejectedValue(
        new Error('Cloudinary unavailable'),
      );

      await expect(
        service.deleteProduct('product-1'),
      ).rejects.toThrow('Cloudinary unavailable');

      expect(repo.remove).not.toHaveBeenCalled();
    });
  });

  describe('archiveProduct', () => {
    it('should archive an active product', async () => {
      const product = {
        id: 'product-1',
        isPublished: true,
        archivedAt: null,
      };

      repo.findOne.mockResolvedValue(product);
      repo.save.mockImplementation(async (p: any) => p);

      const result = await service.archiveProduct('product-1');

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          action: 'archived',
          message: 'Product archived successfully.',
        }),
      );

      expect(product.isPublished).toBe(false);
      expect(product.archivedAt).toBeInstanceOf(Date);
      expect(repo.save).toHaveBeenCalledWith(product);
    });

    it('should not save an already archived product', async () => {
      const product = {
        id: 'product-1',
        isPublished: false,
        archivedAt: new Date(),
      };

      repo.findOne.mockResolvedValue(product);

      const result = await service.archiveProduct('product-1');

      expect(result.action).toBe('archived');
      expect(result.message).toBe('Product is already archived.');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when archiving unknown product', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.archiveProduct('unknown-product'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('restoreProduct', () => {
    it('should restore an archived product', async () => {
      const product = {
        id: 'product-1',
        isPublished: false,
        archivedAt: new Date(),
      };

      repo.findOne.mockResolvedValue(product);
      repo.save.mockImplementation(async (p: any) => p);

      const result = await service.restoreProduct('product-1');

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          action: 'restored',
          message: 'Product restored and published successfully.',
        }),
      );

      expect(product.isPublished).toBe(true);
      expect(product.archivedAt).toBeNull();

      expect(repo.save).toHaveBeenCalledWith(product);
    });

    it('should not save an already published product', async () => {
      const product = {
        id: 'product-1',
        isPublished: true,
        archivedAt: null,
      };

      repo.findOne.mockResolvedValue(product);

      const result = await service.restoreProduct('product-1');

      expect(result.action).toBe('restored');
      expect(result.message).toBe('Product is already published.');

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should invalidate caches after restoring a product', async () => {
      const product = {
        id: 'product-1',
        isPublished: false,
        archivedAt: new Date(),
      };

      repo.findOne.mockResolvedValue(product);
      repo.save.mockImplementation(async (p: any) => p);

      await service.restoreProduct('product-1');

      expect(cache.clearPattern).toHaveBeenCalledWith('products:*');
      expect(cache.clearPattern).toHaveBeenCalledWith('product:*');
      expect(cache.clearPattern).toHaveBeenCalledWith('flash:*');

      expect(cache.set).toHaveBeenCalledWith(
        'products:version',
        expect.any(Number),
      );
    });

    it('should throw NotFoundException when restoring unknown product', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.restoreProduct('unknown-product'),
      ).rejects.toThrow(NotFoundException);

      expect(repo.save).not.toHaveBeenCalled();
    });
  });

});
