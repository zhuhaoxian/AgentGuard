"""AgentGuard SDK - Agent 示例

展示如何使用 AgentGuard SDK 构建一个完整的 AI Agent，
包括工具合并、审批流程等功能。
"""

import os
import json
from typing import List, Dict, Any
from agentguard_zhx import AgentGuardOpenAI, AgentGuardHTTP

# 设置环境变量
os.environ["AGENTGUARD_API_KEY"] = "test-agent-key-12345"
os.environ["AGENTGUARD_BASE_URL"] = "http://localhost:8080"

# 初始化 HTTP 拦截器（用于业务 API 调用）
http = AgentGuardHTTP()


# ============ 业务函数实现 ============

def get_weather(city: str) -> dict:
    """获取天气信息（模拟）"""
    # 实际场景：调用真实的天气 API
    # return http.get(f"https://api.weather.com/v1/weather?city={city}").json()

    # Demo 模拟
    return {
        "city": city,
        "temperature": "25°C",
        "weather": "晴天",
        "humidity": "60%"
    }


def send_email(to: str, subject: str, content: str) -> dict:
    """发送邮件（通过 AgentGuard 代理）"""
    # 实际场景：调用真实的邮件 API，自动经过 AgentGuard 代理
    # return http.post(
    #     "https://api.sendgrid.com/v3/mail/send",
    #     json={
    #         "personalizations": [{"to": [{"email": to}]}],
    #         "from": {"email": "noreply@example.com"},
    #         "subject": subject,
    #         "content": [{"type": "text/plain", "value": content}]
    #     }
    # ).json()

    # Demo 模拟（如果配置了策略规则，这个调用会被拦截）
    return {
        "status": "success",
        "message": f"邮件已发送到 {to}",
        "subject": subject
    }


# ============ 工具定义（OpenAI Function Calling 格式）============

BUSINESS_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "获取指定城市的天气信息",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "城市名称，例如：北京、上海"
                    }
                },
                "required": ["city"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "send_email",
            "description": "发送邮件",
            "parameters": {
                "type": "object",
                "properties": {
                    "to": {
                        "type": "string",
                        "description": "收件人邮箱地址"
                    },
                    "subject": {
                        "type": "string",
                        "description": "邮件主题"
                    },
                    "content": {
                        "type": "string",
                        "description": "邮件内容"
                    }
                },
                "required": ["to", "subject", "content"]
            }
        }
    }
]

# ============ 函数映射 ============

BUSINESS_FUNCTIONS = {
    "get_weather": get_weather,
    "send_email": send_email
}


# ============ AI Agent 实现 ============

class SimpleAgent:
    """简单的 AI Agent，集成 AgentGuard"""

    def __init__(self):
        """初始化 Agent"""
        # 1. 初始化 AgentGuard 客户端
        self.client = AgentGuardOpenAI()

        # 2. SDK 自动合并业务工具和 AgentGuard 审批工具
        self.tools = self.client.merge_tools(BUSINESS_TOOLS)

        # 3. SDK 自动合并业务函数和 AgentGuard 审批函数
        self.functions = self.client.get_function_map(BUSINESS_FUNCTIONS)

        # 对话历史
        self.messages = [
            {
                "role": "system",
                "content": """
                当操作被拦截需要审批时，请：
                1. 告知用户该操作需要审批，并提取审批ID
                2. 引导用户说明操作理由（为什么需要执行此操作）
                3. 提交理由后，告知用户已提交并等待审批
                """
            }
        ]

    def chat(self, user_input: str, stream: bool = True) -> str:
        """
        与用户对话

        Args:
            user_input: 用户输入
            stream: 是否使用流式传输

        Returns:
            Agent 回复
        """
        # 添加用户消息
        self.messages.append({"role": "user", "content": user_input})

        if stream:
            # 流式传输
            return self._chat_stream()
        else:
            # 非流式传输
            return self._chat_non_stream()

    def _chat_non_stream(self) -> str:
        """非流式对话处理"""
        max_iterations = 10  # 防止无限循环
        iteration = 0

        while iteration < max_iterations:
            iteration += 1

            # 调用 LLM
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=self.messages,
                tools=self.tools,
                stream=False
            )

            message = response.choices[0].message
            assistant_message = message.content or ""

            # 如果没有工具调用，结束循环
            if not message.tool_calls:
                # 添加 assistant 消息
                self.messages.append({"role": "assistant", "content": assistant_message})
                return assistant_message

            # 有工具调用，添加 assistant 消息
            self.messages.append({
                "role": "assistant",
                "content": assistant_message,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments
                        }
                    }
                    for tc in message.tool_calls
                ]
            })

            # 执行工具调用
            for tool_call in message.tool_calls:
                function_name = tool_call.function.name
                function_args = json.loads(tool_call.function.arguments)

                print(f"\n[工具调用] {function_name}({function_args})")

                # 执行函数
                if function_name in self.functions:
                    result = self.functions[function_name](**function_args)
                else:
                    result = {"error": f"未知函数: {function_name}"}

                # 添加工具结果
                self.messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result, ensure_ascii=False)
                })

            # 继续下一轮循环，让 LLM 处理工具结果

        # 达到最大迭代次数
        print("\n[警告] 达到最大工具调用次数限制")
        return ""

    def _chat_stream(self) -> str:
        """流式对话处理"""
        max_iterations = 10  # 防止无限循环
        iteration = 0

        while iteration < max_iterations:
            iteration += 1

            # 调用 LLM
            stream = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=self.messages,
                tools=self.tools,
                stream=True
            )

            # 累积响应内容
            assistant_message = ""
            # 累积 tool_calls
            tool_calls_accumulator = {}

            if iteration == 1:
                print("\nAgent: ", end="", flush=True)

            # 处理流式响应
            for chunk in stream:
                if not chunk.choices:
                    continue

                delta = chunk.choices[0].delta

                # 累积内容
                if delta.content:
                    content = delta.content
                    assistant_message += content
                    print(content, end="", flush=True)

                # 累积 tool_calls
                if delta.tool_calls:
                    for tc_delta in delta.tool_calls:
                        idx = tc_delta.index
                        if idx not in tool_calls_accumulator:
                            tool_calls_accumulator[idx] = {
                                "id": tc_delta.id or "",
                                "type": "function",
                                "function": {
                                    "name": tc_delta.function.name or "",
                                    "arguments": ""
                                }
                            }

                        # 累积函数参数
                        if tc_delta.function.arguments:
                            tool_calls_accumulator[idx]["function"]["arguments"] += tc_delta.function.arguments

            # 转换累积的 tool_calls 为列表
            tool_calls = [tool_calls_accumulator[i] for i in sorted(tool_calls_accumulator.keys())] if tool_calls_accumulator else None

            # 如果没有工具调用，结束循环
            if not tool_calls:
                print()
                # 添加 assistant 消息
                self.messages.append({"role": "assistant", "content": assistant_message})
                return assistant_message

            # 有工具调用，添加 assistant 消息
            self.messages.append({
                "role": "assistant",
                "content": assistant_message,
                "tool_calls": tool_calls
            })

            # 执行工具调用
            for tool_call in tool_calls:
                function_name = tool_call["function"]["name"]
                function_args = json.loads(tool_call["function"]["arguments"])

                print(f"\n\n[工具调用] {function_name}({function_args})")

                # 执行函数
                if function_name in self.functions:
                    result = self.functions[function_name](**function_args)
                else:
                    result = {"error": f"未知函数: {function_name}"}

                # 添加工具结果
                self.messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "content": json.dumps(result, ensure_ascii=False)
                })

            # 继续下一轮循环，让 LLM 处理工具结果
            print("\nAgent: ", end="", flush=True)

        # 达到最大迭代次数
        print("\n[警告] 达到最大工具调用次数限制")
        return ""


# ============ 主程序 ============

def main():
    """主程序"""
    print("=== AgentGuard Agent 示例 ===")
    print("提示：输入 'quit' 或 'exit' 退出\n")

    agent = SimpleAgent()

    while True:
        try:
            user_input = input("\n你: ").strip()

            if user_input.lower() in ["quit", "exit", "退出"]:
                print("再见！")
                break

            if not user_input:
                continue

            agent.chat(user_input, stream=True)

        except KeyboardInterrupt:
            print("\n\n再见！")
            break
        except Exception as e:
            print(f"\n错误: {e}")


if __name__ == "__main__":
    # 注意：运行前需要确保 AgentGuard Backend 正在运行
    # 并且已经创建了对应的 Agent
    main()
