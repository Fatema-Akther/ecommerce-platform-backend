import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private mailService: MailService,
  ) {}

  private signTokens(user: {
    id: string;
    role: string;
    email: string;
    fullName?: string;
  }) {
    const payload = { sub: user.id, role: user.role };

const accessToken = this.jwt.sign(payload, {
  secret: process.env.JWT_SECRET,
  expiresIn: (process.env.JWT_EXPIRES_IN || '1d') as any,
});
    const refreshToken = this.jwt.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
    };
  }

  async register(input: {
    fullName: string;
    email: string;
    password: string;
  }) {
    const email = input.email.trim().toLowerCase();
    const fullName = input.fullName.trim();

    const existing = await this.users.findByEmail(email);

    const passwordHash = await bcrypt.hash(input.password, 10);
    const otp = randomInt(100000, 1000000).toString(); // 6 digit OTP
    const hashedOtp = await bcrypt.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    if (existing) {
      if (existing.isEmailVerified) {
        throw new BadRequestException('Email already registered');
      }

      // Unverified user হলে নতুন OTP resend হবে
      existing.fullName = fullName;
      existing.passwordHash = passwordHash;
      existing.emailVerificationToken = hashedOtp;
      existing.emailVerificationExpiresAt = otpExpiresAt;

      await this.users.save(existing);

      await this.mailService.sendEmailVerificationOtp(existing.email, otp);

      return {
        message: 'OTP has been sent to your email.',
        requiresOtp: true,
        email: existing.email,
      };
    }

    const user = await this.users.createUser({
      email,
      passwordHash,
      role: 'user',
      fullName,
    });

    user.isEmailVerified = false;
    user.emailVerificationToken = hashedOtp;
    user.emailVerificationExpiresAt = otpExpiresAt;

    await this.users.save(user);

    await this.mailService.sendEmailVerificationOtp(user.email, otp);

    return {
      message: 'OTP has been sent to your email.',
      requiresOtp: true,
      email: user.email,
    };
  }

  async verifyEmailOtp(email: string, otp: string) {
    const user = await this.users.findByEmail(email.trim().toLowerCase());

    if (!user) {
      throw new BadRequestException('Invalid email or OTP');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email already verified');
    }

    if (!user.emailVerificationToken || !user.emailVerificationExpiresAt) {
      throw new BadRequestException('OTP not found. Please register again.');
    }

    if (user.emailVerificationExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('OTP has expired');
    }

    const otpMatched = await bcrypt.compare(
      otp.trim(),
      user.emailVerificationToken,
    );

    if (!otpMatched) {
      throw new BadRequestException('Invalid OTP');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null as any;
    user.emailVerificationExpiresAt = null as any;

    await this.users.save(user);

    return this.signTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });
  }

  
async login(email: string, password: string) {
  const user = await this.users.findByEmail(email.trim().toLowerCase());
  if (!user) throw new UnauthorizedException('Invalid credentials');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new UnauthorizedException('Invalid credentials');

  return this.signTokens({
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
  });
}
  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

const newAccessToken = this.jwt.sign(
  { sub: payload.sub, role: payload.role },
  {
    secret: process.env.JWT_SECRET,
    expiresIn: (process.env.JWT_EXPIRES_IN || '1d') as any,
  },
);

      return { accessToken: newAccessToken };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // OTP flow use করলে এই method আর লাগবে না
  async verifyEmail(token: string) {
    const user = await this.users.findByVerificationToken(token);
    if (!user) throw new BadRequestException('Invalid or expired token');

    user.isEmailVerified = true;
    user.emailVerificationToken = null as any;
    user.emailVerificationExpiresAt = null as any;

    await this.users.save(user);

    return { message: 'Email verified successfully' };
  }

  async forgotPassword(email: string) {
    const user = await this.users.findByEmail(email.toLowerCase());

    if (!user) {
      return {
        message: 'If an account exists, an OTP has been sent to the email.',
      };
    }

    const otp = randomInt(100000, 1000000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    user.passwordResetToken = hashedOtp;
    user.passwordResetExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.users.save(user);

    await this.mailService.sendPasswordResetOtp(user.email, otp);

    return {
      message: 'If an account exists, an OTP has been sent to the email.',
    };
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    const user = await this.users.findByEmail(email.toLowerCase());

    if (!user || !user.passwordResetToken || !user.passwordResetExpiresAt) {
      throw new BadRequestException('Invalid OTP or email');
    }

    if (user.passwordResetExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('OTP has expired');
    }

    const otpMatched = await bcrypt.compare(otp, user.passwordResetToken);
    if (!otpMatched) {
      throw new BadRequestException('Invalid OTP');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordResetToken = null as any;
    user.passwordResetExpiresAt = null as any;

    await this.users.save(user);

    return { message: 'Password reset successful' };
  }
}