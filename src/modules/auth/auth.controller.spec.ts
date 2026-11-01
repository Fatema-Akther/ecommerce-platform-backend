
import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  beforeEach,
  describe,
  it,
  expect,
  jest,
} from '@jest/globals';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn<(...args: any[]) => Promise<any>>(),
    verifyEmailOtp: jest.fn<(...args: any[]) => Promise<any>>(),
    verifyEmail: jest.fn<(...args: any[]) => Promise<any>>(),
    login: jest.fn<(...args: any[]) => Promise<any>>(),
    refresh: jest.fn<(...args: any[]) => Promise<any>>(),
    forgotPassword: jest.fn<(...args: any[]) => Promise<any>>(),
    resetPassword: jest.fn<(...args: any[]) => Promise<any>>(),
  };

  const mockUsersService = {
    updateAdminEmailAndPassword:
      jest.fn<(...args: any[]) => Promise<any>>(),
  };

  const mockResponse = {
    cookie: jest.fn<(...args: any[]) => any>(),
    clearCookie: jest.fn<(...args: any[]) => any>(),
  };

  const authResult = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    user: {
      id: 'user-123',
      email: 'test@example.com',
      role: 'customer',
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();

    controller = new AuthController(
      mockAuthService as unknown as AuthService,
      mockUsersService as unknown as UsersService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a user', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'Password123!',
        fullName: 'Test User',
      };

      const result = { message: 'Registration successful' };

      mockAuthService.register.mockResolvedValue(result);

      await expect(
        controller.register(dto as any),
      ).resolves.toEqual(result);

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('verifyEmailOtp', () => {
    it('should verify OTP and set refresh cookie', async () => {
      mockAuthService.verifyEmailOtp.mockResolvedValue(authResult);

      const result = await controller.verifyEmailOtp(
        {
          email: 'test@example.com',
          otp: '123456',
        },
        mockResponse as any,
      );

      expect(mockAuthService.verifyEmailOtp).toHaveBeenCalledWith(
        'test@example.com',
        '123456',
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'test-refresh-token',
        {
          httpOnly: true,
          sameSite: 'lax',
          secure: false,
          maxAge: 604800000,
        },
      );

      expect(result).toEqual({
        accessToken: 'test-access-token',
        user: authResult.user,
      });
    });
  });

  describe('verifyEmail', () => {
    it('should reject missing token', async () => {
      await expect(
        controller.verifyEmail(''),
      ).rejects.toThrow(BadRequestException);

      expect(mockAuthService.verifyEmail).not.toHaveBeenCalled();
    });

    it('should verify a valid token', async () => {
      const response = { message: 'Email verified' };

      mockAuthService.verifyEmail.mockResolvedValue(response);

      await expect(
        controller.verifyEmail('valid-token'),
      ).resolves.toEqual(response);

      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith(
        'valid-token',
      );
    });
  });

  describe('login', () => {
    it('should login and set refresh cookie', async () => {
      mockAuthService.login.mockResolvedValue(authResult);

      const result = await controller.login(
        {
          email: 'test@example.com',
          password: 'Password123!',
        },
        mockResponse as any,
      );

      expect(mockAuthService.login).toHaveBeenCalledWith(
        'test@example.com',
        'Password123!',
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'test-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 604800000,
        }),
      );

      expect(result).toEqual({
        accessToken: 'test-access-token',
        user: authResult.user,
      });
    });
  });

  describe('refresh', () => {
    it('should refresh access token', async () => {
      const response = { accessToken: 'new-access-token' };

      mockAuthService.refresh.mockResolvedValue(response);

      const result = await controller.refresh({
        cookies: { refreshToken: 'valid-refresh-token' },
      } as any);

      expect(mockAuthService.refresh).toHaveBeenCalledWith(
        'valid-refresh-token',
      );

      expect(result).toEqual(response);
    });

    it('should reject missing refresh token', () => {
      expect(() =>
        controller.refresh({ cookies: {} } as any),
      ).toThrow(UnauthorizedException);

      expect(mockAuthService.refresh).not.toHaveBeenCalled();
    });

    it('should reject request without cookies', () => {
      expect(() =>
        controller.refresh({} as any),
      ).toThrow('No refresh token');
    });
  });

  describe('logout', () => {
    it('should clear refresh cookie', () => {
      const result = controller.logout(mockResponse as any);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'refreshToken',
      );

      expect(result).toEqual({
        message: 'Logged out',
      });
    });
  });

  describe('forgotPassword', () => {
    it('should forward email to AuthService', async () => {
      const response = {
        message: 'If the email exists, an OTP has been sent',
      };

      mockAuthService.forgotPassword.mockResolvedValue(response);

      await expect(
        controller.forgotPassword({
          email: 'test@example.com',
        }),
      ).resolves.toEqual(response);

      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(
        'test@example.com',
      );
    });
  });

  describe('resetPassword', () => {
    it('should forward reset credentials', async () => {
      const response = { message: 'Password reset successful' };

      mockAuthService.resetPassword.mockResolvedValue(response);

      await expect(
        controller.resetPassword({
          email: 'test@example.com',
          otp: '123456',
          newPassword: 'NewPassword123!',
        }),
      ).resolves.toEqual(response);

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        'test@example.com',
        '123456',
        'NewPassword123!',
      );
    });
  });

  describe('me', () => {
    it('should return current user profile', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'customer',
        fullName: 'Test User',
        passwordHash: 'secret',
      };

      const result = controller.me({ user });

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        role: 'customer',
        fullName: 'Test User',
      });

      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('updateAdminEmailPassword', () => {
    it('should forward update request to UsersService', async () => {
      const response = { message: 'Admin updated' };

      mockUsersService.updateAdminEmailAndPassword
        .mockResolvedValue(response);

      await expect(
        controller.updateAdminEmailPassword(
          'admin-123',
          'admin@example.com',
          'NewPassword123!',
        ),
      ).resolves.toEqual(response);

      expect(
        mockUsersService.updateAdminEmailAndPassword,
      ).toHaveBeenCalledWith(
        'admin-123',
        'admin@example.com',
        'NewPassword123!',
      );
    });
  });
});
