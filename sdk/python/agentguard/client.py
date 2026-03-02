"""AgentGuard Python SDK - OpenAI 兼容客户端"""

import os
from typing import Optional, Union
import httpx
from openai import OpenAI, AsyncOpenAI
from openai._constants import DEFAULT_MAX_RETRIES


class AgentGuard(OpenAI):
    """
    AgentGuard 同步客户端（LLM 调用）
    完全继承自 OpenAI，重写初始化逻辑以实现流量劫持
    """

    def __init__(
        self,
        *,
        agentguard_api_key: Optional[str] = None,
        agentguard_base_url: Optional[str] = None,
        timeout: Union[float, httpx.Timeout, None] = None,
        max_retries: int = DEFAULT_MAX_RETRIES,
        **kwargs,
    ) -> None:
        # 解析 AgentGuard 配置
        self.agentguard_api_key = agentguard_api_key or os.environ.get("AGENTGUARD_API_KEY")
        if not self.agentguard_api_key:
            raise ValueError(
                "agentguard_api_key must be set either by passing it to the client "
                "or by setting the AGENTGUARD_API_KEY environment variable"
            )

        # 解析 AgentGuard Base URL
        gateway_base_url = (
            agentguard_base_url
            or os.environ.get("AGENTGUARD_BASE_URL")
            or "http://localhost:8080"
        )

        # 构造自定义 Headers
        default_headers = kwargs.pop("default_headers", {})
        if not isinstance(default_headers, dict):
            default_headers = dict(default_headers)
        default_headers["X-AgentGuard-Auth"] = self.agentguard_api_key

        # 调用父类初始化
        super().__init__(
            api_key="ag-dummy-key",  # OpenAI SDK 需要，但不会被使用
            base_url=f"{gateway_base_url}/v1",
            timeout=timeout,
            max_retries=max_retries,
            default_headers=default_headers,
            **kwargs,
        )


class AsyncAgentGuard(AsyncOpenAI):
    """
    AgentGuard 异步客户端（LLM 调用）
    实现逻辑与同步客户端一致
    """

    def __init__(
        self,
        *,
        agentguard_api_key: Optional[str] = None,
        agentguard_base_url: Optional[str] = None,
        timeout: Union[float, httpx.Timeout, None] = None,
        max_retries: int = DEFAULT_MAX_RETRIES,
        **kwargs,
    ) -> None:
        self.agentguard_api_key = agentguard_api_key or os.environ.get("AGENTGUARD_API_KEY")
        if not self.agentguard_api_key:
            raise ValueError("agentguard_api_key must be set")

        gateway_base_url = (
            agentguard_base_url
            or os.environ.get("AGENTGUARD_BASE_URL")
            or "http://localhost:8080"
        )

        default_headers = kwargs.pop("default_headers", {})
        if not isinstance(default_headers, dict):
            default_headers = dict(default_headers)
        default_headers["X-AgentGuard-Auth"] = self.agentguard_api_key

        super().__init__(
            api_key="ag-dummy-key",
            base_url=f"{gateway_base_url}/v1",
            timeout=timeout,
            max_retries=max_retries,
            default_headers=default_headers,
            **kwargs,
        )
