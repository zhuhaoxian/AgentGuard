# AgentGuard

> 开源的 AI Agent 治理平台 - TypeScript 全栈重构版

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📖 项目简介

AgentGuard 是一个开源的 AI Agent 治理平台，提供：
- 🔐 **访问控制** - 策略引擎、审批流程
- 📊 **成本追踪** - Token 统计、预算管理
- 🚨 **告警监控** - 实时告警、异常检测
- 📝 **完整日志** - 请求/响应记录、审计追踪

**技术栈**: TypeScript + Node.js + React + MySQL + Redis

---

## 🚧 项目状态

**当前阶段**: 技术栈迁移中（Java → TypeScript）

本项目正在从 Java/Spring Boot + Vue 3 迁移到 TypeScript/Node.js + React。

---

## 📚 迁移文档

本仓库包含完整的迁移计划文档：

1. **[docs/QUICK_START.md](./docs/QUICK_START.md)** ⭐
   - 快速开始指南
   - Phase 1 详细步骤
   - 立即可执行的命令

2. **[docs/MIGRATION_PLAN.md](./docs/MIGRATION_PLAN.md)**
   - 完整迁移计划（第一部分）
   - 项目概述、技术栈选择
   - 目录结构设计、配置文件

3. **[docs/MIGRATION_PLAN_PART2.md](./docs/MIGRATION_PLAN_PART2.md)**
   - 详细实施指南（第二部分）
   - Prisma Schema 设计
   - 分阶段迁移计划（Phase 1-5）
   - 关键代码示例

4. **[docs/CHECKLIST.md](./docs/CHECKLIST.md)**
   - 进度跟踪清单
   - 可勾选的检查项
   - 进度统计

---

## 🎯 迁移路线图

| 阶段 | 任务 | 状态 | 时间 |
|------|------|------|------|
| Phase 1 | 基础设施搭建 | 🔄 进行中 | 2 周 |
| Phase 2 | Proxy 模块迁移 | ⏳ 待开始 | 2 周 |
| Phase 3 | Policy 引擎迁移 | ⏳ 待开始 | 2 周 |
| Phase 4 | 其他模块迁移 | ⏳ 待开始 | 2 周 |
| Phase 5 | Frontend 迁移 | ⏳ 待开始 | 4 周 |

**预计完成时间**: 12 周（3 个月）

---

## 🚀 快速开始

### 前置要求

- Node.js 20+
- pnpm 8+
- MySQL 8.0+

详细步骤请查看 [docs/QUICK_START.md](./docs/QUICK_START.md)

### 安装步骤

```bash
# 1. 克隆仓库
git clone <repository-url>
cd AgentGuard

# 2. 初始化 Backend
cd backend
pnpm install
npx prisma generate
npx prisma migrate dev

# 3. 启动 Backend
pnpm dev

# 4. 初始化 Frontend（待迁移）
cd ../frontend
pnpm install
pnpm dev
```

详细步骤请查看 [QUICK_START.md](./QUICK_START.md)

---

## 📁 项目结构

```
AgentGuard/
├── backend/              # Node.js + TypeScript 后端
│   ├── src/
│   │   ├── modules/     # 业务模块
│   │   ├── common/      # 公共模块
│   │   ├── prisma/      # Prisma ORM
│   │   └── config/      # 配置文件
│   └── tests/           # 测试文件
│
├── frontend/            # React + TypeScript 前端
│   ├── src/
│   │   ├── pages/      # 页面组件
│   │   ├── components/ # 通用组件
│   │   ├── api/        # API 客户端
│   │   └── stores/     # 状态管理
│   └── tests/
│
├── docs/               # 文档
├── docker/             # Docker 配置
└── scripts/            # 脚本工具
```

---

## 🛠️ 技术栈

### Backend
- **运行时**: Node.js 20+
- **语言**: TypeScript 5.3+
- **框架**: Fastify 4.x
- **数据库**: MySQL 8.0
- **ORM**: Prisma 5.x
- **验证**: Zod 3.x
- **限流**: 内存 Map（单实例部署）

### Frontend
- **框架**: React 18
- **语言**: TypeScript 5.3+
- **UI**: Ant Design 5.x
- **状态**: Zustand 4.x
- **路由**: React Router 6
- **图表**: ECharts 5.x

---

## 📖 核心功能

### 1. HTTP 代理转发
- 支持流式/非流式请求
- 自动 Token 统计
- 首 Token 时间记录

### 2. 策略引擎
- URL 模式匹配
- 请求体/请求头条件评估
- 限流控制

### 3. 审批流程
- 事件驱动执行
- 自动过期处理
- 审批记录追踪

### 4. 成本追踪
- 实时 Token 统计
- 成本计算
- 预算管理

---

## 🤝 贡献指南

欢迎贡献！请查看 [CONTRIBUTING.md](./CONTRIBUTING.md)（待创建）

---

## 📄 许可证

[MIT License](./LICENSE)

---

## 🔗 相关链接

- **旧版本（Java）**: `d:\Business\projects\agent-guard`
- **文档**: [docs/](./docs/)
- **问题反馈**: [Issues](https://github.com/your-repo/issues)

---

## 📞 联系方式

- **作者**: zhuhx
- **邮箱**: your-email@example.com

---

**⚡ 正在积极开发中，敬请期待！**
