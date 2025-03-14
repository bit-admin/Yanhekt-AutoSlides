# AutoSlides

`AutoSlides` 是一个自动化工具，用于监控Chrome浏览器中的幻灯片播放，检测页面变化，自动保存新的幻灯片截图。它最初是在Mac上为北理工的延河课堂开发的，同时支持课堂直播和录播。

## 功能
- **自动截图**：监控Chrome浏览器首个标签页，检测幻灯片变化并保存截图。
- **自定义配置**：通过`config.ini`调整保存路径、裁剪区域、检测阈值等。
- **屏蔽元素**：通过`block_rules.txt`隐藏网页中的指定元素。

## 系统要求
- **操作系统**：macOS。
- **浏览器**：Google Chrome。

## 安装
1. **下载分发包**：
   - 获取分发文件夹（`AutoSlides`），包含以下文件：
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