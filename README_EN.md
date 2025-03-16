# AutoSlides

`AutoSlides` is a tool for automatically capturing slides from web pages, supporting monitoring content changes and saving screenshots of new slides. Initially designed for Beijing Institute of Technology's Yanhe Classroom, compatible with various live/recorded platforms.

[**中文版本**](README.md) 👈 Click here for Chinese

## Version Selection
- **Graphical Interface Version (Recommended)**: Uses Electron framework, supports Windows/macOS, provides visual operation
- **Command Line Version**: macOS only, based on Selenium, supports terminal operation only

# AutoSlides_electron (Graphical Interface Version)

## Introduction
- **Automatic Slide Detection**: Captures slides only when content changes
- **Custom Cropping**: Set top and bottom cropping percentages to remove headers/footers
- **Element Blocking**: Hide distracting UI elements using AdGuard-like syntax
- **Visual Cropping Reference Lines**: Preview the exact capture area

## Installation

### macOS
1. Download the latest version from the release page according to your processor architecture:
   - Macs with Apple Silicon (M1/M2/M3/M4) processors: Download `AutoSlide-macOS-arm64.dmg`
   - Macs with Intel processors: Download `AutoSlides-macOS-x86_64.dmg`
2. Open the DMG file and drag AutoSlides to the Applications folder
3. When running the application for the first time, you may receive a security warning. To bypass this warning, run the following command:

```
sudo xattr -d com.apple.quarantine /Applications/AutoSlides.app
```

4. Now you can open AutoSlides from the Applications folder or Launchpad

### Windows
1. Download the latest installer from the release page according to your processor architecture:
   - ARM processors: Download `AutoSlides--Windows-arm64.7z`
   - Intel/AMD processors: Download `AutoSlides-Windows-x64.7z`
2. Extract and run `AutoSlides.exe`.

## Usage
1. Launch the application and set your desired output directory
2. Configure cropping settings:
   - Set the top and bottom cropping percentages as needed
   - Click "Show Cropping Reference Lines" to preview the cropping area
3. Use the address bar to enter the URL, enter the playback interface, retain the slide view, and enter full-screen mode
4. Click "Start Capture" to begin capturing
5. Stop capturing when playback is complete
6. Find the captured slides in your chosen output directory

## Configuration Options

### Settings
- **Output Directory**: Where slide images are saved
- **Top/Bottom Crop (%)**: Percentage to remove from the top and bottom of the image
- **Auto-crop guides if URL contains**: Automatically show cropping guides when the URL contains this text
- **Change Threshold**: Threshold for detecting slide changes, smaller values are more sensitive (recommended 0.001-0.005)
- **Check Interval**: Frequency to check for slide changes (in seconds)

### Element Blocking Rules
Use AdGuard-like syntax to hide unwanted elements:

```
yanhekt.cn###root > div.app > div.sidebar-open:first-child
yanhekt.cn###root > div.app > div.BlankLayout_layout__kC9f3:last-child > div.ant-spin-nested-loading:nth-child(2) > div.ant-spin-container > div.index_liveWrapper__YGcpO > div.index_userlist__T-6xf:last-child > div.index_staticContainer__z3yt-
yanhekt.cn###ai-bit-shortcut
```

## Troubleshooting
- **Slides not captured**: Try lowering the "Change Threshold" value
- **Security warning on macOS**: Use the `sudo xattr -d com.apple.quarantine` command mentioned in installation
- **Performance issues**: Increase the "Check Interval" value

# AutoSlides_selenium (Command Line Version)

## Introduction
- **Automatic Screenshots**: Monitors the first tab of the Chrome browser, detects slide changes and saves screenshots.
- **Custom Configuration**: Adjust save path, cropping area, detection threshold, etc. through `config.ini`.
- **Element Blocking**: Hide specified elements on the webpage through `block_rules.txt`.

## System Requirements
- **Operating System**: macOS.
- **Browser**: Google Chrome.

## Installation
1. **Download Distribution Package**:
   - Get the distribution package (`AutoSlides-selenium-1.2.0-macOS.zip`), which contains the following files:

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