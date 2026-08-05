// src\modules\auth\admin.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '../users/user.entity';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as User;

    // Only allow if user is an admin
    if (user.role !== 'admin') {
      throw new ForbiddenException('Access restricted to admin users only');
    }

    return true;
  }
}