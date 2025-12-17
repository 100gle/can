> [!WARNING]
> **Development Status**: This project is currently in **MVP/Beta**. It is still improving compatibility and vendor-specific support. Feedback and bug reports and PRs are very welcome!

<div align="center">

<img src="frontend/src/assets/images/logo-universal.png" width="128" />

# Can

**Can** is a modern cross-platform desktop client for S3-compatible object storage.  
Built with Wails and React, it offers a sleek and consistent user experience across multiple cloud providers.


English | [简体中文](README_ZH.md)

<br />

<img src="screenshots/home.png" alt="Home Page" width="800" />

<details>
<summary>📸 <strong>More Screenshots (List View, Dark Mode, Tree View)</strong></summary>
<br />
<div align="center">
  <img src="screenshots/list-view.png" alt="List View" width="45%" />
  <img src="screenshots/list-view-dark.png" alt="List View (Dark Mode)" width="45%" />
  <img src="screenshots/tree-view.png" alt="Tree View" width="45%" />
</div>
</details>

</div>


## Features

- **Multi-Vendor Support**: Works with AWS S3, Aliyun OSS, Tencent COS, Cloudflare R2, and other S3-compatible services.
- **Sleek UI**: A modern, clean interface for browsing and managing objects.
- **Fully Local**: No intermediate servers involved. Your data and configurations are stored in a local SQLite database.
- **Consistent UX**: Enjoy the same experience on macOS, Windows, and Linux.
- **Simple Setup**: No complex configuration required—just connect and start managing.

## Tech Stack

- **Backend**: Go + Wails
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui + TanStack
- **Storage**: SQLite

## Architecture

```mermaid
---
config:
  layout: dagre
---
flowchart TB
 User["User"]
 subgraph Frontend["Frontend Layer<br>"]
        Desktop["Desktop Application<br>(Powered by Wails)"]
  end
 subgraph Backend["Backend Service"]
        Config["App Config<br>(Module)"]
        Logic["App Data or<br>Other Business Logic<br>(Module)"]
        S3Service["S3 Service<br>(Module)"]
  end
 subgraph UnifiedInterface["Unified Interface Layer"]
        AWSSDK["AWS S3 SDK<br>(Standard Interface)"]
        VendorSDK["Vendor Specific Features<br>(Custom SDK Powered)"]
  end
 subgraph Providers["Cloud Storage Providers"]
        CF["Cloudflare R2"]
        AliOSS["Alibaba Cloud OSS"]
        QiNiu["Qiniu Kodo"]
        TencentCOS["Tencent Cloud COS"]
        AWSS3["AWS S3"]
        Minio["MinIO"]
        Other["Other S3 Compatible<br>Services"]
  end
    User <-- Interact --> Desktop
    Desktop <-- API Calls --> Backend
    %% Config -. Configuration .- S3Service
    %% Logic -. Business Logic .-> S3Service
    S3Service -- Uses --> UnifiedInterface
    AWSSDK -- S3 Compatible API --> CF & AliOSS & QiNiu & TencentCOS & Minio & Other
    AWSSDK -- Native API --> AWSS3
    VendorSDK -. Vendor Specific Features .-> CF & AliOSS & QiNiu & TencentCOS & Other

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

## Contribution

### Prerequisites

- **Go**: Version 1.24 or higher.
- **Node.js**: Version 22 or higher.
- **pnpm**: Recommended package manager for frontend dependencies.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for more details on how to contribute.

### Development

1.  **Clone the repository**
    ```bash
    git clone https://github.com/100gle/can.git
    cd can
    ```

2.  **Let wails setup everything for you**
    ```bash
    wails dev
    ```
    the wails command will include the following steps:
    - install dependencies
    - build the application
    - run the application
    
   The application will be running in development mode with hot reloading.

3. **Some tools for development**
  - Run backend tests: `go test ./...`
  - Run frontend code quality:
    - lint: `pnpm --dir frontend lint`
    - format: `pnpm --dir frontend format`

## License

Distributed under the Apache License 2.0. See `LICENSE` for more information.