import bcrypt from 'bcrypt';
import crypto from 'crypto';

export class EncryptionUtil {
  private static readonly SALT_ROUNDS = 10;
  // 使用 ECB 模式以兼容旧 Java 代码（AES-256-ECB with PKCS5Padding）
  private static readonly ALGORITHM = 'aes-256-ecb';
  // 默认密钥必须与旧 Java 代码一致
  private static readonly ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'agentguard-encryption-key-32-bytes-long';

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
   * 加密敏感字符串 (AES-256-ECB)
   * 兼容旧 Java 代码的加密方式
   * 参考：EncryptionUtil.java:46-56
   */
  static encryptString(text: string): string {
    if (!text) {
      return '';
    }

    try {
      // 准备密钥：确保长度为 32 字节
      const keyBytes = Buffer.from(this.ENCRYPTION_KEY, 'utf8');
      let key: Buffer;

      if (keyBytes.length < 32) {
        // 如果密钥不足 32 字节，填充到 32 字节
        key = Buffer.alloc(32);
        keyBytes.copy(key, 0);
      } else {
        // 如果密钥超过 32 字节，截取前 32 字节
        key = keyBytes.slice(0, 32);
      }

      // ECB 模式不需要 IV
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, null);

      let encrypted = cipher.update(text, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      return encrypted;
    } catch (error) {
      console.error('Failed to encrypt data:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * 解密敏感字符串 (AES-256-ECB)
   * 兼容旧 Java 代码的解密方式
   * 参考：EncryptionUtil.java:64-74
   */
  static decryptString(encryptedText: string): string {
    if (!encryptedText) {
      return '';
    }

    try {
      // 准备密钥：确保长度为 32 字节
      const keyBytes = Buffer.from(this.ENCRYPTION_KEY, 'utf8');
      let key: Buffer;

      if (keyBytes.length < 32) {
        // 如果密钥不足 32 字节，填充到 32 字节
        key = Buffer.alloc(32);
        keyBytes.copy(key, 0);
      } else {
        // 如果密钥超过 32 字节，截取前 32 字节
        key = keyBytes.slice(0, 32);
      }

      // ECB 模式不需要 IV
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, null);

      let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt data:', error);
      throw new Error('Decryption failed');
    }
  }
}
