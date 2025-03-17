# AutoSlides_selenium 命令行版 / Command Line Version

## 简介
- **自动截图**：监控Chrome浏览器首个标签页，检测幻灯片变化并保存截图。
- **自定义配置**：通过`config.ini`调整保存路径、裁剪区域、检测阈值等。
- **屏蔽元素**：通过`block_rules.txt`隐藏网页中的指定元素。

## 系统要求
- **操作系统**：macOS。
- **浏览器**：Google Chrome。

## 安装
1. **下载分发包**：
   - 在v2.0.0获取分发包（`AutoSlides-selenium-1.2.0-macOS.zip`），包含以下文件：
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

---

## Introduction
- **Automatic Screenshots**: Monitors the first tab of the Chrome browser, detects slide changes and saves screenshots.
- **Custom Configuration**: Adjust save path, cropping area, detection threshold, etc. through `config.ini`.
- **Element Blocking**: Hide specified elements on the webpage through `block_rules.txt`.

## System Requirements
- **Operating System**: macOS.
- **Browser**: Google Chrome.

## Installation
1. **Download Distribution Package**:
   - Get the distribution package (`AutoSlides-selenium-1.2.0-macOS.zip`) in v2.0.0, which contains the following files:

```
AutoSlides/
├── autoslides        # Executable file
├── config.ini       # Configuration file
├── block_rules.txt  # Blocking rules file
```

   - Place the AutoSlides folder in your preferred location (e.g., `~/AutoSlides`).

2. **Grant Execute Permissions**:
- Open Terminal and navigate to the folder:

```
cd ~/path/to/AutoSlides # Replace with actual path
```

- Grant execute permissions:

```
chmod +x autoslides
```

3. **Check Chrome**:
- Make sure Google Chrome is installed, the default path is `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

## Usage
1. **Run the Program**:
- Open Terminal, navigate to the folder:

```
cd ~/path/to/AutoSlides # Replace with actual path
```

- Run the executable:

```
./autoslides
```

2. **Operation Steps**:
- **First Run**: If ChromeDriver is not installed locally, it will automatically download (requires international internet connection).
- **Close Residual Chrome**: If Chrome processes are detected, you'll be prompted to quit all Chrome windows (remember to save your work).
- **Launch Chrome**: The program will open Chrome in debug mode. Open the slides page in the browser, it's recommended to:
   - Keep only one tab open.
   - Enter full-screen mode.
- **Start Monitoring**: After setup, press Enter, and the program will start monitoring and saving screenshots.
- **Stop**: Press `Ctrl+C` in the terminal, and the program will clean up all processes and exit.

3. **Output**:
- Screenshots are saved to `~/Downloads/slides` by default, with filenames in the format `slide_YYYY-MM-DD_HH-MM-SS.png`.

## Configuration Details
### `config.ini`
- File Location: Same directory as `AutoSlides`.
- Editable Options:

```
[Settings]
output_dir = ~/Downloads/slides  # Path to save screenshots
top_crop_percent = 5            # Top crop percentage (0-100)
bottom_crop_percent = 5         # Bottom crop percentage (0-100)
change_threshold = 0.001        # Change detection threshold (0-1, smaller = more sensitive)
check_interval = 2              # Check interval (seconds)
chrome_path = /Applications/Google Chrome.app/Contents/MacOS/Google Chrome  # Chrome path
debug_port = 9222               # Debug port
```

### `block_rules.txt`
- File Location: Same directory as `AutoSlides`.
- Format: `domain###CSS selector`, one rule per line. (You can use AdGuard custom user rules, paste directly here.)

### Global Installation
- After moving the `AutoSlides` folder to your preferred location, such as the user's root directory, you can create and configure a global script (no password display when entering):

```
sudo touch /usr/local/bin/autoslides
sudo chmod +x /usr/local/bin/autoslides
sudo nano /usr/local/bin/autoslides
```

- Paste the following content into the editor, then save (Ctrl+O, Enter, Ctrl+X to exit):

```
#!/bin/bash

# Fixed project path (adjust according to your actual location)
PROJECT_DIR="$HOME/AutoSlides"

# Switch to the project directory and run AutoSlides
cd "$PROJECT_DIR"
./AutoSlides
```

- This way, you can run it from any terminal by typing:

```
autoslides
```

## Notes
- **Permission Issues**: If Mac users encounter "Cannot open because the developer is not verified", please allow it in "System Settings > Security & Privacy".
- **Window Adjustment**: Do not move or adjust the Chrome window after monitoring begins, as it may affect screenshots.
- **Dependency Path**: The dependency `ChromeDriver` is cached in `~/.wdm/drivers/chromedriver`.