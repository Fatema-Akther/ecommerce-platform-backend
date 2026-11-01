
import {
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  beforeEach,
  describe,
  it,
  expect,
  jest,
} from '@jest/globals';

import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;

  const mockReflector = {
    getAllAndOverride:
      jest.fn<(...args: any[]) => string[] | undefined>(),
  };

  
const createContext = (user?: any): ExecutionContext =>
  ({
    getHandler: () => function handler() {},
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as unknown as ExecutionContext;


  beforeEach(() => {
    jest.clearAllMocks();

    mockReflector.getAllAndOverride.mockReturnValue(undefined);

    guard = new RolesGuard(
      mockReflector as unknown as Reflector,
    );
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access when no roles are required', () => {
    mockReflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext())).toBe(true);

    expect(
      mockReflector.getAllAndOverride,
    ).toHaveBeenCalledWith(
      ROLES_KEY,
      expect.any(Array),
    );
  });

  it('should allow access when roles array is empty', () => {
    mockReflector.getAllAndOverride.mockReturnValue([]);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('should allow users with required role', () => {
    mockReflector.getAllAndOverride.mockReturnValue(['admin']);

    const context = createContext({ role: 'admin' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject users without required role', () => {
    mockReflector.getAllAndOverride.mockReturnValue(['admin']);

    const context = createContext({ role: 'customer' });

    expect(() => guard.canActivate(context)).toThrow(
      ForbiddenException,
    );
  });

  it('should reject requests without user', () => {
    mockReflector.getAllAndOverride.mockReturnValue(['admin']);

    expect(() => guard.canActivate(createContext())).toThrow(
      new ForbiddenException('No user in request'),
    );
  });

  it('should allow any matching role', () => {
    mockReflector.getAllAndOverride.mockReturnValue([
      'admin',
      'manager',
    ]);

    expect(
      guard.canActivate(
        createContext({ role: 'manager' }),
      ),
    ).toBe(true);
  });
});
