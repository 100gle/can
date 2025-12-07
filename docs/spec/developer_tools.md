# 开发者工具

## 功能描述
提供API调试、日志查看和基础代码生成等开发者相关功能。

## 核心需求

### 1. API请求日志查看
**功能**：
- 记录所有S3 API调用
- 显示请求和响应详情

**日志信息**：
- API端点和方法（如PUT /bucket/key）
- 请求时间戳
- 请求头（Headers）
- 请求体（Request Body，如适用）
- 请求参数（Query Parameters）
- 响应状态码
- 响应头
- 响应体
- 耗时（毫秒）
- 发起账户和权限

**日志显示**：
- 表格列表：API、方法、状态、耗时等
- 日志详情：展开查看完整请求/响应内容
- 搜索和过滤：按API名称、状态码、时间范围等
- 导出日志：CSV/JSON格式

**日志保留**：
- 最多保留最近1000条请求（可配置）
- 支持清空日志

**应用场景**：
- 调试API调用是否正确
- 性能分析（哪些API耗时）
- 故障诊断

### 2. 调试模式
**功能**：
- 启用/禁用调试模式
- 在浏览器控制台输出详细日志
- 显示内部状态和变量值

**调试输出**：
- 函数调用堆栈
- 状态变化日志
- 网络请求详情
- 本地存储内容
- 性能指标

**启用方法**：
- 在设置中开启调试模式
- 或通过localStorage: `localStorage.setItem('DEBUG', 'true')`
- 或通过URL参数: `?debug=true`

### 3. 导出配置为代码
**功能**：
- 根据当前账户配置生成基础S3兼容代码示例
- 仅提供通用S3标准API代码，不针对特定云厂商SDK

> [!NOTE]
> 本功能提供基础的S3兼容代码示例，帮助开发者快速上手。由于各云厂商SDK版本频繁更新且API差异较大，建议参考官方文档获取最新SDK使用方法。

**支持的代码示例**：
- Python (boto3) - 通用S3兼容
- Node.js (AWS SDK v3) - 通用S3兼容
- Go (aws-sdk-go-v2) - 通用S3兼容

**生成的代码示例**（Python + boto3）：
```python
import boto3

# 创建S3客户端
s3 = boto3.client(
    's3',
    aws_access_key_id='YOUR_ACCESS_KEY',
    aws_secret_access_key='YOUR_SECRET_KEY',
    endpoint_url='https://s3.amazonaws.com',
    region_name='us-east-1'
)

# 列出存储桶
response = s3.list_buckets()
for bucket in response['Buckets']:
    print(bucket['Name'])

# 上传文件
s3.upload_file('local_file.txt', 'bucket-name', 'object-key')

# 下载文件
s3.download_file('bucket-name', 'object-key', 'local_file.txt')
```

**功能**：
- 选择目标语言
- 选择代码片段类型（初始化、列表、上传、下载等）
- 预览生成的代码
- 复制到剪贴板

## 开发任务清单
- [ ] 实现API请求日志记录（拦截器/中间件）
- [ ] 设计日志数据结构
- [ ] 构建日志查看UI
- [ ] 实现日志搜索和过滤
- [ ] 实现日志导出功能
- [ ] 实现调试模式开关
- [ ] 配置调试日志输出
- [ ] 设计基础代码生成模板（仅S3兼容代码）
- [ ] 实现简化版代码生成引擎
- [ ] 构建代码预览和复制UI
- [ ] ~~实现Webhook配置存储~~ (已移除，S3标准API不支持)
- [ ] ~~实现Webhook事件分发~~ (已移除)
- [ ] ~~实现HMAC签名验证~~ (已移除)
- [ ] ~~实现Webhook调用重试机制~~ (已移除)
- [ ] ~~构建Webhook管理UI~~ (已移除)
- [ ] ~~实现Webhook测试功能~~ (已移除)
- [ ] ~~实现Webhook调用历史记录~~ (已移除)
