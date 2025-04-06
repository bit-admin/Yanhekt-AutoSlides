# AutoSlides

[**中文版本**](README.md) 👈 Click here for Chinese

`AutoSlides` is a tool that automatically captures slides from web pages, monitoring content changes and saving screenshots of new slides. Designed specifically for BIT YanHeKT classroom, but compatible with various live/recorded learning platforms.
- Based on Electron framework
- Supports Windows/macOS
- Optimized for YanHeKT classroom

## Introduction

AutoSlides is an intelligent screenshot tool designed for online education, capable of automatically detecting and capturing slide changes, saving them as high-quality PNG images. The software employs advanced image comparison algorithms to accurately identify real content changes while avoiding false triggers caused by video noise, comments, or interface elements.

Main application scenarios:
- Automatically save each slide during online course playback
- Capture teaching materials in real-time during live courses
- Batch process multiple course videos and extract all slides

## Installation

### macOS
1. Download the latest version from the release page according to your processor architecture:
   - Macs with Apple Silicon (M1/M2/M3/M4) processors: Download `AutoSlide-macOS-arm64.dmg`
   - Macs with Intel processors: Download `AutoSlides-macOS-x86_64.dmg`
2. Open the DMG file and drag AutoSlides to the Applications folder
3. When running the application for the first time, you may receive a security warning. To bypass this warning, execute the following command:
   ```bash
   sudo xattr -d com.apple.quarantine /Applications/AutoSlides.app
   ```
4. You can now open AutoSlides from the Applications folder or Launchpad

### Windows
1. Download the latest installer from the release page according to your processor architecture:
   - ARM processors: Download `AutoSlides--Windows-arm64.7z`
   - Intel/AMD processors: Download `AutoSlides-Windows-x64.7z`
2. Extract and run `AutoSlides.exe`.

## Usage

### Basic Features
1. **Web Page Loading**: Enter the video URL or select a course directly from the homepage
2. **Start Capturing**: Click the "Start Capture" button, and the software will automatically monitor video content changes
3. **Slide Saving**: When a new slide is detected, it will be automatically captured and saved to the specified folder
4. **Automatic Naming**: Files are automatically organized and named according to timestamp and course name

### Advanced Features
1. **Course Management**:
   - Automatically detect YanHeKT classroom course list
   - Support bulk addition of recorded or live courses to the task queue
   - Task queue management and automatic processing

2. **Automation Options**:
   - Automatically detect video end and stop capturing
   - Automatically start playing videos
   - Automatically adjust playback speed (up to 4x speed)
   - Automatically detect and extract course title information
   - Automatically retry error playback

3. **Fast Mode**:
   - When enabled, automatically plays recorded content at 4x speed
   - Shortens check intervals to improve capture efficiency
   - Automatically resets playback progress

4. **Image Processing Options**:
   - Top/bottom crop percentage adjustment
   - Support for switching between multiple image comparison algorithms
   - Double verification mechanism to avoid erroneous captures

5. **Interface Optimization**:
   - Custom element blocking rules
   - Automatic mute option
   - Dark mode interface support

6. **Cache Management**:
   - One-click browser cache cleaning
   - Automatic cleaning of timed-out cache
   - Display current cache size

## Configuration Options

### Basic Settings
- **Output Directory**: Set the location to save slides
- **Check Interval**: Adjust the frequency of content change detection (seconds)
- **Site Profiles**: Capture configuration profiles for different websites

### Image Capture Strategy
- **Crop Percentage**: Set the percentage of top and bottom to be cropped
- **Comparison Method**: Choose between basic mode or advanced perceptual hash mode
- **Enable Double Verification**: Requires changes to be detected multiple consecutive times before saving, avoiding false triggers

### Automation Settings
- **Detect End**: Automatically identify video playback end and stop capturing
- **Auto Playback**: Automatically click play button to start video
- **Speed Adjustment**: Automatically set video playback speed
- **Title Detection**: Automatically identify and extract course title information

### Batch Processing Options
- **Fast Mode**: Maximize the acceleration of recorded content processing
- **Reset Progress**: Automatically reset playback progress to avoid skipping content
- **Auto Mute**: Mute playback during processing

## Technical Implementation

### Image Comparison Algorithms
AutoSlides employs a multi-level image comparison strategy to ensure accurate capture of content changes:

1. **Perceptual Hash (pHash)**:
   - Computes DCT transform after scaling images to uniform size
   - Extracts low-frequency coefficients to generate image fingerprints
   - Compares image similarity through Hamming distance
   - Highly robust against video noise and compression artifacts

2. **Structural Similarity Index (SSIM)**:
   - Compares image brightness, contrast, and structural information
   - Evaluates structural changes by calculating covariance
   - Better perceptual ability for subtle image changes

3. **Gaussian Blur Preprocessing**:
   - Applies Gaussian blur to reduce image noise
   - Adjustable sigma value to control blur intensity
   - Filters out irrelevant minor changes

4. **Grayscale Conversion**:
   - Converts RGB images to grayscale, reducing computational load
   - Preserves image structure and brightness information while ignoring color changes

5. **Threshold Adjustment**:
   - Customizable pixel difference threshold
   - Change ratio threshold controls trigger sensitivity
   - Supports global or regional change detection

### Web Optimization Techniques
1. **Element Interception**:
   - Custom CSS selector rules to block interfering elements
   - Adapted to specific interface elements of YanHeKT classroom
   - Dynamic injection of CSS and JavaScript for instant blocking

2. **Link Redirection**:
   - Intercepts new window opening behavior
   - Modifies target="_blank" links for same-window navigation
   - Prevents page jumps from interrupting capture

3. **API Integration**:
   - Integrates with YanHeKT classroom API to obtain course information
   - Supports progress reset and session data extraction
   - Maintains user authentication state

### Cache and Performance Optimization
1. **Timed Cache Cleaning**:
   - Automatically cleans browser cache to prevent memory leaks
   - Configurable cleaning intervals
   - Supports selective cleaning of different types of cache data

2. **Parallel Processing**:
   - Separates UI and background tasks using main process and render process
   - Image processing does not block user interface responsiveness
   - Implements efficient multi-task queue processing

3. **Resource Conservation**:
   - Automatic muting reduces audio processing overhead
   - Dark mode reduces screen energy consumption
   - Prevents system sleep during background operation

## Troubleshooting
- **Slides not captured**: Try lowering the "Change Threshold" value
- **Security warning on macOS**: Use the `sudo xattr -d com.apple.quarantine` command mentioned in the installation
- **Performance issues**: Increase the "Check Interval" value
- **Recorded videos won't play**: Enable the "Reset Playback Progress" option
- **Interface elements interfering**: Use custom blocking rules to remove interfering elements
- **Task queue stuck**: Enable "Auto Retry Error" and increase maximum retry attempts

