// import { Injectable, InternalServerErrorException } from '@nestjs/common';
// import { Resend } from 'resend';

// @Injectable()
// export class MailService {
//   private readonly resend = new Resend(process.env.RESEND_API_KEY);

//   private async sendMail({
//     to,
//     subject,
//     text,
//     html,
//   }: {
//     to: string;
//     subject: string;
//     text: string;
//     html: string;
//   }) {
//     try {
//       await this.resend.emails.send({
//         from: process.env.MAIL_FROM || 'onboarding@resend.dev',
//         to,
//         subject,
//         text,
//         html,
//       });
//     } catch (error) {
//       console.error('Email sending failed:', error);
//       throw new InternalServerErrorException('Failed to send email OTP');
//     }
//   }

//   async sendPasswordResetOtp(to: string, otp: string) {
//     return this.sendMail({
//       to,
//       subject: 'Password Reset OTP',
//       text: `Your OTP is ${otp}. It will expire in 10 minutes.`,
//       html: `
//         <div style="font-family: Arial, sans-serif;">
//           <h2>Password Reset OTP</h2>
//           <p>Your OTP is:</p>
//           <h1 style="letter-spacing: 4px;">${otp}</h1>
//           <p>This OTP will expire in 10 minutes.</p>
//         </div>
//       `,
//     });
//   }

//   async sendEmailVerificationOtp(to: string, otp: string) {
//     return this.sendMail({
//       to,
//       subject: 'Email Verification OTP',
//       text: `Your email verification OTP is ${otp}. It will expire in 10 minutes.`,
//       html: `
//         <div style="font-family: Arial, sans-serif;">
//           <h2>Email Verification OTP</h2>
//           <p>Your OTP is:</p>
//           <h1 style="letter-spacing: 4px;">${otp}</h1>
//           <p>This OTP will expire in 10 minutes.</p>
//         </div>
//       `,
//     });
//   }
// }





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
        from:
          process.env.MAIL_FROM ||
          'SumaShop Verification <otp@send.sumashop.xyz>',
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

      subject: 'Reset your SumaShop password',

      text: `
Your SumaShop password reset code is ${otp}.

This code will expire in 10 minutes.

If you did not request this, you can ignore this email.
      `,

      html: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color:#333;">

<h2>SumaShop Password Reset</h2>

<p>Your password reset verification code is:</p>

<h1 style="
letter-spacing:6px;
font-size:32px;
">
${otp}
</h1>

<p>This code will expire in <b>10 minutes</b>.</p>

<p>If you did not request a password reset, you can safely ignore this email.</p>

<br>

<p>
Regards,<br>
<b>SumaShop Team</b>
</p>

</body>
</html>
      `,
    });
  }


  async sendEmailVerificationOtp(to: string, otp: string) {
    return this.sendMail({
      to,

      subject: 'Your SumaShop verification code',

      text: `
Your SumaShop verification code is ${otp}.

This code expires in 10 minutes.

If you did not create this account, please ignore this email.
      `,

      html: `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#333;">

<h2>SumaShop Email Verification</h2>

<p>Use the verification code below to complete your signup:</p>

<h1 style="
letter-spacing:6px;
font-size:32px;
">
${otp}
</h1>

<p>
This code will expire in <b>10 minutes</b>.
</p>

<p>
If you did not request this code, you can ignore this email.
</p>

<br>

<p>
Thanks,<br>
<b>SumaShop Team</b>
</p>

</body>
</html>
      `,
    });
  }
}