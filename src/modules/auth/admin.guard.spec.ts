
import {
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { AdminGuard } from './admin.guard';

describe('AdminGuard', () => {
  let guard: AdminGuard;

  const createContext = (user: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    guard = new AdminGuard(new Reflector());
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow admin users', () => {
    const context = createContext({ role: 'admin' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject non-admin users', () => {
    const context = createContext({ role: 'customer' });

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException(
        'Access restricted to admin users only',
      ),
    );
  });

  it('should reject users with another role', () => {
    const context = createContext({ role: 'manager' });

    expect(() => guard.canActivate(context)).toThrow(
      ForbiddenException,
    );
  });
});
