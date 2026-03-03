import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
}

export class JwtUtil {
  private static readonly SECRET = process.env.JWT_SECRET || 'agentguard-secret-key-change-in-production';
  private static readonly EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

  /**
   * 生成 JWT Token
   */
  static generateToken(payload: JwtPayload): string {
    return jwt.sign(payload, this.SECRET, {
      expiresIn: this.EXPIRES_IN,
    });
  }

  /**
   * 验证 JWT Token
   */
  static verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.SECRET) as JwtPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * 解析 Token (不验证)
   */
  static decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch (error) {
      return null;
    }
  }
}
