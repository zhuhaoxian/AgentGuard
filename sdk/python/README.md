# AgentGuard Python SDK

AI Agent 治理与监控 SDK - 完全兼容 OpenAI SDK

## 安装

```bash
pip install -e .
```

## 快速开始

### 1. LLM 调用（OpenAI 兼容）

```python
from agentguard import AgentGuard

# 初始化客户端
client = AgentGuard(
    agentguard_api_key="your-agent-api-key",
    agentguard_base_url="http://localhost:8080"  # 可选
)

# 使用方式与 OpenAI SDK 完全一致
response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)
```

### 2. 流式响应

```python
stream = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": "Tell me a story"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### 3. API 调用拦截

```python
from agentguard import ApiInterceptor

# 初始化拦截器
interceptor = ApiInterceptor(
    agentguard_api_key="your-agent-api-key",
    agentguard_base_url="http://localhost:8080"
)

# 发起 HTTP 请求（会被 AgentGuard 拦截和监控）
response = interceptor.post(
    "https://api.example.com/send-email",
    json={"to": "user@example.com", "subject": "Hello"}
)

print(response.status_code)
print(response.json())
```

## 环境变量

```bash
export AGENTGUARD_API_KEY="your-agent-api-key"
export AGENTGUARD_BASE_URL="http://localhost:8080"
```

设置环境变量后，可以省略初始化参数：

```python
from agentguard import AgentGuard

client = AgentGuard()  # 自动从环境变量读取配置
```

## 特性

- ✅ 完全兼容 OpenAI SDK
- ✅ 支持流式响应
- ✅ 支持异步客户端（AsyncAgentGuard）
- ✅ API 调用拦截和监控
- ✅ 自动日志记录
- ✅ 策略控制和审批流程

## License

MIT
