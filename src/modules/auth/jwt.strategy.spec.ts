
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { JwtStrategy } from './jwt.strategy';
import {
  beforeEach,
  describe,
  it,
  expect,
  jest,
} from '@jest/globals';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const mockUsersService = {
    findById: jest.fn<(id: string) => Promise<any>>(),
  };

  const mockConfigService = {
    get: jest.fn<(key: string) => string | undefined>(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfigService.get.mockReturnValue('test-jwt-secret');

    strategy = new JwtStrategy(
      mockConfigService as unknown as ConfigService,
      mockUsersService as unknown as UsersService,
    );
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should load JWT secret from config', () => {
    expect(mockConfigService.get).toHaveBeenCalledWith(
      'JWT_SECRET',
    );
  });

  it('should validate a user with valid payload', async () => {
    const user = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'customer',
    };

    mockUsersService.findById.mockResolvedValue(user);

    const result = await strategy.validate({
      sub: 'user-123',
    });

    expect(mockUsersService.findById).toHaveBeenCalledWith(
      'user-123',
    );

    expect(result).toEqual(user);
  });

  it('should reject token when user does not exist', async () => {
    mockUsersService.findById.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'invalid-user' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject token with invalid user ID', async () => {
    mockUsersService.findById.mockResolvedValue(undefined);

    await expect(
      strategy.validate({ sub: 'unknown-user' }),
    ).rejects.toThrow('Invalid token');
  });
});
