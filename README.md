# AutoSlides

`AutoSlides`是一个自动从网页中捕获幻灯片的工具，支持监控内容变化并保存新幻灯片的截图。最初为北理工延河课堂设计，兼容各类直播/录播平台

[**English Version**](README_EN.md) 👈 Click here for English

## 版本选择
- **​图形界面版（推荐）**​：使用Electron框架，支持Windows/macOS，提供可视化操作
- **​命令行版**：仅限macOS，基于Selenium，仅支持终端操作

# AutoSlides_electron（图形界面版）

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

# AutoSlides_selenium（命令行版）

## 简介
- **自动截图**：监控Chrome浏览器首个标签页，检测幻灯片变化并保存截图。
- **自定义配置**：通过`config.ini`调整保存路径、裁剪区域、检测阈值等。
- **屏蔽元素**：通过`block_rules.txt`隐藏网页中的指定元素。

## 系统要求
- **操作系统**：macOS。
- **浏览器**：Google Chrome。

## 安装
1. **下载分发包**：
   - 获取分发包（`AutoSlides-selenium-1.2.0-macOS.zip`），包含以下文件：
```
AutoSlides/
├── autoslides        # 可执行文件
├── config.ini       # 配置文件
├── block_rules.txt  # 屏蔽规则文件
```
   - 将AutoSlides文件夹放在你喜欢的位置（如`~/AutoSlides`）。

2. **赋予执行权限**：
- 打开终端，进入文件夹：
```
cd ~/path/to/AutoSlides # 替换为具体路径
```
- 赋予执行权限：
```
chmod +x autoslides
```


3. **检查Chrome**：
- 确保Google Chrome已安装，默认路径为`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`。

## 使用方法
1. **运行程序**：
- 打开终端，进入文件夹：
```
cd ~/path/to/AutoSlides # 替换为具体路径
```
- 运行可执行文件：
```
./autoslides
```

2. **操作步骤**：
- **首次运行**：如果本地没有ChromeDriver，会自动下载（需要国际互联网连接）。
- **关闭残留Chrome**：若检测到已有Chrome进程，提示退出所有Chrome窗口（注意保存工作）。
- **启动Chrome**：程序会打开Chrome调试模式，在浏览器中打开幻灯片页面，建议：
   - 只保留一个标签页。
   - 进入网页全屏模式。
- **开始监控**：设置好后按回车键，程序开始监控并保存截图。
- **停止**：在终端按`Ctrl+C`，程序会清理所有进程并退出。

3. **输出**：
- 截图默认保存在`~/Downloads/slides`，文件名格式为`slide_YYYY-MM-DD_HH-MM-SS.png`。

## 配置说明
### `config.ini`
- 文件位置：与`AutoSlides`同目录。
- 可编辑选项：
```
[Settings]
output_dir = ~/Downloads/slides  # 保存截图的路径
top_crop_percent = 5            # 顶部裁剪百分比（0-100）
bottom_crop_percent = 5         # 底部裁剪百分比（0-100）
change_threshold = 0.001        # 变化检测阈值（0-1，越小越敏感）
check_interval = 2              # 检查间隔（秒）
chrome_path = /Applications/Google Chrome.app/Contents/MacOS/Google Chrome  # Chrome路径
debug_port = 9222               # 调试端口
```

### `block_rules.txt`
- 文件位置：与`AutoSlides`同目录。
- 格式：`域名###CSS选择器`，每行一条规则。（可以使用AdGuard自定义用户规则，直接粘贴到这里。）

### 全局安装
- 将`AutoSlides`文件夹移动到你喜欢的位置，比如用户根目录后，你还可以创建并配置全局脚本（输入密码时不会显示）：
```
sudo touch /usr/local/bin/autoslides
sudo chmod +x /usr/local/bin/autoslides
sudo nano /usr/local/bin/autoslides
```
- 在编辑器中粘贴以下内容，然后保存（Ctrl+O，回车，Ctrl+X退出）：
```bash
#!/bin/bash

# 项目固定路径（根据你的实际位置调整）
PROJECT_DIR="$HOME/AutoSlides"

# 切换到项目目录并运行 AutoSlides
cd "$PROJECT_DIR"
./AutoSlides
```
- 这样，在任意终端中输入即可运行：
```
autoslides
```

## 注意事项
- **权限问题**：Mac用户若遇到“无法打开，因为开发者未验证”，请在“系统设置 > 安全与隐私”中允许。
- **窗口调整**：监控开始后不要移动或调整Chrome窗口，否则可能影响截图。
- **依赖路径**：依赖项`ChromeDriver`缓存在`~/.wdm/drivers/chromedriver`。