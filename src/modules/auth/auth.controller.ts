import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  Res,
  Req,
  UnauthorizedException,
  BadRequestException,
  Query,
  Param,
  Put,
} from '@nestjs/common';
import express from 'express';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto';

@Controller('auth')
export class AuthController {
  usersService: any;
  constructor(private auth: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('verify-email-otp')
  async verifyEmailOtp(
    @Body() dto: VerifyEmailOtpDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const { accessToken, refreshToken, user } = await this.auth.verifyEmailOtp(
      dto.email,
      dto.otp,
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { accessToken, user };
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    if (!token) throw new BadRequestException('Token is required');
    return this.auth.verifyEmail(token);
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const { accessToken, refreshToken, user } = await this.auth.login(
      dto.email,
      dto.password,
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { accessToken, user };
  }

  @Post('refresh-token')
  refresh(@Req() req: express.Request) {
    const token = req.cookies?.refreshToken;
    if (!token) {
      throw new UnauthorizedException('No refresh token');
    }
    return this.auth.refresh(token);
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: express.Response) {
    res.clearCookie('refreshToken');
    return { message: 'Logged out' };
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.email, dto.otp, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() req: any) {
    const u = req.user;
    return {
      id: u.id,
      email: u.email,
      role: u.role,
      fullName: u.fullName,
    };
  }



  @Put('update-admin-email-password/:userId')
  async updateAdminEmailPassword(
    @Param('userId') userId: string,
    @Body('newEmail') newEmail: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.usersService.updateAdminEmailAndPassword(userId, newEmail, newPassword);
  }
}