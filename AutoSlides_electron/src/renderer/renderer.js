// First declare all your DOM element variables
document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  const webview = document.getElementById('slideWebview');
  const btnStartCapture = document.getElementById('btnStartCapture');
  const btnStopCapture = document.getElementById('btnStopCapture');
  const btnLoadUrl = document.getElementById('btnLoadUrl');
  const btnSelectDir = document.getElementById('btnSelectDir');
  const btnSaveConfig = document.getElementById('btnSaveConfig');
  const btnDefaultConfig = document.getElementById('btnDefaultConfig');
  const inputUrl = document.getElementById('inputUrl');
  const inputOutputDir = document.getElementById('inputOutputDir');
  const inputTopCrop = document.getElementById('inputTopCrop');
  const inputBottomCrop = document.getElementById('inputBottomCrop');
  const inputChangeThreshold = document.getElementById('inputChangeThreshold');
  const inputCheckInterval = document.getElementById('inputCheckInterval');
  const statusText = document.getElementById('statusText');
  const slideCount = document.getElementById('slideCount');
  const blockingRules = document.getElementById('blockingRules');
  const btnApplyRules = document.getElementById('btnApplyRules');
  const btnResetRules = document.getElementById('btnResetRules');
  const topCropGuide = document.getElementById('topCropGuide');
  const bottomCropGuide = document.getElementById('bottomCropGuide');
  const cropGuides = document.querySelector('.crop-guides');
  const cropInfoOverlay = document.getElementById('cropInfoOverlay');
  const btnShowCropGuides = document.getElementById('btnShowCropGuides');
  const inputCropGuidesTrigger = document.getElementById('inputCropGuidesTrigger');

  // Capture related variables
  let captureInterval = null;
  let lastImageData = null;
  let capturedCount = 0;
  let cropGuideTimer = null;

  // Default rules
  const DEFAULT_RULES = `yanhekt.cn###root > div.app > div.sidebar-open:first-child
yanhekt.cn###root > div.app > div.BlankLayout_layout__kC9f3:last-child > div.ant-spin-nested-loading:nth-child(2) > div.ant-spin-container > div.index_liveWrapper__YGcpO > div.index_userlist__T-6xf:last-child > div.index_staticContainer__z3yt-
yanhekt.cn###ai-bit-shortcut`;

  // Enhance the blocking rules text area for code-like behavior
  function enhanceBlockingRulesEditor() {
    // Enable tab key in the textarea (instead of changing focus)
    blockingRules.addEventListener('keydown', function(e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        
        // Insert a tab character at the cursor position
        const start = this.selectionStart;
        const end = this.selectionEnd;
        
        this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
        
        // Put the cursor after the tab
        this.selectionStart = this.selectionEnd = start + 4;
      }
    });
  }

  // Add this call after loading the blocking rules
  await loadConfig();
  await loadBlockingRules();
  enhanceBlockingRulesEditor();
  
  // Set default URL
  inputUrl.value = 'https://www.yanhekt.cn/home';
  
  // Load default URL when app starts
  setTimeout(() => {
    const defaultUrl = 'https://www.yanhekt.cn/home';
    
    // Only set if not already set
    if (webview.src === 'about:blank' || !webview.src) {
      webview.src = defaultUrl;
      inputUrl.value = defaultUrl;
      statusText.textContent = 'Loading default URL...';
    }
  }, 200);

  setInterval(() => {
    if (webview.src && webview.src !== 'about:blank' && webview.src !== inputUrl.value) {
      inputUrl.value = webview.src;
      
      // Check for trigger
      if (checkUrlForCropGuidesTrigger(webview.src)) {
        console.log('URL contains crop guides trigger (periodic check), showing guides');
        updateCropGuides(true);
      }
    }
  }, 1000);

  // Function definitions
  function loadURL() {
    const url = inputUrl.value;
    if (url) {
      const loaded = safeLoadURL(url);
      if (loaded && checkUrlForCropGuidesTrigger(url)) {
        setTimeout(() => updateCropGuides(), 1000);
      }
    }
  }

  function safeLoadURL(url) {
    if (url && typeof url === 'string' && url.trim() !== '') {
      try {
        // Basic URL validation
        new URL(url); // This will throw if URL is invalid
        
        console.log('Loading URL:', url);
        // Use src for consistency instead of mixing src and loadURL
        webview.src = url;
        return true;
      } catch (error) {
        console.error('Invalid URL:', url, error);
        statusText.textContent = 'Invalid URL format';
        return false;
      }
    } else {
      console.warn('Attempted to load empty URL');
      return false;
    }
  }
  
  async function loadConfig() {
    try {
      const config = await window.electronAPI.getConfig();
      inputOutputDir.value = config.outputDir || '';
      inputTopCrop.value = config.topCropPercent || 5;
      inputBottomCrop.value = config.bottomCropPercent || 5;
      inputChangeThreshold.value = config.changeThreshold || 0.001;
      inputCheckInterval.value = config.checkInterval || 2;
      inputCropGuidesTrigger.value = config.cropGuidesTrigger || 'session';
      return config;
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }
  
  async function saveConfig() {
    try {
      const config = {
        outputDir: inputOutputDir.value,
        topCropPercent: parseFloat(inputTopCrop.value),
        bottomCropPercent: parseFloat(inputBottomCrop.value),
        changeThreshold: parseFloat(inputChangeThreshold.value),
        checkInterval: parseFloat(inputCheckInterval.value),
        cropGuidesTrigger: inputCropGuidesTrigger.value
      };
      
      await window.electronAPI.saveConfig(config);
      statusText.textContent = 'Settings saved';
      setTimeout(() => {
        statusText.textContent = captureInterval ? 'Capturing...' : 'Idle';
      }, 2000);
    } catch (error) {
      console.error('Failed to save config:', error);
      statusText.textContent = 'Error saving settings';
    }
  }

  async function resetConfigToDefaults() {
    // Default values from schema in main.js
    const defaultConfig = {
      outputDir: await window.electronAPI.getConfig().then(config => config.outputDir), // Keep output dir as is
      topCropPercent: 5,
      bottomCropPercent: 5,
      changeThreshold: 0.001,
      checkInterval: 2,
      cropGuidesTrigger: 'session'
    };
    
    // Update input fields
    inputTopCrop.value = defaultConfig.topCropPercent;
    inputBottomCrop.value = defaultConfig.bottomCropPercent;
    inputChangeThreshold.value = defaultConfig.changeThreshold;
    inputCheckInterval.value = defaultConfig.checkInterval;
    inputCropGuidesTrigger.value = defaultConfig.cropGuidesTrigger;
    
    // Save to config
    await window.electronAPI.saveConfig(defaultConfig);
    statusText.textContent = 'Settings reset to defaults';
    setTimeout(() => {
      statusText.textContent = captureInterval ? 'Capturing...' : 'Idle';
    }, 2000);
  }
  
  async function loadBlockingRules() {
    try {
      const rules = await window.electronAPI.getBlockingRules();
      blockingRules.value = rules || DEFAULT_RULES;
    } catch (error) {
      console.error('Failed to load blocking rules:', error);
      blockingRules.value = DEFAULT_RULES;
    }
  }

  // Function to update the crop guide positions
  function updateCropGuides(isAutomatic = false) {
    // Get webview dimensions
    const webviewHeight = webview.clientHeight;
    
    // Calculate guide positions based on crop percentages
    const topCropPercent = parseFloat(inputTopCrop.value) || 0;
    const bottomCropPercent = parseFloat(inputBottomCrop.value) || 0;
    
    // Calculate pixel positions
    const topPosition = Math.floor(webviewHeight * (topCropPercent / 100));
    const bottomPosition = Math.floor(webviewHeight * (1 - bottomCropPercent / 100));
    
    // Update guide positions
    topCropGuide.style.top = `${topPosition}px`;
    bottomCropGuide.style.top = `${bottomPosition}px`;
    
    // Update info overlay with current crop percentages
    cropInfoOverlay.textContent = `Crop: Top ${topCropPercent}%, Bottom ${bottomCropPercent}%`;
    
    // Show the guides
    cropGuides.classList.add('visible');
    
    // Clear any existing timer
    if (cropGuideTimer) {
      clearTimeout(cropGuideTimer);
    }
    
    // Set timer to hide guides - 6 seconds for automatic triggers, 3 seconds for manual
    const hideDelay = isAutomatic ? 6000 : 3000;
    cropGuideTimer = setTimeout(() => {
      cropGuides.classList.remove('visible');
      if (btnShowCropGuides.textContent === 'Hide Crop Guides') {
        btnShowCropGuides.textContent = 'Show Crop Guides';
      }
    }, hideDelay);
  }

  function checkUrlForCropGuidesTrigger(url) {
    try {
      if (!url) {
        console.log('No URL to check for crop guides trigger');
        return false;
      }
      
      const trigger = inputCropGuidesTrigger.value.trim();
      if (!trigger) {
        console.log('No trigger defined for crop guides');
        return false;
      }
      
      // Check if URL contains the trigger string (case insensitive)
      const result = url.toLowerCase().includes(trigger.toLowerCase());
      console.log(`Checking if URL "${url}" contains trigger "${trigger}": ${result}`);
      return result;
    } catch (error) {
      console.error('Error checking URL for crop guides trigger:', error);
      return false;
    }
  }
  
  async function saveBlockingRules() {
    try {
      await window.electronAPI.saveBlockingRules(blockingRules.value);
      statusText.textContent = 'Blocking rules saved';
      setTimeout(() => {
        statusText.textContent = captureInterval ? 'Capturing...' : 'Idle';
      }, 2000);
    } catch (error) {
      console.error('Failed to save blocking rules:', error);
    }
  }
  
  function applyBlockingRules() {
    const rules = blockingRules.value.trim().split('\n');
    if (!webview.src || webview.src === 'about:blank') {
      statusText.textContent = 'No page loaded to apply rules';
      return;
    }
    
    try {
      const currentUrl = new URL(webview.src);
      const currentDomain = currentUrl.hostname;
      
      let cssToInject = '';
      let appliedRules = 0;
      
      rules.forEach(rule => {
        if (!rule || rule.startsWith('#')) return; // Skip empty lines or comments
        
        const parts = rule.split('##');
        if (parts.length !== 2) return; // Skip invalid rules
        
        const ruleDomain = parts[0];
        const selector = parts[1];
        
        // Check if rule applies to current domain
        if (currentDomain.endsWith(ruleDomain) || 
            currentDomain === `www.${ruleDomain}` ||
            ruleDomain === '*') {
          cssToInject += `${selector} { display: none !important; }\n`;
          appliedRules++;
        }
      });
      
      if (cssToInject) {
        // Inject both CSS and JavaScript to ensure elements are hidden
        const script = `
          (function() {
            // 1. Add CSS style
            const style = document.createElement('style');
            style.id = 'autoslides-blocking-css';
            style.textContent = ${JSON.stringify(cssToInject)};
            
            // Remove any existing style we added before
            const existingStyle = document.getElementById('autoslides-blocking-css');
            if (existingStyle) {
              existingStyle.remove();
            }
            
            document.head.appendChild(style);
            
            // 2. Also use JavaScript to directly hide elements for more aggressive hiding
            function hideElements() {
              const selectors = [${rules
                .filter(rule => rule && !rule.startsWith('#'))
                .map(rule => {
                  const parts = rule.split('##');
                  if (parts.length !== 2) return null;
                  return JSON.stringify(parts[1]);
                })
                .filter(Boolean)
                .join(', ')}];
                
              selectors.forEach(selector => {
                try {
                  const elements = document.querySelectorAll(selector);
                  elements.forEach(el => {
                    el.style.display = 'none';
                  });
                } catch (e) {
                  console.error('Error hiding element with selector: ' + selector, e);
                }
              });
            }
            
            // Run now
            hideElements();
            
            // Also run again after a short delay to catch elements that might load later
            setTimeout(hideElements, 1000);
            
            console.log('AutoSlides: Applied element blocking rules');
          })();
        `;
        
        webview.executeJavaScript(script)
          .then(() => {
            statusText.textContent = `Applied ${appliedRules} blocking rules`;
            setTimeout(() => {
              statusText.textContent = captureInterval ? 'Capturing...' : 'Idle';
            }, 2000);
          })
          .catch(err => {
            console.error('Error applying blocking rules:', err);
            statusText.textContent = 'Error applying rules';
          });
      } else {
        statusText.textContent = 'No applicable rules for current page';
        setTimeout(() => {
          statusText.textContent = captureInterval ? 'Capturing...' : 'Idle';
        }, 2000);
      }
    } catch (error) {
      console.error('Error in applyBlockingRules:', error);
      statusText.textContent = 'Error processing rules';
    }
  }
  
  function resetRules() {
    blockingRules.value = DEFAULT_RULES;
    saveBlockingRules();
    applyBlockingRules();
  }
  
  async function selectOutputDirectory() {
    try {
      const directory = await window.electronAPI.selectOutputDirectory();
      inputOutputDir.value = directory;
    } catch (error) {
      console.error('Failed to select directory:', error);
    }
  }
  
  // Capture screenshot from webview
  function captureScreenshot() {
    return new Promise((resolve) => {
      webview.capturePage().then(image => {
        resolve(image.toDataURL());
      });
    });
  }

  // Crop image based on current settings
  function cropImage(imageData) {
    return new Promise((resolve) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const topCrop = Math.floor(img.height * (parseFloat(inputTopCrop.value) / 100));
        const bottomCrop = Math.floor(img.height * (1 - parseFloat(inputBottomCrop.value) / 100));
        
        // Set canvas size to the cropped dimensions
        canvas.width = img.width;
        canvas.height = bottomCrop - topCrop;
        
        // Draw the cropped portion of the image
        ctx.drawImage(
          img, 
          0, topCrop,                 // Source x, y
          img.width, bottomCrop - topCrop, // Source width, height
          0, 0,                       // Destination x, y
          canvas.width, canvas.height // Destination width, height
        );
        
        // Get the cropped image as data URL
        resolve(canvas.toDataURL('image/png'));
      };
      
      img.onerror = () => {
        console.error('Error loading image for cropping');
        resolve(imageData); // Return original if there's an error
      };
      
      img.src = imageData;
    });
  }
  
  // Compare images for changes
  function compareImages(img1Data, img2Data) {
    return new Promise((resolve) => {
      const img1 = new Image();
      const img2 = new Image();
      let loadedCount = 0;

      function processImages() {
        if (loadedCount === 2) {
          const canvas1 = document.createElement('canvas');
          const canvas2 = document.createElement('canvas');
          const ctx1 = canvas1.getContext('2d');
          const ctx2 = canvas2.getContext('2d');

          canvas1.width = img1.width;
          canvas1.height = img1.height;
          canvas2.width = img2.width;
          canvas2.height = img2.height;

          const topCrop = Math.floor(img1.height * (parseFloat(inputTopCrop.value) / 100));
          const bottomCrop = Math.floor(img1.height * (1 - parseFloat(inputBottomCrop.value) / 100));

          ctx1.drawImage(img1, 0, topCrop, img1.width, bottomCrop - topCrop, 0, 0, img1.width, bottomCrop - topCrop);
          ctx2.drawImage(img2, 0, topCrop, img2.width, bottomCrop - topCrop, 0, 0, img2.width, bottomCrop - topCrop);

          const data1 = ctx1.getImageData(0, 0, canvas1.width, canvas1.height);
          const data2 = ctx2.getImageData(0, 0, canvas2.width, canvas2.height);

          let diffCount = 0;
          const threshold = 30; // Pixel difference threshold
          
          for (let i = 0; i < data1.data.length; i += 4) {
            const r1 = data1.data[i];
            const g1 = data1.data[i + 1];
            const b1 = data1.data[i + 2];
            
            const r2 = data2.data[i];
            const g2 = data2.data[i + 1];
            const b2 = data2.data[i + 2];
            
            const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
            if (diff > threshold) {
              diffCount++;
            }
          }

          const totalPixels = (canvas1.width * canvas1.height);
          const changeRatio = diffCount / totalPixels;
          
          resolve({
            changed: changeRatio > parseFloat(inputChangeThreshold.value),
            changeRatio
          });
        }
      }

      img1.onload = () => {
        loadedCount++;
        processImages();
      };
      
      img2.onload = () => {
        loadedCount++;
        processImages();
      };

      img1.src = img1Data;
      img2.src = img2Data;
    });
  }

  // Format date as local timestamp string suitable for filenames
  function formatLocalTimestamp() {
    const now = new Date();
    
    // Get local date components
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    // Format as YYYY-MM-DD_HH-MM-SS
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  }
  
  // Start capturing slides
  async function startCapture() {
    const url = inputUrl.value;
    if (!url) {
      statusText.textContent = 'Please enter a URL';
      return;
    }

    // Only load the URL if webview is empty or about:blank
    if (webview.src === 'about:blank' || !webview.src) {
      webview.src = url;
    }
    
    btnStartCapture.disabled = true;
    btnStopCapture.disabled = false;
    statusText.textContent = 'Capturing...';
    
    // Capture first slide
    try {
      // Use local timestamp instead of ISO string
      const timestamp = formatLocalTimestamp();
      const fullImageData = await captureScreenshot();
      
      // Store the uncropped image for comparison
      lastImageData = fullImageData;
      
      // Crop the image before saving
      const croppedImageData = await cropImage(fullImageData);
      
      await window.electronAPI.saveSlide({ imageData: croppedImageData, timestamp });
      capturedCount++;
      slideCount.textContent = `Slides captured: ${capturedCount}`;
      
      // Start interval for checking slide changes
      captureInterval = setInterval(async () => {
        const currentFullImageData = await captureScreenshot();
        const result = await compareImages(lastImageData, currentFullImageData);
        
        if (result.changed) {
          // Use local timestamp for each new slide
          const timestamp = formatLocalTimestamp();
          
          // Store the uncropped image for future comparisons
          lastImageData = currentFullImageData;
          
          // Crop the image before saving
          const croppedImageData = await cropImage(currentFullImageData);
          
          await window.electronAPI.saveSlide({ imageData: croppedImageData, timestamp });
          capturedCount++;
          slideCount.textContent = `Slides captured: ${capturedCount}`;
          console.log(`Saved new slide (change ratio: ${result.changeRatio.toFixed(4)})`);
        }
      }, parseFloat(inputCheckInterval.value) * 1000);
    } catch (error) {
      console.error('Error starting capture:', error);
      statusText.textContent = 'Error: ' + error.message;
    }
  }
  
  // Stop capturing slides
  function stopCapture() {
    if (captureInterval) {
      clearInterval(captureInterval);
      captureInterval = null;
      btnStartCapture.disabled = false;
      btnStopCapture.disabled = true;
      statusText.textContent = 'Capture stopped';
    }
  }
  
  // Set event listeners for page loading
  webview.addEventListener('did-start-loading', () => {
    statusText.textContent = 'Loading page...';
  });
  
  webview.addEventListener('did-finish-load', () => {
    // Update URL field
    if (webview.src) {
      inputUrl.value = webview.src;
    }
    
    statusText.textContent = 'Page loaded, applying rules...';
    // Short delay to ensure page is fully rendered
    setTimeout(() => {
      applyBlockingRules();
      
      // Check URL for trigger after loading is complete
      if (checkUrlForCropGuidesTrigger(webview.src)) {
        console.log('URL contains crop guides trigger after page load, showing guides');
        updateCropGuides(true);
      }
    }, 500);
  });
  
  webview.addEventListener('did-fail-load', (event) => {
    if (event.errorCode !== -3) { // Ignore aborted loads
      statusText.textContent = `Load failed: ${event.errorDescription}`;
    }
  });

  // Also intercept links that try to open in a new frame
  webview.addEventListener('will-navigate', (e) => {
    statusText.textContent = 'Navigating...';
  });

  webview.addEventListener('did-navigate', (e) => {
    // Update URL field
    inputUrl.value = e.url;
    statusText.textContent = 'Page loaded';
    
    // Check if URL matches trigger
    if (checkUrlForCropGuidesTrigger(e.url)) {
      console.log('URL contains crop guides trigger in did-navigate, showing guides');
      setTimeout(() => updateCropGuides(true), 500); // true = automatic trigger
    }
  });

  // Add event listener for in-page navigation (hash changes, etc)
  webview.addEventListener('did-navigate-in-page', (e) => {
    if (e.isMainFrame && e.url) {
      inputUrl.value = e.url;
      
      // Check if URL matches trigger
      if (checkUrlForCropGuidesTrigger(e.url)) {
        console.log('URL contains crop guides trigger in did-navigate-in-page, showing guides');
        setTimeout(() => updateCropGuides(true), 500);
      }
    }
  });
  
  webview.addEventListener('new-window', (e) => {
    e.preventDefault();
    if (e.url) {
      console.log('Intercepted new window:', e.url);
      safeLoadURL(e.url);
    }
  });
  
  // Inject a simpler but more robust script for handling links
  webview.addEventListener('dom-ready', () => {
    webview.executeJavaScript(`
      (function() {
        // Only set up once
        if (window._autoSlidesLinkHandlerInstalled) return;
        window._autoSlidesLinkHandlerInstalled = true;
        
        // Override window.open
        const originalWindowOpen = window.open;
        window.open = function(url, name, features) {
          if (url) {
            console.log('Intercepted window.open:', url);
            // Use location.href to navigate in the same window
            setTimeout(() => location.href = url, 0);
            
            // Return a mock window object
            return {
              closed: false,
              close: function() {},
              focus: function() {},
              document: document
            };
          }
          return null;
        };
        
        // Handle target="_blank" links
        document.addEventListener('click', function(event) {
          const link = event.target.closest('a');
          if (!link) return;
          
          // Handle _blank links or cmd/ctrl+click
          if (link.target === '_blank' || event.ctrlKey || event.metaKey) {
            event.preventDefault();
            event.stopPropagation();
            
            if (link.href) {
              console.log('Intercepted link click:', link.href);
              location.href = link.href;
            }
          }
        }, true);
      })();
    `).catch(err => console.error('Error injecting link handler:', err));
  });

  // Add event listeners to crop input fields
  inputTopCrop.addEventListener('input', () => updateCropGuides(false));
  inputBottomCrop.addEventListener('input', () => updateCropGuides(false));

  // Also show guides when focusing the inputs
  inputTopCrop.addEventListener('focus', () => updateCropGuides(false));
  inputBottomCrop.addEventListener('focus', () => updateCropGuides(false));

  // Update guides if webview size changes (e.g., when window is resized)
  window.addEventListener('resize', () => {
    if (cropGuides.classList.contains('visible')) {
      updateCropGuides();
    }
  });

  // Initialize guides after webview loads
  webview.addEventListener('dom-ready', () => {
    // Give webview time to settle and get correct dimensions
    setTimeout(() => {
      // ONLY show guides if URL matches trigger
      if (checkUrlForCropGuidesTrigger(webview.src)) {
        console.log('URL contains crop guides trigger, showing guides');
        updateCropGuides();
      }
    }, 1000);
  });

  // Add event listener for the show guides button
  btnShowCropGuides.addEventListener('click', () => {
    updateCropGuides(false);
    
    // Toggle button text
    if (cropGuides.classList.contains('visible')) {
      btnShowCropGuides.textContent = 'Show Crop Guides';
    } else {
      btnShowCropGuides.textContent = 'Hide Crop Guides';
    }
  });

  // Add event listeners for all buttons
  btnStartCapture.addEventListener('click', startCapture);
  btnStopCapture.addEventListener('click', stopCapture);
  btnLoadUrl.addEventListener('click', loadURL);
  btnSelectDir.addEventListener('click', selectOutputDirectory);
  btnSaveConfig.addEventListener('click', saveConfig);
  btnDefaultConfig.addEventListener('click', resetConfigToDefaults);
  btnApplyRules.addEventListener('click', () => {
    saveBlockingRules();
    applyBlockingRules();
  });
  btnResetRules.addEventListener('click', resetRules);
  
  // Add enter key handling for URL input
  inputUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      loadURL();
    }
  });
});