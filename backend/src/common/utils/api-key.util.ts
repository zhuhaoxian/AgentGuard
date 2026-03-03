import crypto from 'crypto';

export class ApiKeyUtil {
  private static readonly PREFIX = 'ag-';
  private static readonly KEY_LENGTH = 32;

  /**
   * 生成唯一的 API Key
   * 格式: ag-{32位随机字符串}
   */
  static generateApiKey(): string {
    const randomBytes = crypto.randomBytes(this.KEY_LENGTH);
    const randomString = randomBytes.toString('hex').slice(0, this.KEY_LENGTH);
    return `${this.PREFIX}${randomString}`;
  }

  /**
   * 验证 API Key 格式
   */
  static isValidFormat(apiKey: string): boolean {
    const pattern = new RegExp(`^${this.PREFIX}[a-f0-9]{${this.KEY_LENGTH}}$`);
    return pattern.test(apiKey);
  }

  /**
   * 从 Authorization header 中提取 API Key
   * 支持格式: "Bearer ag-xxx" 或 "ag-xxx"
   */
  static extractFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    // 移除 "Bearer " 前缀
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    // 验证格式
    if (this.isValidFormat(token)) {
      return token;
    }

    return null;
  }
}
