interface VerificationCodeData {
  code: string;
  email: string;
  createdAt: number;
  expiresAt: number;
}

// 使用 global 对象存储验证码，避免热重载清空数据
declare global {
  var verificationCodes: Map<string, VerificationCodeData> | undefined;
}

const getVerificationCodes = () => {
  if (!global.verificationCodes) {
    global.verificationCodes = new Map<string, VerificationCodeData>();
  }
  return global.verificationCodes;
};

export class VerificationCodeService {
  private static readonly CODE_LENGTH = 6;
  private static readonly EXPIRY_TIME = 5 * 60 * 1000; // 5分钟
  private static readonly RATE_LIMIT_TIME = 60 * 1000; // 1分钟

  // 生成6位数字验证码
  static generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // 存储验证码
  static storeCode(email: string, code: string): void {
    const now = Date.now();
    const verificationCodes = getVerificationCodes();
    verificationCodes.set(email, {
      code,
      email,
      createdAt: now,
      expiresAt: now + this.EXPIRY_TIME,
    });
    console.log(`[VerificationCode] Stored code for ${email}: ${code}, total codes: ${verificationCodes.size}`);
  }

  // 验证验证码
  static verifyCode(email: string, code: string): { valid: boolean; error?: string } {
    const verificationCodes = getVerificationCodes();
    console.log(`[VerificationCode] Verifying code for ${email}: ${code}, total codes: ${verificationCodes.size}`);
    const data = verificationCodes.get(email);

    if (!data) {
      console.log(`[VerificationCode] No code found for ${email}`);
      return { valid: false, error: "验证码不存在或已过期" };
    }

    console.log(`[VerificationCode] Found code: ${data.code}, input: ${code}`);

    if (Date.now() > data.expiresAt) {
      verificationCodes.delete(email);
      console.log(`[VerificationCode] Code expired for ${email}`);
      return { valid: false, error: "验证码已过期" };
    }

    if (data.code !== code) {
      console.log(`[VerificationCode] Code mismatch for ${email}`);
      return { valid: false, error: "验证码错误" };
    }

    // 验证成功后删除验证码
    verificationCodes.delete(email);
    console.log(`[VerificationCode] Code verified successfully for ${email}`);
    return { valid: true };
  }

  // 检查是否可以发送验证码（频率限制）
  static canSendCode(email: string): { allowed: boolean; error?: string } {
    const verificationCodes = getVerificationCodes();
    const data = verificationCodes.get(email);

    if (data) {
      const timeSinceCreation = Date.now() - data.createdAt;
      if (timeSinceCreation < this.RATE_LIMIT_TIME) {
        const remainingSeconds = Math.ceil((this.RATE_LIMIT_TIME - timeSinceCreation) / 1000);
        return {
          allowed: false,
          error: `请等待 ${remainingSeconds} 秒后再试`,
        };
      }
    }

    return { allowed: true };
  }

  // 清理过期验证码
  static cleanupExpiredCodes(): void {
    const verificationCodes = getVerificationCodes();
    const now = Date.now();
    for (const [email, data] of verificationCodes.entries()) {
      if (now > data.expiresAt) {
        verificationCodes.delete(email);
      }
    }
  }
}

// 定期清理过期验证码
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    VerificationCodeService.cleanupExpiredCodes();
  }, 60 * 1000); // 每分钟清理一次
}
