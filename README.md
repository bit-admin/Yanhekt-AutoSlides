# AutoSlides

[**English Version**](README_EN.md) 👈 Click here for English

`AutoSlides`是一个自动从网页中捕获幻灯片的工具，支持监控内容变化并保存新幻灯片的截图。最初为北理工延河课堂设计，兼容各类直播/录播平台
- 图形界面版（推荐）​：使用Electron框架，支持Windows/macOS，提供可视化操作
- ​命令行版：仅限macOS，基于Selenium，仅支持终端操作

[AutoSlides_selenium](README_SELENIUM.md) 👈 按此查看命令行版本 / Click here for Command Line Version

## 简介
- **自动幻灯片检测**：仅在内容变化时捕获幻灯片
- **自定义裁剪**：设置顶部和底部裁剪百分比以移除页眉/页脚
- **元素屏蔽**：使用类似 AdGuard 的语法隐藏分散注意力的 UI 元素
- **可视化裁剪参考线**：预览确切的捕获区域

## 安装

### macOS
1. 根据您的处理器架构，从发布页面下载最新版本：
   - 搭载 Apple Silicon (M1/M2/M3/M4) 处理器的 Mac：下载 `AutoSlide-macOS-arm64.dmg`
   - 搭载 Intel 处理器的 Mac：下载 `AutoSlides-macOS-x86_64.dmg`
2. 打开 DMG 文件并将 AutoSlides 拖到应用程序文件夹
3. 首次运行应用程序时，您可能会收到安全警告。要绕过此警告，请执行以下命令：
   ```bash
   sudo xattr -d com.apple.quarantine /Applications/AutoSlides.app
   ```
4. 现在您可以从应用程序文件夹或启动台打开 AutoSlides

### Windows
1. 根据您的处理器架构，从发布页面下载最新安装程序：
   - ARM 处理器：下载 `AutoSlides--Windows-arm64.7z`
   - Intel/AMD 处理器：下载 `AutoSlides-Windows-x64.7z`
2. 解压并运行`AutoSlides.exe`。

## 使用方法
1. 启动应用程序并设置您想要的输出目录
2. 配置裁剪设置：
   - 根据需要设置顶部和底部裁剪百分比
   - 点击"显示裁剪参考线"预览裁剪区域
3. 使用地址栏输入 URL，进入播放界面，保留幻灯片画面，进入网页全屏
4. 点击"Start Capture"开始捕获
5. 播放完成后停止捕获
6. 在您选择的输出目录中找到捕获的幻灯片

## 配置选项

### 设置
- **Output Directory**：幻灯片图像保存的位置
- **Top/Bottom Crop (%)**：从图像顶部和底部移除的百分比
- **Auto-crop guides if URL contains**：当 URL 包含此文本时自动显示裁剪参考线
- **Change Threshold**：检测幻灯片变化的阈值，数值越小越敏感（推荐 0.001-0.005）
- **Check Interval**：检查幻灯片变化的频率（以秒为单位）

### 元素屏蔽规则
使用类似 AdGuard 的语法隐藏不需要的元素：
```
yanhekt.cn###root > div.app > div.sidebar-open:first-child
yanhekt.cn###root > div.app > div.BlankLayout_layout__kC9f3:last-child > div.ant-spin-nested-loading:nth-child(2) > div.ant-spin-container > div.index_liveWrapper__YGcpO > div.index_userlist__T-6xf:last-child > div.index_staticContainer__z3yt-
yanhekt.cn###ai-bit-shortcut
```

## 故障排除
- **幻灯片未捕获**：尝试降低"Change Threshold"阈值
- **macOS 上的安全警告**：使用安装中提到的 `sudo xattr -d com.apple.quarantine` 命令
- **性能问题**：增加"Check Interval"值