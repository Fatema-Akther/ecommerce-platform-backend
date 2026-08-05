import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email: email.toLowerCase() } });
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    role?: UserRole;
    fullName?: string;
    phone?: string;
    isEmailVerified?: boolean;
    emailOtp?: string;
    emailOtpExpiresAt?: Date;
  }) {
    const exists = await this.findByEmail(input.email);
    if (exists) throw new BadRequestException('Email already in use');

    const user = this.repo.create({
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      role: input.role ?? 'user',
      fullName: input.fullName,
      phone: input.phone,
      isEmailVerified: input.isEmailVerified ?? false,
      emailOtp: input.emailOtp,
      emailOtpExpiresAt: input.emailOtpExpiresAt,
    });

    return this.repo.save(user);
  }

  async save(user: User) {
    return this.repo.save(user);
  }

  async findByVerificationToken(token: string) {
    return this.repo.findOne({ where: { emailVerificationToken: token } });
  }



  async updateAdminEmailAndPassword(
  userId: string,
  newEmail: string,
  newPassword: string
) {
  const user = await this.repo.findOne({ where: { id: userId } });

  if (!user) {
    throw new BadRequestException('User not found');
  }

  // Make sure the new email is unique
  const existingUser = await this.repo.findOne({ where: { email: newEmail } });
  if (existingUser) {
    throw new BadRequestException('Email already in use');
  }

  user.email = newEmail;
  user.passwordHash = await bcrypt.hash(newPassword, 10); // Hash the new password

  await this.repo.save(user);

  return { message: 'Admin email and password updated successfully' };
}
}