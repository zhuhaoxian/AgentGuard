import { PrismaClient } from '@prisma/client';
import { EncryptionUtil } from '../../common/utils/encryption.util';
import { JwtUtil } from '../../common/utils/jwt.util';
import {
  UnauthorizedException,
  ValidationException,
} from '../../common/exceptions/business.exception';
import { LoginDto, LoginResponse, UserResponse } from './user.types';

export class AuthService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 用户登录
   */
  async login(dto: LoginDto): Promise<LoginResponse> {
    // 查找用户
    const user = await this.prisma.user.findFirst({
      where: {
        username: dto.username,
        deleted: 0,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    // 检查用户状态
    if (user.status !== 1) {
      throw new UnauthorizedException('User account is disabled');
    }

    // 验证密码
    const isValid = await EncryptionUtil.comparePassword(
      dto.password,
      user.password
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    // 生成 JWT Token
    const token = JwtUtil.generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    return {
      token,
      user: this.toUserResponse(user),
    };
  }

  /**
   * 验证 Token
   */
  async validateToken(token: string): Promise<UserResponse> {
    try {
      const payload = JwtUtil.verifyToken(token);

      const user = await this.prisma.user.findFirst({
        where: {
          id: payload.userId,
          deleted: 0,
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (user.status !== 1) {
        throw new UnauthorizedException('User account is disabled');
      }

      return this.toUserResponse(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * 转换为用户响应对象
   */
  private toUserResponse(user: any): UserResponse {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
