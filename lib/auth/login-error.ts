export type LoginErrorContext = {
  isZh: boolean;
  message?: string | null;
  status?: number | null;
};

const INVALID_CREDENTIAL_PATTERNS = [
  "invalid login credentials",
  "invalid email or password",
  "invalid password",
  "incorrect password",
  "user not found",
  "authentication failed",
];

export function getLoginErrorMessage(context: LoginErrorContext): string | null {
  const { isZh, message, status } = context;
  const fallback = isZh ? "账号或密码错误" : "Incorrect email or password";

  if (status === 401) {
    return fallback;
  }

  if (!message) return null;

  const normalized = message.toLowerCase();
  const matched = INVALID_CREDENTIAL_PATTERNS.some((pattern) => normalized.includes(pattern));

  return matched ? fallback : null;
}
