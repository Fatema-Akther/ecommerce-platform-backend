
import { describe, it, expect } from '@jest/globals';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  it('should be defined', () => {
    const guard = new JwtAuthGuard();

    expect(guard).toBeDefined();
  });

  it('should inherit Passport authentication methods', () => {
    const guard = new JwtAuthGuard();

    expect(typeof guard.canActivate).toBe('function');
    expect(typeof guard.handleRequest).toBe('function');
  });
});
