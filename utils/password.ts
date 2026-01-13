/**
 * 密码加密工具
 * 使用 bcryptjs 进行密码哈希和验证
 */

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

/**
 * 对密码进行哈希加密
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 验证密码是否匹配
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * 同步版本的密码哈希（用于脚本）
 */
export function hashPasswordSync(password: string): string {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

/**
 * 同步版本的密码验证（用于脚本）
 */
export function verifyPasswordSync(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}
