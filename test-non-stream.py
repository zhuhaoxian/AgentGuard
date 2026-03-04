import requests
import json

# 测试非流式请求
url = "http://localhost:8080/v1/chat/completions"
headers = {
    "Content-Type": "application/json",
    "X-AgentGuard-Auth": "test-key"
}
data = {
    "model": "gpt-3.5-turbo",
    "messages": [
        {"role": "user", "content": "你好"}
    ],
    "stream": False
}

print("发送非流式请求...")
print(f"URL: {url}")
print(f"Data: {json.dumps(data, ensure_ascii=False)}")

try:
    response = requests.post(url, headers=headers, json=data, timeout=30)
    print(f"\n状态码: {response.status_code}")
    print(f"响应头: {dict(response.headers)}")
    print(f"响应体: {response.text}")
except Exception as e:
    print(f"\n错误: {e}")
