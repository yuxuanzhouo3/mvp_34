import { NextResponse } from "next/server";
import { EmailService } from "@/lib/email/mailer";
import { VerificationCodeService } from "@/lib/email/verification-code";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export async function POST(req: Request) {
  try {
    const { email, purpose = "register" } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "邮箱地址不能为空" },
        { status: 400 }
      );
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "邮箱格式不正确" },
        { status: 400 }
      );
    }

    // 检查邮箱是否已注册
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();
    const existing = await db.collection("users").where({ email }).get();

    if (purpose === "register") {
      // 注册：邮箱不能已注册
      if (existing.data.length > 0) {
        return NextResponse.json(
          { error: "该邮箱已被注册，请直接登录" },
          { status: 400 }
        );
      }
    } else if (purpose === "reset") {
      // 找回密码：邮箱必须已注册
      if (existing.data.length === 0) {
        return NextResponse.json(
          { error: "该邮箱未注册，请先注册" },
          { status: 400 }
        );
      }
    }

    // 检查发送频率限制
    const rateLimitCheck = VerificationCodeService.canSendCode(email);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { error: rateLimitCheck.error },
        { status: 429 }
      );
    }

    // 生成验证码
    const code = VerificationCodeService.generateCode();

    // 发送邮件
    const emailService = new EmailService();
    const sent = await emailService.sendVerificationCode(email, code);

    if (!sent) {
      return NextResponse.json(
        { error: "发送验证码失败，请稍后重试" },
        { status: 500 }
      );
    }

    // 存储验证码
    VerificationCodeService.storeCode(email, code);

    return NextResponse.json({
      success: true,
      message: "验证码已发送，请查收邮件",
    });
  } catch (error) {
    console.error("发送验证码错误:", error);
    return NextResponse.json(
      { error: "服务器错误，请稍后重试" },
      { status: 500 }
    );
  }
}
