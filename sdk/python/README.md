# AgentGuard Python SDK

AgentGuard Python SDK 提供了与 AgentGuard 平台集成的便捷方式，支持 LLM 调用代理、API 拦截、审批流程管理等功能。

## 特性

- ✅ **OpenAI 兼容**: 完全兼容 OpenAI SDK，无缝迁移
- ✅ **自动工具合并**: 自动合并业务工具和审批工具
- ✅ **审批流程**: 内置审批管理功能
- ✅ **API 拦截**: 拦截和代理 HTTP 请求
- ✅ **流式支持**: 支持流式和非流式响应
- ✅ **异步支持**: 提供异步客户端

## 安装

```bash
pip install agentguard-zhx
```

## 快速开始

### 1. 基本 LLM 调用

```python
from agentguard_zhx import AgentGuardOpenAI

# 初始化客户端
client = AgentGuardOpenAI(
    agentguard_api_key="ag-xxx",
    agentguard_base_url="http://localhost:8080"
)

# 调用 LLM（完全兼容 OpenAI API）
response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)
```

### 2. 使用环境变量

```python
import os
from agentguard_zhx import AgentGuardOpenAI

# 设置环境变量
os.environ["AGENTGUARD_API_KEY"] = "ag-xxx"
os.environ["AGENTGUARD_BASE_URL"] = "http://localhost:8080"

# 自动从环境变量读取配置
client = AgentGuardOpenAI()
```

### 3. 构建 AI Agent（工具合并）

```python
from agentguard_zhx import AgentGuardOpenAI
import json

# 初始化客户端
client = AgentGuardOpenAI()

# 定义业务工具
business_tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "获取天气信息",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "城市名称"}
                },
                "required": ["city"]
            }
        }
    }
]

# 定义业务函数
def get_weather(city: str):
    return {"city": city, "temperature": "25°C"}

business_functions = {
    "get_weather": get_weather
}

# 自动合并业务工具和 AgentGuard 审批工具
all_tools = client.merge_tools(business_tools)
all_functions = client.get_function_map(business_functions)

# 使用合并后的工具
response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": "北京天气怎么样？"}],
    tools=all_tools
)

# 执行工具调用
for tool_call in response.choices[0].message.tool_calls:
    function_name = tool_call.function.name
    function_args = json.loads(tool_call.function.arguments)
    result = all_functions[function_name](**function_args)
```

### 4. 审批管理

```python
from agentguard_zhx import AgentGuardOpenAI

client = AgentGuardOpenAI()

# 查询审批状态
status = client.approvals.get_status("approval_id_123")

if status.is_approved:
    print("审批已通过！")
    print("执行结果:", status.execution_result)
elif status.is_rejected:
    print("审批被拒绝:", status.remark)
elif status.is_pending:
    print("审批仍在等待中...")

# 提交审批理由
client.approvals.submit_reason(
    approval_id="approval_id_123",
    reason="需要删除测试数据"
)
```

### 5. API 拦截

```python
from agentguard_zhx import AgentGuardHTTP

# 初始化拦截器
http = AgentGuardHTTP(
    agentguard_api_key="ag-xxx",
    agentguard_base_url="http://localhost:8080"
)

# 所有请求自动经过 AgentGuard 代理
response = http.get("https://api.example.com/data")
print(response.json())

response = http.post(
    "https://api.sendgrid.com/v3/mail/send",
    json={"to": "user@example.com", "subject": "Hello"}
)
print(response.json())
```

### 6. 流式响应

```python
from agentguard_zhx import AgentGuardOpenAI

client = AgentGuardOpenAI()

stream = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": "讲个故事"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
```

### 7. 异步客户端

```python
from agentguard_zhx import AsyncAgentGuardOpenAI
import asyncio

async def main():
    client = AsyncAgentGuardOpenAI()

    response = await client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": "Hello!"}]
    )

    print(response.choices[0].message.content)

asyncio.run(main())
```

## 完整示例

查看 [examples/agent_example.py](examples/agent_example.py) 获取完整的 Agent 实现示例。

## API 参考

### AgentGuardOpenAI

主要的同步客户端类，继承自 OpenAI SDK。

**初始化参数:**
- `agentguard_api_key`: AgentGuard API Key（可选，从环境变量 `AGENTGUARD_API_KEY` 读取）
- `agentguard_base_url`: AgentGuard 服务器地址（可选，从环境变量 `AGENTGUARD_BASE_URL` 读取，默认 `http://localhost:8080`）
- `timeout`: 请求超时时间
- `max_retries`: 最大重试次数

**方法:**
- `merge_tools(business_tools)`: 合并业务工具和审批工具
- `get_function_map(business_functions)`: 合并业务函数和审批函数
- `approvals`: 访问审批客户端

### AsyncAgentGuardOpenAI

异步客户端类，API 与 `AgentGuardOpenAI` 相同。

### AgentGuardHTTP

HTTP 请求拦截器。

**初始化参数:**
- `agentguard_api_key`: AgentGuard API Key
- `agentguard_base_url`: AgentGuard 服务器地址
- `timeout`: 请求超时时间

**方法:**
- `get(url, **kwargs)`: GET 请求
- `post(url, **kwargs)`: POST 请求
- `put(url, **kwargs)`: PUT 请求
- `delete(url, **kwargs)`: DELETE 请求
- `patch(url, **kwargs)`: PATCH 请求

### ApprovalClient

审批管理客户端。

**方法:**
- `get_status(approval_id)`: 查询审批状态
- `submit_reason(approval_id, reason)`: 提交审批理由

## 环境变量

- `AGENTGUARD_API_KEY`: AgentGuard API Key
- `AGENTGUARD_BASE_URL`: AgentGuard 服务器地址（默认: `http://localhost:8080`）

## 许可证

MIT
