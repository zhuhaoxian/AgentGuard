import { PrismaClient } from '@prisma/client';
import { EncryptionUtil } from '../../common/utils/encryption.util';
import {
  BusinessException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions/business.exception';
import {
  CreateUserDto,
  UpdateUserDto,
  ChangePasswordDto,
  UserResponse,
} from './user.types';

export class UserService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 创建用户
   */
  async createUser(dto: CreateUserDto): Promise<UserResponse> {
    // 检查用户名是否已存在
    const existingUser = await this.prisma.user.findFirst({
      where: {
        username: dto.username,
        deleted: 0,
      },
    });

    if (existingUser) {
      throw new ValidationException('Username already exists');
    }

    // 加密密码
    const hashedPassword = await EncryptionUtil.hashPassword(dto.password);

    // 创建用户
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        password: hashedPassword,
        email: dto.email,
        role: dto.role || 'USER',
      },
    });

    return this.toUserResponse(user);
  }

  /**
   * 更新用户
   */
  async updateUser(userId: string, dto: UpdateUserDto): Promise<UserResponse> {
    // 检查用户是否存在
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deleted: 0 },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 更新用户
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: dto.email,
        role: dto.role,
        status: dto.status,
      },
    });

    return this.toUserResponse(updatedUser);
  }

  /**
   * 删除用户(软删除)
   */
  async deleteUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deleted: 0 },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { deleted: 1 },
    });
  }

  /**
   * 获取用户列表
   */
  async getUsers(
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ users: UserResponse[]; total: number }> {
    const skip = (page - 1) * pageSize;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { deleted: 0 },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({
        where: { deleted: 0 },
      }),
    ]);

    return {
      users: users.map(user => this.toUserResponse(user)),
      total,
    };
  }

  /**
   * 获取用户详情
   */
  async getUserById(userId: string): Promise<UserResponse> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deleted: 0 },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserResponse(user);
  }

  /**
   * 修改密码
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deleted: 0 },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 验证旧密码
    const isValid = await EncryptionUtil.comparePassword(
      dto.oldPassword,
      user.password
    );

    if (!isValid) {
      throw new ValidationException('Old password is incorrect');
    }

    // 加密新密码
    const hashedPassword = await EncryptionUtil.hashPassword(dto.newPassword);

    // 更新密码
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
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
