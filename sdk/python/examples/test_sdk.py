"""AgentGuard SDK 测试示例"""

import os
from agentguard_zhx import AgentGuardOpenAI, AgentGuardHTTP

# 设置环境变量
os.environ["AGENTGUARD_API_KEY"] = "test-agent-key-12345"
os.environ["AGENTGUARD_BASE_URL"] = "http://localhost:8080"


def test_llm_call():
    """测试 LLM 调用"""
    print("=== 测试 LLM 调用 ===")

    client = AgentGuardOpenAI()

    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "user", "content": "Say hello!"}
        ]
    )

    print(f"Response: {response.choices[0].message.content}")
    print(f"Model: {response.model}")
    print(f"Tokens: {response.usage}")


def test_llm_stream():
    """测试流式响应"""
    print("\n=== 测试流式响应 ===")

    client = AgentGuardOpenAI()

    stream = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": "Count from 1 to 5"}],
        stream=True
    )

    print("Streaming response: ", end="")
    for chunk in stream:
        if chunk.choices[0].delta.content:
            print(chunk.choices[0].delta.content, end="", flush=True)
    print()


def test_api_call():
    """测试 API 调用拦截"""
    print("\n=== 测试 API 调用拦截 ===")

    interceptor = AgentGuardHTTP()

    # 示例：调用一个测试 API
    response = interceptor.get("https://httpbin.org/get")

    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")


if __name__ == "__main__":
    # 注意：运行前需要确保 AgentGuard Backend 正在运行
    # 并且已经创建了对应的 Agent

    try:
        test_llm_call()
    except Exception as e:
        print(f"LLM 调用失败: {e}")

    try:
        test_llm_stream()
    except Exception as e:
        print(f"流式响应失败: {e}")

    try:
        test_api_call()
    except Exception as e:
        print(f"API 调用失败: {e}")
