# AgentGuard Python SDK 安装指南

## 包名说明

由于 PyPI 上 `agentguard` 包名已被占用，本SDK使用 `agentguard-zhx` 作为包名。

- **PyPI 包名**: `agentguard-zhx`
- **导入名称**: `agentguard_zhx`
- **类名**: `AgentGuardOpenAI`, `AgentGuardHTTP` 等

## 安装方式

### 方式1：从 PyPI 安装（推荐）

```bash
pip install agentguard-zhx
```

### 方式2：从源码安装

```bash
cd sdk/python
pip install -e .
```

## 使用示例

```python
from agentguard_zhx import AgentGuardOpenAI, AgentGuardHTTP

# 初始化客户端
client = AgentGuardOpenAI(
    agentguard_api_key="ag-xxx",
    agentguard_base_url="http://localhost:8080"
)

# 使用HTTP拦截器
http = AgentGuardHTTP(
    agentguard_api_key="ag-xxx",
    agentguard_base_url="http://localhost:8080"
)
```

## 与旧版的兼容性

新版SDK与旧版完全兼容：
- ✅ 包名相同：`agentguard_zhx`
- ✅ 类名相同：`AgentGuardOpenAI`, `AgentGuardHTTP`
- ⚠️ 参数名略有变化：`agentguard_url` → `agentguard_base_url`

详见 [MIGRATION.md](MIGRATION.md) 获取完整的迁移指南。

## 验证安装

```python
import agentguard_zhx
print(agentguard_zhx.__version__)
```

## 常见问题

### Q: 为什么包名是 `agentguard-zhx` 而不是 `agentguard`？
A: PyPI 上 `agentguard` 包名已被占用，为避免冲突使用 `agentguard-zhx`。

### Q: 导入时应该用什么名称？
A: 使用 `agentguard_zhx`（下划线），例如：`from agentguard_zhx import AgentGuardOpenAI`

### Q: 与旧版SDK有什么区别？
A: 新版SDK保持了与旧版相同的类名和API，主要区别在于内部实现更简洁，直接继承OpenAI SDK。
