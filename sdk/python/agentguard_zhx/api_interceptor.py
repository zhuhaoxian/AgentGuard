"""AgentGuard API 拦截器 - 用于拦截通用 HTTP 请求"""

import os
from typing import Optional, Dict, Any
import httpx


class AgentGuardHTTP:
    """
    AgentGuard HTTP 拦截器 - 拦截 HTTP 请求并转发到 AgentGuard
    """

    def __init__(
        self,
        agentguard_api_key: Optional[str] = None,
        agentguard_base_url: Optional[str] = None,
        timeout: float = 30.0,
    ):
        self.agentguard_api_key = agentguard_api_key or os.environ.get("AGENTGUARD_API_KEY")
        if not self.agentguard_api_key:
            raise ValueError("agentguard_api_key must be set")

        self.agentguard_base_url = (
            agentguard_base_url
            or os.environ.get("AGENTGUARD_BASE_URL")
            or "http://localhost:8080"
        )
        self.timeout = timeout

    def request(
        self,
        method: str,
        url: str,
        headers: Optional[Dict[str, str]] = None,
        data: Optional[Any] = None,
        json: Optional[Any] = None,
        **kwargs,
    ) -> httpx.Response:
        """
        发起 HTTP 请求（通过 AgentGuard 代理）

        Args:
            method: HTTP 方法
            url: 目标 URL
            headers: 请求头
            data: 请求体（form data）
            json: 请求体（JSON）
            **kwargs: 其他参数

        Returns:
            httpx.Response
        """
        # 构建代理请求
        proxy_request = {
            "url": url,
            "method": method.upper(),
            "headers": headers or {},
            "timeout": int(self.timeout * 1000),  # 转换为毫秒
        }

        # 添加请求体
        if json is not None:
            proxy_request["body"] = json
        elif data is not None:
            proxy_request["body"] = data

        # 发送到 AgentGuard
        with httpx.Client() as client:
            response = client.post(
                f"{self.agentguard_base_url}/api/proxy",
                json=proxy_request,
                headers={"X-AgentGuard-Auth": self.agentguard_api_key},
                timeout=self.timeout,
            )
            return response

    def get(self, url: str, **kwargs) -> httpx.Response:
        """GET 请求"""
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs) -> httpx.Response:
        """POST 请求"""
        return self.request("POST", url, **kwargs)

    def put(self, url: str, **kwargs) -> httpx.Response:
        """PUT 请求"""
        return self.request("PUT", url, **kwargs)

    def delete(self, url: str, **kwargs) -> httpx.Response:
        """DELETE 请求"""
        return self.request("DELETE", url, **kwargs)

    def patch(self, url: str, **kwargs) -> httpx.Response:
        """PATCH 请求"""
        return self.request("PATCH", url, **kwargs)
