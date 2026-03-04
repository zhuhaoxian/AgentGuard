"""AgentGuard 工具辅助类

提供工具定义和函数映射，用于 LLM Function Calling。
这使得业务代码可以轻松集成 AgentGuard 审批工具。
"""

from typing import Dict, Any, Callable, List
import json


class AgentGuardTools:
    """AgentGuard 工具定义和函数映射辅助类"""

    def __init__(self, agentguard_client):
        """
        使用 AgentGuard 客户端实例初始化

        Args:
            agentguard_client: AgentGuard 或 AsyncAgentGuard 实例
        """
        self.client = agentguard_client

    def get_tool_definitions(self) -> List[Dict[str, Any]]:
        """
        获取 AgentGuard 工具定义（用于 LLM Function Calling）

        Returns:
            OpenAI Function Calling 格式的工具定义列表
        """
        return [
            {
                "type": "function",
                "function": {
                    "name": "submit_approval_reason",
                    "description": "提交审批申请理由。当需要执行高风险操作被 AgentGuard 拦截时，使用此工具提交申请理由。",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "approval_id": {
                                "type": "string",
                                "description": "审批请求ID（从拦截消息中获取）"
                            },
                            "reason": {
                                "type": "string",
                                "description": "申请理由，需要详细说明为什么需要执行此操作"
                            }
                        },
                        "required": ["approval_id", "reason"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "check_approval_status",
                    "description": "查询审批状态。当用户告知审批已通过时，使用此工具查询审批结果并获取执行结果。",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "approval_id": {
                                "type": "string",
                                "description": "审批请求ID"
                            }
                        },
                        "required": ["approval_id"]
                    }
                }
            }
        ]

    def get_function_map(self) -> Dict[str, Callable]:
        """
        获取 AgentGuard 工具的函数映射

        Returns:
            函数名到可调用函数的字典映射
        """
        return {
            "submit_approval_reason": self._submit_approval_reason_wrapper,
            "check_approval_status": self._check_approval_status_wrapper
        }

    def _submit_approval_reason_wrapper(self, approval_id: str, reason: str) -> Dict[str, Any]:
        """
        submit_reason 的包装器，格式化响应供 LLM 使用

        Args:
            approval_id: 审批请求ID
            reason: 审批理由

        Returns:
            格式化的结果字典
        """
        try:
            result = self.client.approvals.submit_reason(approval_id, reason)
            return {
                "success": True,
                "message": "审批理由已提交，等待审批人员审核",
                "approval_id": approval_id,
                "reason": reason
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"提交审批理由失败: {str(e)}"
            }

    def _check_approval_status_wrapper(self, approval_id: str) -> Dict[str, Any]:
        """
        get_status 的包装器，格式化响应供 LLM 使用

        Args:
            approval_id: 审批请求ID

        Returns:
            格式化的结果字典，包含状态和执行结果
        """
        try:
            status_response = self.client.approvals.get_status(approval_id)

            if status_response.is_approved:
                if status_response.execution_result:
                    # 从执行结果中提取内容
                    content = self._extract_content_from_result(status_response.execution_result)

                    # 确保 execution_result 可以被 JSON 序列化
                    # 如果是字典，直接使用；否则转换为字符串
                    serializable_result = status_response.execution_result
                    if not isinstance(serializable_result, (dict, list, str, int, float, bool, type(None))):
                        serializable_result = str(serializable_result)

                    return {
                        "status": "approved",
                        "execution_status": "success",
                        "message": "审批通过，执行成功",
                        "content": content,
                        "executionResult": serializable_result
                    }
                else:
                    return {
                        "status": "approved",
                        "execution_status": "pending",
                        "message": "审批通过，正在执行中，请稍后再次查询"
                    }

            elif status_response.is_rejected:
                return {
                    "status": "rejected",
                    "message": f"审批被拒绝: {status_response.remark}"
                }

            elif status_response.is_expired:
                return {
                    "status": "expired",
                    "message": "审批请求已过期"
                }

            elif status_response.is_pending:
                return {
                    "status": "pending",
                    "message": "审批仍在等待中，请稍后再查询"
                }

            else:
                return {
                    "status": "error",
                    "message": f"未知审批状态: {status_response.status}"
                }

        except Exception as e:
            return {
                "status": "error",
                "message": f"查询审批状态失败: {str(e)}"
            }

    def _extract_content_from_result(self, execution_result: Any) -> str:
        """
        从执行结果中提取内容

        Args:
            execution_result: 执行结果（可能是完整的 LLM 响应）

        Returns:
            提取的文本内容
        """
        # 处理不同格式的执行结果
        if isinstance(execution_result, dict):
            # OpenAI 格式: {"choices": [{"message": {"content": "..."}}]}
            if "choices" in execution_result:
                choices = execution_result.get("choices", [])
                if choices and len(choices) > 0:
                    message = choices[0].get("message", {})
                    return message.get("content", "")

            # 简化格式: {"content": "..."}
            if "content" in execution_result:
                return execution_result.get("content", "")

            # 其他格式: 尝试转换为 JSON 字符串
            return json.dumps(execution_result, ensure_ascii=False, indent=2)

        # 如果是字符串，直接返回
        return str(execution_result)
