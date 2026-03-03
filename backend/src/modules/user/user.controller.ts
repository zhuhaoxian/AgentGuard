import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../common/utils/prisma.util';
import { UserService } from './user.service';
import { AuthService } from './auth.service';
import { ResponseUtil } from '../../common/utils/response.util';
import {
  CreateUserDto,
  UpdateUserDto,
  LoginDto,
  ChangePasswordDto,
} from './user.types';

const userService = new UserService(prisma);
const authService = new AuthService(prisma);

export async function userRoutes(app: FastifyInstance) {
  // 用户登录
  app.post<{ Body: LoginDto }>('/auth/login', async (request, reply) => {
    const result = await authService.login(request.body);
    return ResponseUtil.success(result, 'Login successful');
  });

  // 获取当前用户信息
  app.get('/users/me', async (request, reply) => {
    const userId = request.user!.userId;
    const user = await userService.getUserById(userId);
    return ResponseUtil.success(user);
  });

  // 创建用户
  app.post<{ Body: CreateUserDto }>('/users', async (request, reply) => {
    const user = await userService.createUser(request.body);
    return ResponseUtil.success(user, 'User created successfully');
  });

  // 获取用户列表
  app.get<{
    Querystring: { page?: string; pageSize?: string };
  }>('/users', async (request, reply) => {
    const page = parseInt(request.query.page || '1');
    const pageSize = parseInt(request.query.pageSize || '20');

    const { users, total } = await userService.getUsers(page, pageSize);

    return ResponseUtil.paginated(users, total, page, pageSize);
  });

  // 获取用户详情
  app.get<{ Params: { id: string } }>('/users/:id', async (request, reply) => {
    const user = await userService.getUserById(request.params.id);
    return ResponseUtil.success(user);
  });

  // 更新用户
  app.put<{ Params: { id: string }; Body: UpdateUserDto }>(
    '/users/:id',
    async (request, reply) => {
      const user = await userService.updateUser(request.params.id, request.body);
      return ResponseUtil.success(user, 'User updated successfully');
    }
  );

  // 删除用户
  app.delete<{ Params: { id: string } }>(
    '/users/:id',
    async (request, reply) => {
      await userService.deleteUser(request.params.id);
      return ResponseUtil.success(null, 'User deleted successfully');
    }
  );

  // 修改密码
  app.post<{ Body: ChangePasswordDto }>(
    '/users/change-password',
    async (request, reply) => {
      const userId = request.user!.userId;
      await userService.changePassword(userId, request.body);
      return ResponseUtil.success(null, 'Password changed successfully');
    }
  );
}
