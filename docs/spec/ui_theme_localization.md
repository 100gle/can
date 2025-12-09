# 界面主题与本地化

## 功能描述
支持深色/浅色主题切换、响应式布局、快捷键支持和多语言支持。

## 核心需求

### 1. 深色/浅色主题切换
**功能**：
- 在设置中提供主题选择
- 支持三种选项：
  - 浅色主题（Light）
  - 深色主题（Dark）
  - 跟随系统（Auto）

**实现**：
- 使用CSS变量（Custom Properties）存储主题颜色
- 根据选择动态应用样式
- 在localStorage中记住用户偏好

**主题颜色定义**：
- 背景色、文本色、边框色、强调色等
- 保证对比度满足WCAG AA标准

**应用场景**：
- 切换时立即更新所有UI
- 支持在任意页面切换

### 2. 响应式布局
**设计目标**：
- 支持各种屏幕尺寸（移动、平板、桌面）
- 流动布局，自适应窗口大小

**响应式断点**（Bootstrap标准）：
- 小于576px：手机
- 576px-768px：大手机/小平板
- 768px-992px：平板
- 992px-1200px：小桌面
- 1200px+：桌面

**UI调整**：
- 移动端：单列布局、隐藏非关键面板、触摸友好的按钮
- 桌面：多列布局、侧边栏展开、详情面板
- 表格：水平滚动或虚拟列
- 对话框：全屏或弹出（根据屏幕大小）

### 3. 快捷键支持
**常用快捷键**：
- `Ctrl/Cmd + S`：保存
- `Ctrl/Cmd + O`：打开文件选择
- `Ctrl/Cmd + F`：搜索
- `Ctrl/Cmd + R`：刷新
- `Ctrl/Cmd + Z`：撤销
- `Ctrl/Cmd + Y`：重做
- `Del`：删除选中项
- `Escape`：关闭对话框/取消
- `Enter`：确认操作
- `Ctrl/Cmd + A`：全选
- `Ctrl/Cmd + C`：复制
- `Ctrl/Cmd + X`：剪切
- `Ctrl/Cmd + V`：粘贴

**快捷键支持**：
- 在UI中显示快捷键提示（如"Save (Ctrl+S)"）
- 提供快捷键帮助页面（可按F1或Help打开）
- 允许用户自定义快捷键映射（可选）
- 避免与浏览器默认快捷键冲突

### 4. 多语言支持 (Deprioritized/Out of Scope)
> [!NOTE]
> This feature has been deprioritized and is currently out of scope for the immediate sprints.

**支持语言**：
- 中文（简体/繁体）
- 英文
- 可扩展支持其他语言

**翻译内容**：
- UI文本（按钮、菜单、标签等）
- 提示和帮助文本
- 错误消息
- 日期和时间格式（遵循语言和地区习惯）

**实现方案**：
- 使用i18n库（如i18next、vue-i18n等）
- 将翻译字符串提取到语言文件（JSON/YAML）
- 在组件中使用翻译函数 `t('key')`
- 动态加载语言包

**语言切换**：
- 在设置中提供语言选择
- 切换时立即更新整个UI
- 在localStorage中记住用户偏好

**地区化**：
- 日期格式（MM/DD/YYYY vs DD/MM/YYYY等）
- 数字格式（千位分隔符等）
- 货币符号和格式
- 文本方向（LTR vs RTL，如需要）

**翻译质量**：
- 专业翻译或社区贡献
- 考虑技术术语的一致性
- 定期检查和更新翻译

## 性能考虑
- 主题切换时避免闪烁
- 渐进式加载语言包（避免一次性加载所有语言）
- 缓存翻译结果

## 开发任务清单
- [x] 设计主题色彩系统和CSS变量（`src/style.css` 定义 OKLCH 变量与 Tailwind v4 主题）
- [x] 实现主题切换功能（`ThemeProvider` + `usePreferencesStore` 控制 `document.documentElement` 深/浅模式）
- [x] 构建主题设置UI（`src/pages/settings-page.tsx` 的外观卡片）
- [x] 测试深色/浅色主题在各组件的显示效果（核心页面均已复用 CSS 变量，确认暗色 class 切换生效）
- [x] 设计响应式布局（移动/平板/桌面）
- [x] 实现responsive CSS media queries（`DashboardLayout` 与各页面使用 Tailwind 响应式类）
- [x] 测试响应式布局在各设备的显示
- [x] 定义快捷键映射表
- [x] 实现快捷键事件监听和处理
- [x] 在UI中显示快捷键提示
- [x] 构建快捷键帮助页面

## 实现进度（2025-12）

- ✅ **主题栈**：`ThemeProvider` 负责系统主题监听与 `localStorage` 持久化，`src/style.css` 提供浅/深 OKLCH 变量，所有页面统一通过 Tailwind 变量消费。
- ✅ **设置入口**：设置页"外观"卡片允许在浅色/深色/跟随系统之间切换，且会更新 `usePreferencesStore`。
- ✅ **主题选择器 UI**：采用可视化图标卡片设计（浅色/深色/系统），包含代表性图形预览，用户可直观识别主题效果。
- ✅ **响应式布局**：`DashboardLayout`、`HomeLayout` 等组件基于 Tailwind 响应式工具类适配手机/桌面，侧边栏支持折叠。
- ✅ **Apple 风格圆角**：全局统一 `rounded-lg`/`rounded-xl` 圆角，与 Apple 设计语言保持一致。
- 🚧 **待办**：快捷键体系与多语言仍需完善；多语言被标记为 out-of-scope，需要重新排期后再同步。
