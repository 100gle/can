> [!WARNING]
> **项目状态**：目前处于 **MVP/Beta** 阶段，还在打磨工具的兼容性和各家厂商的适配。非常欢迎提交反馈、Bug 报送或者是 PR！

<div align="center">

<img src="frontend/src/assets/images/logo-universal.png" width="128" />

# Can

**Can** 是一个用 Wails + React 编写的跨平台 S3 桌面客户端。

它旨在为你管理各家云厂商的 S3 对象存储时，提供一致且顺滑的操作体验。

[English](README.md) | 简体中文

<br />

<img src="screenshots/home.png" alt="Home Page" width="800" />

<details>
<summary>📸 <strong>更多截图 (列表视图, 深色模式, 树状视图)</strong></summary>
<br />
<div align="center">
  <img src="screenshots/list-view.png" alt="List View" width="45%" />
  <img src="screenshots/list-view-dark.png" alt="List View (Dark Mode)" width="45%" />
  <img src="screenshots/tree-view.png" alt="Tree View" width="45%" />
</div>
</details>

</div>


## 功能特性

- **多厂商支持**：适配 AWS S3、阿里云 OSS、腾讯云 COS、Cloudflare R2 以及其他各类 S3 兼容服务。（通过 AWS SDK + 自定义 SDK 模式）
- **现代化 UI**：界面清爽，希望像操作系统的文件管理器一样浏览和管理文件。
- **纯本地运行**：不经过任何中间服务器，所有配置和数据都存在本地的 SQLite 数据库中，你的数据由你掌控。
- **跨平台支持**：在 macOS、Windows 和 Linux 上保持一致的用户体验。
- **开箱即用**：无需复杂的环境配置，连接即可上手。

## 技术栈

- **后端**: Go + Wails
- **前端**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui + TanStack
- **存储**: SQLite

## 架构

```mermaid
---
config:
  layout: dagre
---
flowchart TB
 User["用户"]
 subgraph Frontend["前端层<br>"]
        Desktop["桌面应用<br>(基于 Wails)"]
  end
 subgraph Backend["后端服务"]
        Config["应用配置<br>(模块)"]
        Logic["应用数据或<br>其他业务逻辑<br>(模块)"]
        S3Service["S3 服务<br>(模块)"]
  end
 subgraph UnifiedInterface["统一接口层"]
        AWSSDK["AWS S3 SDK<br>(标准接口)"]
        VendorSDK["厂商特定功能<br>(定制 SDK 支持)"]
  end
 subgraph Providers["云存储服务商"]
        CF["Cloudflare R2"]
        AliOSS["阿里云 OSS"]
        QiNiu["七牛云 Kodo"]
        TencentCOS["腾讯云 COS"]
        AWSS3["AWS S3"]
        Minio["MinIO"]
        Other["其他 S3 兼容<br>服务"]
  end
    User <-- 交互 --> Desktop
    Desktop <-- API 调用 --> Backend
    %% Config -. 配置 .- S3Service
    %% Logic -. 业务逻辑 .-> S3Service
    S3Service -- 使用 --> UnifiedInterface
    AWSSDK -- S3 兼容 API --> CF & AliOSS & QiNiu & TencentCOS & Minio & Other
    AWSSDK -- 原生 API --> AWSS3
    VendorSDK -. 厂商特定功能 .-> CF & AliOSS & QiNiu & TencentCOS & Other

     User:::userStyle
     Desktop:::frontendStyle
     Config:::backendStyle
     Logic:::backendStyle
     S3Service:::backendStyle
     AWSSDK:::interfaceStyle
     VendorSDK:::interfaceStyle
     CF:::providerStyle
     AliOSS:::providerStyle
     QiNiu:::providerStyle
     TencentCOS:::providerStyle
     AWSS3:::providerStyle
     Minio:::providerStyle
     Other:::providerStyle
     classDef userStyle fill:#e3f2fd,stroke:#1976d2,stroke-width:2px,color:#000
     classDef frontendStyle fill:#fff9c4,stroke:#f57c00,stroke-width:2px,color:#000
     classDef backendStyle fill:#f5f5f5,stroke:#616161,stroke-width:2px,color:#000
     classDef interfaceStyle fill:#c8e6c9,stroke:#388e3c,stroke-width:2px,color:#000
     classDef providerStyle fill:#ffe0b2,stroke:#e64a19,stroke-width:2px,color:#000
```

## 参与贡献

### 环境要求

- **Go**: 1.24 或更高版本。
- **Node.js**: 22 或更高版本。
- **pnpm**: 推荐使用的前端包管理工具。

更多细节请查阅 [CONTRIBUTING.md](CONTRIBUTING.md)。

### 本地开发

1.  **克隆仓库**
    ```bash
    git clone https://github.com/100gle/can.git
    cd can
    ```

2.  **执行 wails dev**
    ```bash
    wails dev
    ```
    该命令会自动处理：
    - 安装前后端依赖
    - 编译应用
    - 启动并进入热重载模式
    

3. **常用工具**
  - 运行后端测试：`go test ./...`
  - 代码质量检查：
    - Lint: `pnpm --dir frontend lint`
    - 格式化: `pnpm --dir frontend format`

## 许可证

本项目采用 Apache License 2.0 开源协议。详情请参阅 `LICENSE`。
