# 存储桶访问控制

## 功能描述
管理存储桶的访问策略和权限控制，包括Bucket Policy、ACL和公共访问阻止等功能。

## 核心需求

### 1. Bucket Policy编辑
- 查看当前的Bucket Policy（JSON格式）
- 编辑Bucket Policy：
  - 提供JSON编辑器
  - 支持格式验证
  - 显示语法错误提示
- 应用Policy修改
- 删除Policy
- Policy版本历史（可选）

### 2. ACL管理
- 查看当前ACL配置
- 修改Owner、Grantee和Permission关系
- 预设ACL模式：
  - Private（仅所有者可读写）
  - Public Read（公开读）
  - Public Read-Write（公开读写）
  - Authenticated Read（认证用户可读）
  - Bucket Owner Full Control（桶所有者完全控制）
- 自定义ACL规则：
  - 授予用户/组特定权限
  - 权限类型（READ/WRITE/READ_ACP/WRITE_ACP/FULL_CONTROL）

### 3. 阻止公共访问设置
**AWS/OSS特有功能**：
- 配置项：
  - Block public access (bucket level)
  - Block public ACLs (bucket level)
  - Ignore public ACLs (bucket level)
  - Restrict public buckets (bucket level)
- 查看当前设置
- 启用/禁用阻止规则

### 4. 防盗链设置
**OSS特有功能**：
- 启用/禁用防盗链
- 配置白名单来源：
  - 允许的Referer列表
  - 支持通配符（如*.example.com）
- 配置空Referer处理（是否允许空Referer）
- 保存配置

### 5. 权限生效验证
- 测试权限是否生效（可选）
- 显示权限配置的警告/风险提示

## 数据流
1. 用户查看/编辑权限配置
2. 前端调用API获取/更新配置
3. 后端调用S3 API操作相应权限
4. 返回结果和错误信息

## 开发任务清单
- [ ] 设计权限配置数据结构
- [ ] 实现调用S3 GetBucketPolicy/PutBucketPolicy API
- [ ] 实现调用S3 GetBucketAcl/PutBucketAcl API
- [ ] 开发JSON编辑器组件
- [ ] 实现Policy格式验证
- [ ] 构建ACL管理UI
- [ ] 实现服务商特有选项显示
- [ ] 添加权限变更确认流程
- [ ] 实现错误处理和提示
- [ ] 添加权限配置日志记录
