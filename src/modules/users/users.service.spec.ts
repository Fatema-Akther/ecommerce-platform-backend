
import { BadRequestException } from '@nestjs/common';
import {
  beforeEach,
  describe,
  it,
  expect,
  jest,
} from '@jest/globals';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { UsersService } from './users.service';
import { User } from './user.entity';

describe('UsersService', () => {
  let service: UsersService;

  const mockRepo = {
    findOne: jest.fn<(...args: any[]) => Promise<any>>(),
    create: jest.fn<(...args: any[]) => any>(),
    save: jest.fn<(...args: any[]) => Promise<any>>(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    mockRepo.create.mockImplementation((data) => data);
    mockRepo.save.mockImplementation(async (user) => user);

    service = new UsersService(
      mockRepo as unknown as Repository<User>,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEmail', () => {
    it('should find user by lowercase email', async () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
      };

      mockRepo.findOne.mockResolvedValue(user);

      const result = await service.findByEmail(
        'TEST@EXAMPLE.COM',
      );

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });

      expect(result).toEqual(user);
    });

    it('should return null when email does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findByEmail('missing@example.com'),
      ).resolves.toBeNull();
    });
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      const user = { id: 'user-1' };

      mockRepo.findOne.mockResolvedValue(user);

      await expect(
        service.findById('user-1'),
      ).resolves.toEqual(user);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('should return null when user does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findById('unknown-id'),
      ).resolves.toBeNull();
    });
  });

  describe('createUser', () => {
    const input = {
      email: 'TEST@EXAMPLE.COM',
      passwordHash: 'hashed-password',
      fullName: 'Test User',
    };

    it('should create user with default role', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.createUser(input);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          role: 'user',
          isEmailVerified: false,
          fullName: 'Test User',
        }),
      );

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(result.email).toBe('test@example.com');
    });

    it('should create user with custom role', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await service.createUser({
        ...input,
        role: 'admin',
        isEmailVerified: true,
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'admin',
          isEmailVerified: true,
        }),
      );
    });

    it('should reject duplicate email', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'existing-user',
      });

      await expect(
        service.createUser(input),
      ).rejects.toThrow(
        new BadRequestException('Email already in use'),
      );

      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should save optional user fields', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const expiresAt = new Date('2026-12-01');

      await service.createUser({
        ...input,
        phone: '01700000000',
        emailOtp: '123456',
        emailOtpExpiresAt: expiresAt,
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '01700000000',
          emailOtp: '123456',
          emailOtpExpiresAt: expiresAt,
        }),
      );
    });
  });

  describe('save', () => {
    it('should save an existing user', async () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
      } as User;

      await service.save(user);

      expect(mockRepo.save).toHaveBeenCalledWith(user);
    });
  });

  describe('findByVerificationToken', () => {
    it('should find user by verification token', async () => {
      const user = { id: 'user-1' };

      mockRepo.findOne.mockResolvedValue(user);

      const result = await service.findByVerificationToken(
        'verification-token',
      );

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: {
          emailVerificationToken: 'verification-token',
        },
      });

      expect(result).toEqual(user);
    });

    it('should return null for unknown token', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findByVerificationToken('invalid-token'),
      ).resolves.toBeNull();
    });
  });

  describe('updateAdminEmailAndPassword', () => {
    it('should update email and hash new password', async () => {
      const user = {
        id: 'admin-1',
        email: 'old@example.com',
        passwordHash: 'old-hash',
      };

      mockRepo.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(null);

      const result = await service.updateAdminEmailAndPassword(
        'admin-1',
        'new@example.com',
        'NewPassword123!',
      );

      expect(mockRepo.findOne).toHaveBeenNthCalledWith(
        1,
        { where: { id: 'admin-1' } },
      );

      expect(mockRepo.findOne).toHaveBeenNthCalledWith(
        2,
        { where: { email: 'new@example.com' } },
      );

      expect(user.email).toBe('new@example.com');

      expect(user.passwordHash).not.toBe('NewPassword123!');

      expect(
        await bcrypt.compare(
          'NewPassword123!',
          user.passwordHash,
        ),
      ).toBe(true);

      expect(mockRepo.save).toHaveBeenCalledWith(user);

      expect(result).toEqual({
        message:
          'Admin email and password updated successfully',
      });
    });

    it('should reject unknown user', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateAdminEmailAndPassword(
          'unknown-id',
          'new@example.com',
          'Password123!',
        ),
      ).rejects.toThrow('User not found');

      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should reject duplicate email', async () => {
      const user = {
        id: 'admin-1',
        email: 'old@example.com',
      };

      mockRepo.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce({
          id: 'another-user',
          email: 'new@example.com',
        });

      await expect(
        service.updateAdminEmailAndPassword(
          'admin-1',
          'new@example.com',
          'Password123!',
        ),
      ).rejects.toThrow('Email already in use');

      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });
});
