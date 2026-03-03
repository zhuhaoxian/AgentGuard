import bcrypt from 'bcrypt';
import crypto from 'crypto';

export class EncryptionUtil {
  private static readonly SALT_ROUNDS = 10;
  private static readonly ALGORITHM = 'aes-256-cbc';
  private static readonly ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'agentguard-encryption-key-32ch';

  /**
   * 加密密码 (bcrypt)
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * 验证密码
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * 加密敏感字符串 (AES-256)
   */
  static encryptString(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(this.ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * 解密敏感字符串 (AES-256)
   */
  static decryptString(encryptedText: string): string {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const key = Buffer.from(this.ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));

    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
