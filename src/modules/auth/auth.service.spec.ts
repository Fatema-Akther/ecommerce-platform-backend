
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;

let users: {
  findByEmail: jest.Mock<(email: string) => Promise<any>>;
  createUser: jest.Mock<(data: any) => Promise<any>>;
  save: jest.Mock<(user: any) => Promise<any>>;
  findByVerificationToken: jest.Mock<(token: string) => Promise<any>>;
};

  let jwt: {
    sign: jest.Mock;
    verify: jest.Mock;
  };

let mail: {
  sendEmailVerificationOtp: jest.Mock<
    (email: string, otp: string) => Promise<void>
  >;
  sendPasswordResetOtp: jest.Mock<
    (email: string, otp: string) => Promise<void>
  >;
};

  const makeUser = (overrides: Record<string, any> = {}) => ({
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    role: 'user',
    passwordHash: 'hashed-password',
    isEmailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpiresAt: null,
    passwordResetToken: null,
    passwordResetExpiresAt: null,
    ...overrides,
  });

  beforeEach(() => {
 users = {
  findByEmail:
    jest.fn<(email: string) => Promise<any>>(),

  createUser:
    jest.fn<(data: any) => Promise<any>>(),

  save:
    jest.fn<(user: any) => Promise<any>>()
      .mockImplementation(async (user) => user),

  findByVerificationToken:
    jest.fn<(token: string) => Promise<any>>(),
};

    jwt = {
      sign: jest.fn()
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token'),
      verify: jest.fn(),
    };
mail = {
  sendEmailVerificationOtp:
    jest.fn<(email: string, otp: string) => Promise<void>>()
      .mockResolvedValue(undefined),

  sendPasswordResetOtp:
    jest.fn<(email: string, otp: string) => Promise<void>>()
      .mockResolvedValue(undefined),
};

    service = new AuthService(
      users as unknown as UsersService,
      jwt as unknown as JwtService,
      mail as unknown as MailService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Registration', () => {
    it('1. should register a new user and send OTP', async () => {
      users.findByEmail.mockResolvedValue(null);
      users.createUser.mockImplementation(async (data) =>
        makeUser(data),
      );

      const result = await service.register({
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(result.requiresOtp).toBe(true);
      expect(result.email).toBe('test@example.com');
      expect(users.createUser).toHaveBeenCalledTimes(1);
      expect(users.save).toHaveBeenCalledTimes(1);
      expect(mail.sendEmailVerificationOtp).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringMatching(/^\d{6}$/),
      );
    });

    it('2. should normalize email and full name', async () => {
      users.findByEmail.mockResolvedValue(null);
      users.createUser.mockImplementation(async (data) =>
        makeUser(data),
      );

      await service.register({
        fullName: '  Test User  ',
        email: '  TEST@EXAMPLE.COM  ',
        password: 'Password123!',
      });

      expect(users.findByEmail).toHaveBeenCalledWith(
        'test@example.com',
      );

      expect(users.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          fullName: 'Test User',
        }),
      );
    });

    it('3. should reject an already verified email', async () => {
      users.findByEmail.mockResolvedValue(makeUser());

      await expect(
        service.register({
          fullName: 'Test User',
          email: 'test@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(users.createUser).not.toHaveBeenCalled();
      expect(mail.sendEmailVerificationOtp).not.toHaveBeenCalled();
    });

    it('4. should resend OTP for an unverified user', async () => {
      const user = makeUser({ isEmailVerified: false });
      users.findByEmail.mockResolvedValue(user);

      const result = await service.register({
        fullName: 'Updated User',
        email: 'test@example.com',
        password: 'NewPassword123!',
      });

      expect(result.requiresOtp).toBe(true);
      expect(user.fullName).toBe('Updated User');
      expect(users.save).toHaveBeenCalledWith(user);
      expect(users.createUser).not.toHaveBeenCalled();
      expect(mail.sendEmailVerificationOtp).toHaveBeenCalledTimes(1);
    });
  });

  describe('Email OTP Verification', () => {
    it('5. should verify a valid OTP and return tokens', async () => {
      const otp = '123456';
      const hashedOtp = await bcrypt.hash(otp, 4);

      const user = makeUser({
        isEmailVerified: false,
        emailVerificationToken: hashedOtp,
        emailVerificationExpiresAt: new Date(Date.now() + 600000),
      });

      users.findByEmail.mockResolvedValue(user);

      const result = await service.verifyEmailOtp(
        'test@example.com',
        otp,
      );

      expect(user.isEmailVerified).toBe(true);
      expect(user.emailVerificationToken).toBeNull();
      expect(users.save).toHaveBeenCalledWith(user);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('6. should reject an invalid OTP', async () => {
      const hashedOtp = await bcrypt.hash('123456', 4);

      users.findByEmail.mockResolvedValue(
        makeUser({
          isEmailVerified: false,
          emailVerificationToken: hashedOtp,
          emailVerificationExpiresAt: new Date(Date.now() + 600000),
        }),
      );

      await expect(
        service.verifyEmailOtp('test@example.com', '999999'),
      ).rejects.toThrow(BadRequestException);

      expect(users.save).not.toHaveBeenCalled();
    });

    it('7. should reject an expired OTP', async () => {
      users.findByEmail.mockResolvedValue(
        makeUser({
          isEmailVerified: false,
          emailVerificationToken: 'hashed-otp',
          emailVerificationExpiresAt: new Date(Date.now() - 60000),
        }),
      );

      await expect(
        service.verifyEmailOtp('test@example.com', '123456'),
      ).rejects.toThrow('OTP has expired');
    });
  });

  describe('Login', () => {
    it('8. should login with valid credentials', async () => {
      const password = 'Password123!';
      const hash = await bcrypt.hash(password, 4);

      users.findByEmail.mockResolvedValue(
        makeUser({ passwordHash: hash }),
      );

      const result = await service.login(
        'test@example.com',
        password,
      );

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user.email).toBe('test@example.com');
    });

    it('9. should reject an incorrect password', async () => {
      const hash = await bcrypt.hash('CorrectPassword!', 4);

      users.findByEmail.mockResolvedValue(
        makeUser({ passwordHash: hash }),
      );

      await expect(
        service.login('test@example.com', 'WrongPassword!'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('10. should reject an unknown email', async () => {
      users.findByEmail.mockResolvedValue(null);

      await expect(
        service.login('unknown@example.com', 'Password123!'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Refresh Token', () => {
    it('11. should generate a new access token', async () => {
      jwt.verify.mockReturnValue({
        sub: 'user-123',
        role: 'user',
      });

      const result = await service.refresh('valid-refresh-token');

      expect(jwt.verify).toHaveBeenCalledWith(
        'valid-refresh-token',
        expect.objectContaining({
          secret: process.env.JWT_REFRESH_SECRET,
        }),
      );

      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: 'user-123', role: 'user' },
        expect.objectContaining({
          secret: process.env.JWT_SECRET,
        }),
      );

      expect(result.accessToken).toBe('access-token');
    });

    it('12. should reject an invalid refresh token', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(
        service.refresh('invalid-refresh-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Password Recovery', () => {
    it('13. should generate and send a password reset OTP', async () => {
      const user = makeUser();
      users.findByEmail.mockResolvedValue(user);

      const result = await service.forgotPassword(
        'test@example.com',
      );

      expect(result.message).toContain('If an account exists');
      expect(user.passwordResetToken).toBeTruthy();
      expect(user.passwordResetExpiresAt).toBeInstanceOf(Date);
      expect(users.save).toHaveBeenCalledWith(user);

      expect(mail.sendPasswordResetOtp).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringMatching(/^\d{6}$/),
      );
    });

    it('14. should reset password with a valid OTP', async () => {
      const otp = '123456';
      const hashedOtp = await bcrypt.hash(otp, 4);

      const user = makeUser({
        passwordResetToken: hashedOtp,
        passwordResetExpiresAt: new Date(Date.now() + 600000),
      });

      users.findByEmail.mockResolvedValue(user);

      const result = await service.resetPassword(
        'test@example.com',
        otp,
        'NewPassword123!',
      );

      expect(result.message).toBe('Password reset successful');
      expect(
        await bcrypt.compare('NewPassword123!', user.passwordHash),
      ).toBe(true);

      expect(user.passwordResetToken).toBeNull();
      expect(user.passwordResetExpiresAt).toBeNull();
      expect(users.save).toHaveBeenCalledWith(user);
    });

    it('15. should reject an expired password reset OTP', async () => {
      users.findByEmail.mockResolvedValue(
        makeUser({
          passwordResetToken: 'hashed-otp',
          passwordResetExpiresAt: new Date(Date.now() - 60000),
        }),
      );

      await expect(
        service.resetPassword(
          'test@example.com',
          '123456',
          'NewPassword123!',
        ),
      ).rejects.toThrow('OTP has expired');

      expect(users.save).not.toHaveBeenCalled();
    });
  });



  describe('Additional Authentication Coverage', () => {
    it('16. should reject OTP verification for unknown email', async () => {
      users.findByEmail.mockResolvedValue(null);

      await expect(
        service.verifyEmailOtp('unknown@example.com', '123456'),
      ).rejects.toThrow('Invalid email or OTP');
    });

    it('17. should reject OTP verification for already verified email', async () => {
      users.findByEmail.mockResolvedValue(
        makeUser({ isEmailVerified: true }),
      );

      await expect(
        service.verifyEmailOtp('test@example.com', '123456'),
      ).rejects.toThrow('Email already verified');
    });

    it('18. should reject OTP verification when token is missing', async () => {
      users.findByEmail.mockResolvedValue(
        makeUser({
          isEmailVerified: false,
          emailVerificationToken: null,
          emailVerificationExpiresAt: null,
        }),
      );

      await expect(
        service.verifyEmailOtp('test@example.com', '123456'),
      ).rejects.toThrow('OTP not found');
    });

    it('19. should reject invalid legacy verification token', async () => {
      users.findByVerificationToken.mockResolvedValue(null);

      await expect(
        service.verifyEmail('invalid-token'),
      ).rejects.toThrow('Invalid or expired token');
    });

    it('20. should verify email using valid legacy token', async () => {
      const user = makeUser({ isEmailVerified: false });

      users.findByVerificationToken.mockResolvedValue(user);

      const result = await service.verifyEmail('valid-token');

      expect(result.message).toBe('Email verified successfully');
      expect(user.isEmailVerified).toBe(true);
      expect(user.emailVerificationToken).toBeNull();
      expect(user.emailVerificationExpiresAt).toBeNull();
      expect(users.save).toHaveBeenCalledWith(user);
    });

    it('21. should not reveal whether an email exists during password recovery', async () => {
      users.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword(
        'unknown@example.com',
      );

      expect(result.message).toContain('If an account exists');
      expect(mail.sendPasswordResetOtp).not.toHaveBeenCalled();
    });

    it('22. should reject password reset for unknown email', async () => {
      users.findByEmail.mockResolvedValue(null);

      await expect(
        service.resetPassword(
          'unknown@example.com',
          '123456',
          'NewPassword123!',
        ),
      ).rejects.toThrow('Invalid OTP or email');
    });

    it('23. should reject password reset with incorrect OTP', async () => {
      const hashedOtp = await bcrypt.hash('123456', 4);

      users.findByEmail.mockResolvedValue(
        makeUser({
          passwordResetToken: hashedOtp,
          passwordResetExpiresAt: new Date(Date.now() + 600000),
        }),
      );

      await expect(
        service.resetPassword(
          'test@example.com',
          '999999',
          'NewPassword123!',
        ),
      ).rejects.toThrow('Invalid OTP');

      expect(users.save).not.toHaveBeenCalled();
    });
  });



});
