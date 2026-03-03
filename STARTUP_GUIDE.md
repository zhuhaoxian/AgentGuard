# AgentGuard 启动指南

## 📋 前置要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- MySQL 8.0
- Git

## 🚀 快速启动

### 1. 安装依赖

#### 后端依赖
```bash
cd backend
pnpm install

# 安装额外的告警模块依赖
pnpm add nodemailer
pnpm add -D @types/nodemailer @types/node-cron
```

#### 前端依赖
```bash
cd frontend
pnpm install
```

### 2. 配置环境变量

#### 后端配置 (backend/.env)
```env
# 数据库配置
DATABASE_URL="mysql://root:your_password@localhost:3306/agent_guard"

# JWT 配置
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRES_IN="24h"

# 加密配置
ENCRYPTION_KEY="your-encryption-key-32-chars-long"

# 服务器配置
PORT=8080
NODE_ENV=development
```

#### 前端配置 (frontend/.env)
```env
# API 基础地址
VITE_API_BASE_URL=http://localhost:8080
```

### 3. 初始化数据库

```bash
cd backend

# 生成 Prisma Client
pnpm prisma generate

# 同步数据库 schema (开发环境)
pnpm prisma db push

# 或者创建迁移 (生产环境推荐)
pnpm prisma migrate dev --name init
```

### 4. 初始化系统配置 (可选)

连接到 MySQL 数据库,执行以下 SQL 插入默认配置:

```sql
USE agent_guard;

-- 创建默认管理员用户 (密码: admin123)
INSERT INTO user (id, username, password, email, role, status, created_at, updated_at, deleted)
VALUES (
  UUID(),
  'admin',
  '$2b$10$rQ8K5O.V5yqN5Z5Z5Z5Z5uK5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z',
  'admin@agentguard.com',
  'ADMIN',
  1,
  NOW(),
  NOW(),
  0
);

-- 告警配置
INSERT INTO system_settings (id, category, setting_key, setting_value, description, encrypted, created_at, updated_at, deleted) VALUES
(UUID(), 'alert_config', 'rpm_threshold', '100', 'RPM告警阈值', false, NOW(), NOW(), false),
(UUID(), 'alert_config', 'rpm_alert_cooldown_minutes', '30', 'RPM告警冷却时间(分钟)', false, NOW(), NOW(), false),
(UUID(), 'alert_config', 'error_rate_threshold', '0.1', '错误率告警阈值', false, NOW(), NOW(), false),
(UUID(), 'alert_config', 'error_rate_alert_cooldown_minutes', '60', '错误率告警冷却时间(分钟)', false, NOW(), NOW(), false);

-- 邮件配置 (可选,根据实际情况修改)
INSERT INTO system_settings (id, category, setting_key, setting_value, description, encrypted, created_at, updated_at, deleted) VALUES
(UUID(), 'alert_email', 'smtp_host', 'smtp.example.com', 'SMTP服务器地址', false, NOW(), NOW(), false),
(UUID(), 'alert_email', 'smtp_port', '587', 'SMTP端口', false, NOW(), NOW(), false),
(UUID(), 'alert_email', 'smtp_secure', 'false', '是否使用SSL', false, NOW(), NOW(), false),
(UUID(), 'alert_email', 'smtp_user', 'alert@example.com', 'SMTP用户名', false, NOW(), NOW(), false),
(UUID(), 'alert_email', 'smtp_password', 'your_password', 'SMTP密码', true, NOW(), NOW(), false),
(UUID(), 'alert_email', 'smtp_from', 'AgentGuard <alert@example.com>', '发件人地址', false, NOW(), NOW(), false);
```

### 5. 启动服务

#### 启动后端 (终端 1)
```bash
cd backend
pnpm dev
```

后端启动后会看到:
```
Server listening on http://localhost:8080
Alert checker started
Usage aggregator started
RPM aggregator started
Approval executor started
Approval expiration checker started
```

#### 启动前端 (终端 2)
```bash
cd frontend
pnpm dev
```

前端启动后会看到:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### 6. 访问应用

- **前端地址**: http://localhost:5173
- **后端地址**: http://localhost:8080
- **健康检查**: http://localhost:8080/health

默认管理员账号:
- 用户名: `admin`
- 密码: `admin123`

## 📊 验证服务状态

### 检查后端健康状态
```bash
curl http://localhost:8080/health
# 应该返回: {"status":"ok"}
```

### 检查前端是否正常
在浏览器中打开 http://localhost:5173,应该能看到登录页面。

### 测试登录 API
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

应该返回包含 token 的 JSON 响应。

## 🔧 开发模式

### 后端开发
```bash
cd backend

# 开发模式 (热重载)
pnpm dev

# 构建生产版本
pnpm build

# 运行生产版本
pnpm start

# 运行测试
pnpm test

# Prisma 相关命令
pnpm prisma generate      # 生成 Prisma Client
pnpm prisma db push       # 同步数据库 schema
pnpm prisma migrate dev   # 创建迁移
pnpm prisma studio        # 打开数据库管理界面
```

### 前端开发
```bash
cd frontend

# 开发模式 (热重载)
pnpm dev

# 构建生产版本
pnpm build

# 预览生产版本
pnpm preview

# 代码检查
pnpm lint

# 代码格式化
pnpm format

# 运行测试
pnpm test
```

## 🐳 Docker 部署 (可选)

### 使用 Docker Compose 启动
```bash
# 在项目根目录
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## 📝 常见问题

### 1. 后端启动失败 - 数据库连接错误
**问题**: `Error: Can't reach database server`

**解决方案**:
- 检查 MySQL 是否运行: `mysql -u root -p`
- 检查 `.env` 中的 `DATABASE_URL` 是否正确
- 确保数据库 `agent_guard` 已创建

### 2. 前端无法连接后端
**问题**: 前端请求返回 CORS 错误

**解决方案**:
- 确保后端已启动在 8080 端口
- 检查前端 `.env` 中的 `VITE_API_BASE_URL` 配置
- 后端已配置 CORS,应该不会有问题

### 3. Prisma Client 未生成
**问题**: `Cannot find module '@prisma/client'`

**解决方案**:
```bash
cd backend
pnpm prisma generate
```

### 4. 端口被占用
**问题**: `Error: listen EADDRINUSE: address already in use :::8080`

**解决方案**:
- 修改 `.env` 中的 `PORT` 配置
- 或者停止占用端口的进程

### 5. pnpm 命令不存在
**问题**: `pnpm: command not found`

**解决方案**:
```bash
npm install -g pnpm
```

## 🎯 下一步

1. **创建 Agent** - 在前端创建第一个 Agent,获取 API Key
2. **配置策略** - 为 Agent 配置访问控制策略
3. **测试代理** - 使用 API Key 通过 AgentGuard 代理调用 LLM
4. **查看统计** - 在统计页面查看使用情况
5. **配置告警** - 设置邮件或 Webhook 告警

## 📚 相关文档

- [完整实施总结](./IMPLEMENTATION_SUMMARY.md)
- [Phase 4 补充说明](./backend/PHASE4_COMPLETION.md)
- [迁移计划](./docs/MIGRATION_PLAN.md)
- [API 文档](./docs/API.md) (待创建)

## 🆘 获取帮助

如果遇到问题:
1. 查看日志输出
2. 检查数据库连接
3. 确认所有依赖已安装
4. 查看相关文档

---

**祝您使用愉快! 🚀**
