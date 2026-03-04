# SDK 重构说明

## 新旧版本对比

### 旧版 SDK (agentguard_zhx)

**特点:**
- 使用自定义 HTTP Transport
- 路由端点: `/proxy/v1`
- 认证头: `X-Agent-API-Key`
- 提供工具合并功能

**初始化方式:**
```python
from agentguard_zhx import AgentGuardOpenAI, AgentGuardHTTP

client = AgentGuardOpenAI(
    agentguard_url="http://localhost:8080",
    agent_api_key="ag-xxx"
)

http = AgentGuardHTTP(
    agentguard_url="http://localhost:8080",
    agent_api_key="ag-xxx"
)
```

### 新版 SDK (agentguard-zhx)

**特点:**
- 直接继承 OpenAI SDK
- 路由端点: `/v1`
- 认证头: `X-AgentGuard-Auth`
- 提供工具合并功能
- 更简洁的实现
- 保持与旧版一致的类名

**初始化方式:**
```python
from agentguard_zhx import AgentGuardOpenAI, AgentGuardHTTP

client = AgentGuardOpenAI(
    agentguard_api_key="ag-xxx",
    agentguard_base_url="http://localhost:8080"
)

http = AgentGuardHTTP(
    agentguard_api_key="ag-xxx",
    agentguard_base_url="http://localhost:8080"
)
```

## 主要差异

| 特性 | 旧版 SDK | 新版 SDK |
|------|---------|---------|
| **LLM 客户端** | `AgentGuardOpenAI` | `AgentGuardOpenAI` ✅ 相同 |
| **API 拦截器** | `AgentGuardHTTP` | `AgentGuardHTTP` ✅ 相同 |
| **参数名称** | `agentguard_url`, `agent_api_key` | `agentguard_base_url`, `agentguard_api_key` |
| **认证头** | `X-Agent-API-Key` | `X-AgentGuard-Auth` |
| **路由端点** | `/proxy/v1` | `/v1` |
| **继承方式** | 自定义 Transport | 直接继承 OpenAI |
| **工具合并** | ✅ 支持 | ✅ 支持 |
| **审批管理** | ✅ 支持 | ✅ 支持 |
| **异步支持** | ❓ 未知 | ✅ 支持 (`AsyncAgentGuardOpenAI`) |

## 迁移指南

### 1. 更新导入语句

**旧版和新版相同（无需修改）:**
```python
from agentguard_zhx import AgentGuardOpenAI, AgentGuardHTTP
```

注意：包名保持为 `agentguard_zhx`，类名与旧版完全一致。

### 2. 更新初始化参数

**旧版:**
```python
client = AgentGuardOpenAI(
    agentguard_url="http://localhost:8080",
    agent_api_key="ag-xxx"
)
```

**新版:**
```python
client = AgentGuardOpenAI(
    agentguard_base_url="http://localhost:8080",  # url → base_url
    agentguard_api_key="ag-xxx"  # agent_api_key → agentguard_api_key
)
```

### 3. 工具合并（无需修改）

工具合并的使用方式完全相同：

```python
# 旧版和新版都支持
tools = client.merge_tools(business_tools)
functions = client.get_function_map(business_functions)
```

### 4. 审批管理（无需修改）

审批管理的使用方式完全相同：

```python
# 旧版和新版都支持
status = client.approvals.get_status(approval_id)
client.approvals.submit_reason(approval_id, reason)
```

### 5. API 拦截器

**旧版:**
```python
http = AgentGuardHTTP(
    agentguard_url="http://localhost:8080",
    agent_api_key="ag-xxx"
)
```

**新版:**
```python
http = AgentGuardHTTP(
    agentguard_base_url="http://localhost:8080",  # url → base_url
    agentguard_api_key="ag-xxx"  # agent_api_key → agentguard_api_key
)
```

## 完整迁移示例

### 旧版代码

```python
from agentguard_zhx import AgentGuardOpenAI, AgentGuardHTTP
from config import AGENTGUARD_URL, AGENTGUARD_API_KEY

# 初始化客户端
client = AgentGuardOpenAI(
    agentguard_url=AGENTGUARD_URL,
    agent_api_key=AGENTGUARD_API_KEY
)

http = AgentGuardHTTP(
    agentguard_url=AGENTGUARD_URL,
    agent_api_key=AGENTGUARD_API_KEY
)

# 合并工具
tools = client.merge_tools(BUSINESS_TOOLS)
functions = client.get_function_map(BUSINESS_FUNCTIONS)

# 调用 LLM
response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[...],
    tools=tools
)
```

### 新版代码

```python
from agentguard_zhx import AgentGuardOpenAI, AgentGuardHTTP
from config import AGENTGUARD_URL, AGENTGUARD_API_KEY

# 初始化客户端（只需修改参数名）
client = AgentGuardOpenAI(
    agentguard_base_url=AGENTGUARD_URL,  # 改为 base_url
    agentguard_api_key=AGENTGUARD_API_KEY  # 改为 agentguard_api_key
)

http = AgentGuardHTTP(
    agentguard_base_url=AGENTGUARD_URL,  # 改为 base_url
    agentguard_api_key=AGENTGUARD_API_KEY  # 改为 agentguard_api_key
)

# 合并工具（完全相同）
tools = client.merge_tools(BUSINESS_TOOLS)
functions = client.get_function_map(BUSINESS_FUNCTIONS)

# 调用 LLM（完全相同）
response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[...],
    tools=tools
)
```

## 新版优势

1. **更简洁的实现**: 直接继承 OpenAI SDK，代码更少，更易维护
2. **更好的兼容性**: 完全兼容 OpenAI SDK 的所有功能
3. **异步支持**: 提供 `AsyncAgentGuardOpenAI` 异步客户端
4. **统一的命名**: 参数命名更加一致（`agentguard_base_url`, `agentguard_api_key`）
5. **更清晰的架构**: 职责分离更明确
6. **保持品牌一致性**: 类名与旧版保持一致，降低迁移成本

## 注意事项

1. **后端路由变化**: 新版SDK使用 `/v1` 端点，需要确保后端支持
2. **认证头变化**: 新版使用 `X-AgentGuard-Auth`，需要确保后端支持
3. **环境变量**: 新版使用 `AGENTGUARD_API_KEY` 和 `AGENTGUARD_BASE_URL`
4. **参数名称**: `agentguard_url` → `agentguard_base_url`, `agent_api_key` → `agentguard_api_key`

## 后端兼容性

新版SDK需要后端支持以下端点：

- **LLM 代理**: `POST /v1/chat/completions`
- **API 代理**: `POST /api/proxy`
- **审批状态**: `GET /api/approvals/{id}/status`
- **审批理由**: `POST /api/approvals/{id}/reason`

认证方式：
- 请求头: `X-AgentGuard-Auth: ag-xxx`
