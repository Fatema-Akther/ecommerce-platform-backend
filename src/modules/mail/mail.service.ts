import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly resend = new Resend(process.env.RESEND_API_KEY);

  private async sendMail({
    to,
    subject,
    text,
    html,
  }: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }) {
    try {
      await this.resend.emails.send({
        from: process.env.MAIL_FROM || 'onboarding@resend.dev',
        to,
        subject,
        text,
        html,
      });
    } catch (error) {
      console.error('Email sending failed:', error);
      throw new InternalServerErrorException('Failed to send email OTP');
    }
  }

  async sendPasswordResetOtp(to: string, otp: string) {
    return this.sendMail({
      to,
      subject: 'Password Reset OTP',
      text: `Your OTP is ${otp}. It will expire in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Password Reset OTP</h2>
          <p>Your OTP is:</p>
          <h1 style="letter-spacing: 4px;">${otp}</h1>
          <p>This OTP will expire in 10 minutes.</p>
        </div>
      `,
    });
  }

  async sendEmailVerificationOtp(to: string, otp: string) {
    return this.sendMail({
      to,
      subject: 'Email Verification OTP',
      text: `Your email verification OTP is ${otp}. It will expire in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Email Verification OTP</h2>
          <p>Your OTP is:</p>
          <h1 style="letter-spacing: 4px;">${otp}</h1>
          <p>This OTP will expire in 10 minutes.</p>
        </div>
      `,
    });
  }
}