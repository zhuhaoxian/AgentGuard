"""AgentGuard Python SDK - OpenAI 兼容客户端"""

import os
from typing import Optional, Union, List, Dict, Any
import httpx
from openai import OpenAI, AsyncOpenAI
from openai._constants import DEFAULT_MAX_RETRIES

from .approvals import ApprovalClient
from .tools import AgentGuardTools


class AgentGuardOpenAI(OpenAI):
    """
    AgentGuard OpenAI 同步客户端（LLM 调用）
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

        # 初始化审批客户端
        self._approvals = ApprovalClient(
            agentguard_api_key=self.agentguard_api_key,
            agentguard_base_url=gateway_base_url
        )

        # 初始化工具辅助类（用于自动工具合并）
        self._tools_helper = AgentGuardTools(self)

    @property
    def approvals(self) -> ApprovalClient:
        """
        访问审批管理功能

        Returns:
            ApprovalClient 实例，用于管理审批

        Example:
            >>> client = AgentGuardOpenAI(...)
            >>> # 查询审批状态
            >>> status = client.approvals.get_status("approval_id")
            >>> if status.is_approved:
            ...     print("已通过:", status.execution_result)
            >>>
            >>> # 提交审批理由
            >>> client.approvals.submit_reason("approval_id", "需要删除测试数据")
        """
        return self._approvals

    def merge_tools(self, business_tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        合并业务工具和 AgentGuard 审批工具

        这是一个便捷方法，自动将 AgentGuard 的审批管理工具添加到业务工具列表中。

        Args:
            business_tools: 业务工具定义列表

        Returns:
            合并后的工具列表（业务工具 + AgentGuard 审批工具）

        Example:
            >>> client = AgentGuardOpenAI(...)
            >>>
            >>> # 定义业务工具
            >>> business_tools = [
            ...     {
            ...         "type": "function",
            ...         "function": {
            ...             "name": "get_weather",
            ...             "description": "获取天气信息",
            ...             "parameters": {...}
            ...         }
            ...     }
            ... ]
            >>>
            >>> # 自动合并 AgentGuard 工具
            >>> all_tools = client.merge_tools(business_tools)
            >>>
            >>> # 在聊天补全中使用
            >>> response = client.chat.completions.create(
            ...     model="gpt-4",
            ...     messages=[...],
            ...     tools=all_tools  # 自动包含审批工具
            ... )
        """
        return business_tools + self._tools_helper.get_tool_definitions()

    def get_function_map(self, business_functions: Dict[str, Any]) -> Dict[str, Any]:
        """
        合并业务函数和 AgentGuard 审批函数

        这是一个便捷方法，自动将 AgentGuard 的审批管理函数添加到业务函数字典中。

        Args:
            business_functions: 业务函数实现字典

        Returns:
            合并后的函数字典（业务函数 + AgentGuard 审批函数）

        Example:
            >>> client = AgentGuardOpenAI(...)
            >>>
            >>> # 定义业务函数
            >>> business_functions = {
            ...     "get_weather": get_weather_func,
            ...     "send_email": send_email_func
            ... }
            >>>
            >>> # 自动合并 AgentGuard 函数
            >>> all_functions = client.get_function_map(business_functions)
            >>>
            >>> # 执行工具调用
            >>> for tool_call in message.tool_calls:
            ...     func = all_functions[tool_call.function.name]
            ...     result = func(**args)
        """
        return {
            **business_functions,
            **self._tools_helper.get_function_map()
        }


class AsyncAgentGuardOpenAI(AsyncOpenAI):
    """
    AgentGuard OpenAI 异步客户端（LLM 调用）
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

        # 初始化审批客户端
        self._approvals = ApprovalClient(
            agentguard_api_key=self.agentguard_api_key,
            agentguard_base_url=gateway_base_url
        )

        # 初始化工具辅助类（用于自动工具合并）
        self._tools_helper = AgentGuardTools(self)

    @property
    def approvals(self) -> ApprovalClient:
        """
        访问审批管理功能

        Returns:
            ApprovalClient 实例，用于管理审批
        """
        return self._approvals

    def merge_tools(self, business_tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        合并业务工具和 AgentGuard 审批工具

        Args:
            business_tools: 业务工具定义列表

        Returns:
            合并后的工具列表（业务工具 + AgentGuard 审批工具）
        """
        return business_tools + self._tools_helper.get_tool_definitions()

    def get_function_map(self, business_functions: Dict[str, Any]) -> Dict[str, Any]:
        """
        合并业务函数和 AgentGuard 审批函数

        Args:
            business_functions: 业务函数实现字典

        Returns:
            合并后的函数字典（业务函数 + AgentGuard 审批函数）
        """
        return {
            **business_functions,
            **self._tools_helper.get_function_map()
        }
