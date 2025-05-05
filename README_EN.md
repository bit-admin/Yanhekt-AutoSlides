# AutoSlides

[**中文版本**](README.md) 👈 Click here for Chinese

`AutoSlides` is a tool that automatically captures slides from webpages, monitoring content changes and saving screenshots of new slides. Specifically designed for BIT Yanhe Classroom, it's compatible with various live/recorded streaming platforms.
- Based on Electron framework
- Supports Windows/macOS
- Specially optimized for Yanhe Classroom

## Introduction

AutoSlides automatically detects and captures slide changes, saving them as high-quality PNG images. The software employs advanced image comparison algorithms to accurately identify genuine content changes, avoiding false triggers caused by video noise, danmu (comments), or interface elements.

It can also work with other projects:
- AutoSlides project is based on "detection during playback," so downloading the original video files is unnecessary.
- [Yanhekt Downloader](https://github.com/bit-admin/Yanhekt-downloader-electron) is an Electron-based Yanhe Classroom video downloader that allows you to download courses locally.
- [AutoSlides Extractor](https://github.com/bit-admin/AutoSlides-extractor) tool can automatically extract slides from downloaded videos and save them as images.

## Installation

### macOS

1. Go to the Releases page to download the latest version
2. Download the latest `.dmg` file for your architecture (Intel `x64` or Apple Silicon `arm64`) (e.g., `AutoSlide-1.0.0-macOS-arm64.dmg`)
3. Open the `.dmg` file and drag the application to the `Applications` folder
4. When running the application for the first time, you may receive a security warning. To bypass this warning, execute the following command:
   ```bash
   sudo xattr -d com.apple.quarantine /Applications/AutoSlides.app
   ```
5. Now you can launch the application from `Applications`

### Windows

1. Go to the Releases page to download the latest version
2. Download the latest `.exe` installer for your architecture (usually `x64`) (e.g., `AutoSlide-Setup-1.0.0-Windows-x64.exe`)
3. Run the installer and follow the wizard to complete installation
4. You can choose installation path, whether to create desktop shortcuts, etc.
5. After installation, launch the application from the Start menu or desktop shortcut

### Version Selection

Starting from version 3.3.0, the official releases (e.g., 3.3.0) will only include AutoSlides, while pre-release versions (e.g., 3.3.1-beta) will be bundled versions including AutoSlides, Yanhekt Downloader, and AutoSlides Extractor. You can download according to your needs.

## How to Use

### Basic Functions
1. **Webpage Loading**: Enter the video URL or choose a course directly from the homepage
2. **Start Capturing**: Click the "Start Capture" button, and the software will automatically monitor video content changes
3. **Slide Saving**: When a new slide is detected, it will automatically take a screenshot and save it to the specified folder
4. **Automatic Naming**: Files are automatically organized and named according to timestamps and course names
5. **Capture Settings**: Choose a strategy group and adjust capture frequency
6. **Language Selection**: Supports English, Simplified Chinese, Traditional Chinese (adjust language settings in Menu Bar > Options/On Mac "AutoSlides" > Preferences, default is English)

### Advanced Functions
1. **Course Management**:

Based on optimized configuration files for Yanhe Classroom, when opening a Yanhe Classroom course website, you can:
   - Automatically detect Yanhe Classroom course lists
   - Automatically inject "Add to Task" buttons in the webpage
   - Support batch adding recorded or live courses to the task queue
   - Task queue management and automatic processing

2. **Automation Options**:

When the optimized configuration file is enabled, the following features will be enabled by default except for automatic playback speed adjustment:
   - Automatically detect video end and stop capturing
   - Automatically start playing the video
   - Automatically adjust playback speed (can exceed website limits, up to 5x speed)
   - Automatically detect and extract course title information
   - Automatically retry on playback errors

3. **Task Management and Quick Mode**:

Quick mode can be enabled when managing tasks with the task manager, but due to Yanhe Classroom optimization and network speed issues, stuttering playback may cause some errors or omissions. If you have poor network conditions, you can use the "Automatic Playback Speed Adjustment" feature (adjust specific speed in Menu Bar > Options/On Mac "AutoSlides" > Preferences, e.g., set to 3x speed); or you can also use companion projects to download course videos.
   - Automatically plays recorded content at 4x speed when enabled
   - Reduces check interval to 0.5 seconds to improve capture efficiency
   - Can automatically reset playback progress
   - Can automatically mute playback

4. **Image Processing Options**:

When the optimized configuration file for Yanhe Classroom websites is enabled, it will only capture specific elements (course screen recording) without requiring any adjustments from you. Just keep the default playback settings.
   - In webpage capture configuration, you can adjust top/bottom cropping percentages
   - Supports multiple image comparison algorithm strategy groups
   - Dual verification mechanism to avoid false captures (we assume that the presenter will stay on slides for a certain time to explain, so we will only capture "stable" slides)

5. **Interface Optimization**:
   - Custom element blocking rules
   - Dark mode interface support
   - An elegant homepage

6. **Cache Management**:
   - One-click browser cache cleaning
   - Periodic automatic cache cleaning
   - Display current cache size

7. **Remote Management**:

After enabling remote management in preferences, you can remotely manage from within your local network using your machine's IP address and the set port (default is 11150). This is convenient if you want to leave your computer in your dormitory and only need to connect to the same campus network (or use a personal VPN like `Tailscale`) to manage it.
   - You can test by entering `localhost:11150` in your browser
   - Optimized for mobile devices
   - Requires logging into Yanhe Classroom first in the main AutoSlides program, cannot log in remotely
   - Communicates with Yanhe Classroom servers by sending API requests to get detailed course information and add to task list
   - Can view task status in real-time by refreshing the webpage

## Configuration Options

The software comes with a separate preferences interface, accessible via Menu Bar > Options / On Mac "AutoSlides" > Preferences.

### Basic Settings
- **Output Directory**: Set where slides are saved
- **Check Interval**: Adjust the frequency of content change detection (in seconds)
- **Website Configuration**: Capture configuration files for different websites (can switch automatically)
- **Appearance, Language, Background Running**: Set the basic style of the program; background running will try to prevent system sleep (may work well for devices that don't shut down)

### Image Capture Strategy
- **Crop Percentage**: Set the percentage to crop from the top and bottom
- **Strategy Group**: Choose basic mode or default mode (perceptual hash and structural similarity index mode)
- **Enable Double Verification**: Requires multiple consecutive detections of change before saving, avoiding false triggers

### Automation Settings
- **Detect Playback End**: Automatically identify when video playback ends and stop capturing
- **Auto Play**: Will automatically click the play button to start the video (due to Yanhe Classroom playback interface limitations, auto-play is implemented by simulating clicks on the play button)
- **Auto Wait for Live Start**: Automatically identify countdown and wait for the live course to start
- **Auto Speed Adjustment**: Automatically set video playback speed
- **Auto Title Detection**: Automatically identify and extract course title information (this information is obtained by recognizing webpage content to avoid API response parsing errors, and is used to create subfolders)
- **Auto Error Retry**: Automatically refresh the webpage and retry when playback error elements are detected

### Batch Processing Options
- **Quick Mode**: Maximize acceleration of recorded content processing
- **Reset Progress**: Automatically reset playback progress to avoid skipping content
- **Auto Mute**: Mute playback during processing

## Technical Implementation

### Image Comparison Algorithms
AutoSlides employs a multi-level image comparison strategy to ensure accurate capture of content changes:

- **Basic Mode (`basic`)**: Calculates absolute differences between pixels in two frames. If the number of pixels with differences exceeding `PIXEL_DIFF_THRESHOLD` (default 30) accounts for more than `PIXEL_CHANGE_RATIO_THRESHOLD` (default 0.005) of total pixels, a significant change is considered to have occurred. This method is simple and fast but more sensitive to video noise and subtle changes.
- **Default Mode (`default`)**: Combines perceptual hash (pHash) and structural similarity index (SSIM) for more robust detection.
   - **Perceptual Hash (pHash)**: Converts images to grayscale, scales to small size, performs discrete cosine transform (DCT), calculates median of DCT coefficients, and generates a binary hash fingerprint. By calculating the Hamming distance between two frame pHash fingerprints, content is considered similar if the distance is less than or equal to `HAMMING_THRESHOLD_UP` (default 5). pHash has good robustness to image scaling, slight blurring, brightness adjustments, etc.
   - **Structural Similarity (SSIM)**: Compares two images in terms of luminance, contrast, and structure. The calculated SSIM value ranges from -1 to 1, with values closer to 1 indicating higher similarity. When the SSIM value is greater than or equal to `SSIM_THRESHOLD` (default 0.999), the two frames are considered highly similar in structure. SSIM better matches human perception of image quality.
   - **Decision Logic**: In default mode, potential slide transitions are initially determined only when the pHash Hamming distance is *greater than* the threshold **or** the SSIM value is *less than* the threshold.
- **Secondary Verification (`enableDoubleVerification`)**: To reduce false judgments caused by temporary obstructions (such as mouse pointers or temporary notifications), when this option is enabled and a potential transition is detected, the system caches the current frame. The cached frame is only confirmed as a new slide if subsequent `VERIFICATION_COUNT` (default 2) consecutive frames maintain a sufficiently high similarity to that cached frame (i.e., neither pHash nor SSIM trigger transition conditions again).

## Troubleshooting
- **Slides Not Captured**: Try reducing the capture interval (if using secondary verification, slides need to remain stable for three times this duration to be captured); try adjusting capture thresholds in preferences (not recommended); try disabling quick mode and playing at 1x speed.
- **Security Warnings on macOS**: Use the `sudo xattr -d com.apple.quarantine` command mentioned in the installation section
- **Recorded Videos Won't Play**: Enable the "Reset Playback Progress" option
- **Interface Element Interference**: Use custom blocking rules to remove interfering elements
- **Task Queue Stuck**: Enable "Auto Error Retry" and increase maximum retry count
- **Known Issue - If you leave the playback page and enter another webpage during capture**: This may trigger the error retry feature (no fix planned, so if you need to cancel a task, first manually click "Stop Capture" or exit the application directly)
- **Unknown Software Problems**: Try resetting all data in preferences.

## TERMS AND CONDITIONS​

1. Permitted Use​
The Software is designed exclusively to facilitate the download of course resources from the "Yanhe Classroom" platform ("Platform") of the Beijing Institute of Technology ("BIT"), assisting users in managing and utilizing learning materials within legally authorized boundaries. The Software does not store, modify, or distribute any course content. All downloaded materials originate directly from the Platform.

​2. Intellectual Property Rights​
All course resources on the Platform (including but not limited to videos, documents, images, and audio files) are the intellectual property of their original authors, BIT, or respective rights holders. The Software solely functions as a technical intermediary and assumes no liability for the ownership or licensing status of Platform content. Users shall strictly comply with the Copyright Law of the People's Republic of China, applicable laws, and the Platform’s user agreement and intellectual property policies when utilizing the Software.

​3. User Obligations​
Users shall ensure that their use of the Software adheres to all applicable laws and the Platform’s terms of service. Prohibited activities include, but are not limited to:
	A.	Unauthorized reproduction, distribution, modification, or dissemination of course resources;
	B.	Commercial exploitation, reverse engineering, or unlawful use of downloaded materials;
	C.	Infringement of intellectual property rights or other legal interests of third parties (including BIT, content creators, or rights holders).
	D.	​Users bear sole responsibility​ for any legal disputes or violations arising from misuse of the Software. The Software developer disclaims all liability for consequences resulting from such actions.

​4. LIMITATION OF LIABILITY​
TO THE MAXIMUM EXTENT PERMITTED BY LAW:
	A.	THE SOFTWARE DEVELOPER MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE LEGALITY, COMPLETENESS, ACCURACY, OR AVAILABILITY OF THE PLATFORM OR ITS CONTENT.
	B.	IN NO EVENT SHALL THE SOFTWARE DEVELOPER BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES (INCLUDING DATA LOSS, INTELLECTUAL PROPERTY DISPUTES, OR THIRD-PARTY CLAIMS) ARISING FROM THE USE OF THE SOFTWARE.
	C.	USERS AGREE TO INDEMNIFY AND HOLD HARMLESS THE SOFTWARE DEVELOPER AGAINST ALL LIABILITIES, COSTS, AND EXPENSES RELATED TO THEIR USE OF THE SOFTWARE.