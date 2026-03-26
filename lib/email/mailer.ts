import nodemailer from "nodemailer";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.AUTH_EMAIL_SMTP_HOST,
      port: parseInt(process.env.AUTH_EMAIL_SMTP_PORT || "465"),
      secure: true,
      auth: {
        user: process.env.AUTH_EMAIL_SMTP_USER,
        pass: process.env.AUTH_EMAIL_SMTP_PASS,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: process.env.AUTH_EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      return true;
    } catch (error) {
      console.error("发送邮件失败:", error);
      return false;
    }
  }

  async sendVerificationCode(email: string, code: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .code { font-size: 32px; font-weight: bold; color: #4F46E5; letter-spacing: 5px; margin: 20px 0; }
            .footer { margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>邮箱验证码</h2>
            <p>您正在注册账号，验证码为：</p>
            <div class="code">${code}</div>
            <p>验证码有效期为5分钟，请尽快完成验证。</p>
            <p>如果这不是您的操作，请忽略此邮件。</p>
            <div class="footer">
              <p>此邮件由系统自动发送，请勿回复。</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: "邮箱验证码",
      html,
    });
  }
}
