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