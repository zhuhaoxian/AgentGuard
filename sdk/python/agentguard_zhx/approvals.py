"""AgentGuard 审批客户端"""

import os
from typing import Optional, Dict, Any
from enum import Enum
import httpx


class ApprovalStatus(str, Enum):
    """审批状态枚举"""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


class ApprovalStatusResponse:
    """审批状态查询响应"""

    def __init__(
        self,
        status: str,
        execution_result: Optional[Any] = None,
        remark: Optional[str] = None
    ):
        self.status = ApprovalStatus(status)
        self.execution_result = execution_result
        self.remark = remark

    @property
    def is_pending(self) -> bool:
        """检查审批是否待处理"""
        return self.status == ApprovalStatus.PENDING

    @property
    def is_approved(self) -> bool:
        """检查审批是否已通过"""
        return self.status == ApprovalStatus.APPROVED

    @property
    def is_rejected(self) -> bool:
        """检查审批是否已拒绝"""
        return self.status == ApprovalStatus.REJECTED

    @property
    def is_expired(self) -> bool:
        """检查审批是否已过期"""
        return self.status == ApprovalStatus.EXPIRED

    def __repr__(self) -> str:
        return f"ApprovalStatusResponse(status={self.status.value})"


class ApprovalClient:
    """
    审批客户端 - 用于查询审批状态和提交审批理由

    Example:
        >>> from agentguard import ApprovalClient
        >>>
        >>> client = ApprovalClient(
        ...     agentguard_api_key="ag-xxx",
        ...     agentguard_base_url="http://localhost:8080"
        ... )
        >>>
        >>> # 查询审批状态
        >>> status = client.get_status("approval_id_123")
        >>> if status.is_approved:
        ...     print("已通过！结果:", status.execution_result)
        >>> elif status.is_rejected:
        ...     print("已拒绝。原因:", status.remark)
        >>> elif status.is_pending:
        ...     print("仍在等待审批...")
    """

    def __init__(
        self,
        agentguard_api_key: Optional[str] = None,
        agentguard_base_url: Optional[str] = None,
        timeout: float = 30.0
    ):
        """
        初始化审批客户端

        Args:
            agentguard_api_key: AgentGuard API Key
            agentguard_base_url: AgentGuard 服务器地址
            timeout: 请求超时时间（秒）
        """
        self.agentguard_api_key = agentguard_api_key or os.environ.get("AGENTGUARD_API_KEY")
        if not self.agentguard_api_key:
            raise ValueError("agentguard_api_key must be set")

        self.agentguard_base_url = (
            agentguard_base_url
            or os.environ.get("AGENTGUARD_BASE_URL")
            or "http://localhost:8080"
        )
        self.timeout = timeout

    def get_status(self, approval_id: str) -> ApprovalStatusResponse:
        """
        根据ID查询审批状态

        Args:
            approval_id: 审批ID（触发审批时返回）

        Returns:
            ApprovalStatusResponse 包含状态、执行结果（如果已通过）或备注（如果已拒绝）

        Raises:
            Exception: 如果请求失败
        """
        url = f"{self.agentguard_base_url}/api/approvals/{approval_id}/status"
        headers = {
            "X-AgentGuard-Auth": self.agentguard_api_key
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.get(url, headers=headers)
                response.raise_for_status()

                result = response.json()
                if result.get("code") != 200:
                    raise Exception(
                        f"查询审批状态失败: {result.get('message', '未知错误')}"
                    )

                data = result.get("data", {})
                return ApprovalStatusResponse(
                    status=data.get("status"),
                    execution_result=data.get("executionResult"),
                    remark=data.get("remark")
                )

        except httpx.HTTPStatusError as e:
            raise Exception(f"HTTP错误: {e}")
        except httpx.RequestError as e:
            raise Exception(f"请求错误: {e}")
        except Exception as e:
            raise Exception(f"查询审批状态时发生错误: {e}")

    def submit_reason(self, approval_id: str, reason: str) -> Dict[str, Any]:
        """
        提交审批理由

        Args:
            approval_id: 审批ID
            reason: 审批理由/说明

        Returns:
            包含提交结果的字典

        Raises:
            Exception: 如果请求失败
        """
        url = f"{self.agentguard_base_url}/api/approvals/{approval_id}/reason"
        headers = {
            "X-AgentGuard-Auth": self.agentguard_api_key,
            "Content-Type": "application/json"
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(url, headers=headers, json={"reason": reason})
                response.raise_for_status()

                result = response.json()
                if result.get("code") != 200:
                    raise Exception(
                        f"提交审批理由失败: {result.get('message', '未知错误')}"
                    )

                return {
                    "success": True,
                    "message": "审批理由已成功提交"
                }

        except httpx.HTTPStatusError as e:
            raise Exception(f"HTTP错误: {e}")
        except httpx.RequestError as e:
            raise Exception(f"请求错误: {e}")
        except Exception as e:
            raise Exception(f"提交审批理由时发生错误: {e}")
