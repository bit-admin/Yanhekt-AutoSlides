const { app, BrowserWindow, ipcMain, dialog, session, Menu, shell, net, webContents, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const { promisify } = require('util');
const fsAccess = promisify(fs.access);
const fsReaddir = promisify(fs.readdir);
const fsStat = promisify(fs.stat);
const fsUnlink = promisify(fs.unlink);
const fsRmdir = promisify(fs.rmdir);
const fetch = require('node-fetch');
const express = require('express');
const http = require('http');
const basicAuth = require('express-basic-auth');
const os = require('os');

// Configuration schema
const schema = {
  outputDir: {
    type: 'string',
    default: path.join(app.getPath('downloads'), 'slides')
  },
  topCropPercent: {
    type: 'number',
    default: 5
  },
  bottomCropPercent: {
    type: 'number',
    default: 5
  },
  checkInterval: {
    type: 'number',
    default: 2
  },
  blockingRules: {
    type: 'string',
    default: `yanhekt.cn###root > div.app > div.sidebar-open:first-child
yanhekt.cn###root > div.app > div.BlankLayout_layout__kC9f3:last-child > div.ant-spin-nested-loading:nth-child(2) > div.ant-spin-container > div.index_liveWrapper__YGcpO > div.index_userlist__T-6xf:last-child > div.index_staticContainer__z3yt-
yanhekt.cn###ai-bit-shortcut
yanhekt.cn##div#ai-bit-animation-modal`
  },
  captureStrategy: {
    type: 'object',
    default: {
      gaussianBlurSigma: 0.5,
      pixelDiffThreshold: 30,
      changeRatioThreshold: 0.005,
      hammingThresholdLow: 0,
      hammingThresholdUp: 5,
      ssimThreshold: 0.999
    }
  },
  cacheCleanInterval: {
    type: 'number',
    default: 15
  },
  siteProfiles: {
    type: 'object',
    default: {
      yanhekt_session: {
        name: 'YanHeKT Session Player',
        elementSelector: '#video_id_topPlayer_html5_api',
        urlPattern: 'yanhekt.cn/session',
        builtin: true,
        automation: {
          autoDetectEnd: true,
          endDetectionSelector: '.player-ended-poster',
          autoStartPlayback: true,
          playButtonSelector: '.player-mid-button-container button',
          countdownSelector: '', // Leave empty for session player
          autoAdjustSpeed: false,  // Enable auto speed adjustment
          speedSelector: '#video_id_mainPlayer_html5_api', // not same as elementSelector
          playbackSpeed: '3.0', // Default to 3x speed
          autoDetectTitle: true, // Enable title detection
          courseTitleSelector: '.ant-breadcrumb li:nth-child(2) a', // Course title selector
          sessionInfoSelector: '.ant-breadcrumb li:nth-child(3) span', // Session info selector
          autoRetryError: true,
          errorSelector: '.vjs-errors-dialog',
          maxRetryAttempts: '30'
        }
      },
      yanhekt_live: {
        name: 'YanHeKT Live Player',
        elementSelector: '#video_id_mainPlayer_html5_api',
        urlPattern: 'yanhekt.cn/live',
        builtin: true,
        automation: {
          autoDetectEnd: true,
          endDetectionSelector: '.VideoResult_result__LdbB3',
          autoStartPlayback: true,
          playButtonSelector: '.player-mid-button-container button',
          countdownSelector: '.countdown-content',
          autoAdjustSpeed: false, // Disabled for live player
          speedSelector: '#video_id_mainPlayer_html5_api', // Same as elementSelector
          playbackSpeed: '1.0', // 1x default speed for live
          autoDetectTitle: true, // Enable title detection
          courseTitleSelector: '.index_liveHeader__uN3uM', // Course title selector
          sessionInfoSelector: '', // No session info for live
          autoRetryError: true,
          errorSelector: '.vjs-errors-dialog',
          maxRetryAttempts: '3'
        }
      }
    }
  },
  activeProfileId: {
    type: 'string',
    default: 'yanhekt_session'  // Change default profile
  },
  allowBackgroundRunning: {
    type: 'boolean',
    default: false
  },
  comparisonMethod: {
    type: 'string',
    default: 'default'
  },
  enableDoubleVerification: {
    type: 'boolean',
    default: true
  },
  fastModeEnabled: {
    type: 'boolean',
    default: false
  },
  resetVideoProgress: {
    type: 'boolean',
    default: true
  },
  darkMode: {
    type: 'string',
    enum: ['system', 'light', 'dark'],
    default: 'system'
}
};

const config = new Store({ schema });

let mainWindow = null;

// Create directory if it doesn't exist
function ensureDirectoryExists(directory) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

function createApplicationMenu() {
  // Template for macOS application menu
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: process.platform === 'darwin' ? 'Cmd+,' : 'Ctrl+,',
          click: () => createPreferencesWindow()
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'AutoSlides Help',
          click: async () => {
            const helpWindow = new BrowserWindow({
              width: 900,
              height: 700,
              webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                preload: path.join(__dirname, 'preload-help.js') // Use our new preload script
              },
              title: 'AutoSlides Help'
            });
            
            helpWindow.loadFile(path.join(__dirname, 'renderer', 'help.html'));
          }
        },
        {
          label: 'Visit GitHub Repository',
          click: async () => {
            await shell.openExternal('https://github.com/bit-admin/Yanhekt-AutoSlides');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Create main window
function createWindow() {
  // Change from const to using the global variable
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true // Enable webview tag
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

let preferencesWindow = null;

function createPreferencesWindow() {
  // If preferences window already exists, focus it instead of creating a new one
  if (preferencesWindow) {
    preferencesWindow.focus();
    return;
  }
  
  preferencesWindow = new BrowserWindow({
    width: 700,
    height: 820,
    title: 'Preferences',
    minimizable: false,
    maximizable: false,
    resizable: false,
    parent: BrowserWindow.getFocusedWindow(),
    modal: process.platform !== 'darwin', // Modal on Windows/Linux, not on macOS
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  preferencesWindow.loadFile(path.join(__dirname, 'renderer', 'preferences.html'));
  
  // Clean up the window when closed
  preferencesWindow.on('closed', () => {
    preferencesWindow = null;
  });
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    preferencesWindow.webContents.openDevTools();
  }
}

// Remote management server
let remoteServer = null;

function startRemoteServer(preferences) {
  if (!preferences.remoteManagement || !preferences.remoteManagement.enabled) {
    stopRemoteServer();
    return;
  }
  
  const port = preferences.remoteManagement.port || 11150;
  const username = preferences.remoteManagement.username;
  const password = preferences.remoteManagement.password;
  
  // Stop any existing server
  stopRemoteServer();
  
  // Create Express app - change variable name to expressApp
  const expressApp = express();
  
  // Add basic authentication if credentials are provided
  if (username && password) {
    const users = {};
    users[username] = password;
    
    expressApp.use(basicAuth({
      users,
      challenge: true,
      realm: 'AutoSlides Remote Management'
    }));
  }
  
  // Serve static files from the web UI directory
  expressApp.use(express.static(path.join(__dirname, 'web-ui')));
  
  // API endpoints
  expressApp.get('/api/status', (req, res) => {
    res.json({ status: 'Connected to server' });
  });
  
  // Add retrieve token endpoint
  expressApp.get('/api/retrieve-token', async (req, res) => {
    try {
      const result = await mainWindow.webContents.executeJavaScript(`
        (async function() {
          try {
            if (!document.querySelector('webview')) {
              return { success: false, message: 'No webview found' };
            }
            
            const webview = document.querySelector('webview');

            // Check if webview is on homepage.html and redirect if needed
            const currentUrl = webview.getURL();
            if (currentUrl.includes('homepage.html')) {
              console.log('Detected homepage.html, navigating to YanHeKT home...');
              // Navigate to YanHeKT home
              await new Promise((resolve) => {
                const loadListener = () => {
                  webview.removeEventListener('did-finish-load', loadListener);
                  resolve();
                };
                webview.addEventListener('did-finish-load', loadListener);
                webview.src = 'https://www.yanhekt.cn/home';
              });
              console.log('Navigation to YanHeKT home completed');
            }
            
            const authInfo = await webview.executeJavaScript(\`
              (function() {
                // Get auth data from localStorage (this is where YanHeKT stores it)
                let token = null;
                try {
                  // First try to get from localStorage (primary method)
                  const authData = localStorage.getItem('auth');
                  if (authData) {
                    const parsed = JSON.parse(authData);
                    token = parsed.token;
                    console.log('Found token in localStorage');
                  }
                  
                  // If not found in localStorage, try backup locations
                  if (!token) {
                    for (const key of ['token', 'accessToken', 'yanhekt_token']) {
                      const value = localStorage.getItem(key);
                      if (value) {
                        token = value.replace(/^"|"$/g, ''); // Remove quotes if present
                        console.log('Found token in localStorage key:', key);
                        break;
                      }
                    }
                  }
                  
                  // Last resort: try cookies
                  if (!token) {
                    const cookies = document.cookie.split(';');
                    const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
                    if (tokenCookie) {
                      token = tokenCookie.split('=')[1].trim();
                      console.log('Found token in cookies');
                    }
                  }
                } catch (e) {
                  console.error('Error extracting token:', e);
                }
                
                return { token: token };
              })();
            \`);
            
            return authInfo;
          } catch (error) {
            console.error('Error retrieving token:', error);
            return { success: false, error: error.toString() };
          }
        })();
      `);
      
      if (result && result.token) {
        res.json({ success: true, token: result.token });
      } else {
        res.json({ 
          success: false, 
          message: 'No token found. Please log in to YanHeKT in the main app first.'
        });
      }
    } catch (error) {
      console.error('Error in retrieve-token endpoint:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to retrieve token'
      });
    }
  });
  
  // Add fetch courses endpoint
  expressApp.get('/api/courses', async (req, res) => {
    try {
      // Send request to main window and wait for response
      const result = await mainWindow.webContents.executeJavaScript(`
        (async function() {
          try {
            if (!document.querySelector('webview')) {
              return { success: false, message: 'No webview found' };
            }
            
            const webview = document.querySelector('webview');
            
            async function fetchPrivateCourseList(page = 1, pageSize = 16) {
              try {
                // Extract authentication token from localStorage similar to fetchSessionList
                const authInfo = await webview.executeJavaScript(\`
                  (function() {
                    // Get auth data from localStorage (this is where YanHeKT stores it)
                    let token = null;
                    try {
                      // First try to get from localStorage (primary method)
                      const authData = localStorage.getItem('auth');
                      if (authData) {
                        const parsed = JSON.parse(authData);
                        token = parsed.token;
                        console.log('Found token in localStorage');
                      }
                      
                      // If not found in localStorage, try backup locations
                      if (!token) {
                        // Check alternative localStorage keys
                        for (const key of ['token', 'accessToken', 'yanhekt_token']) {
                          const value = localStorage.getItem(key);
                          if (value) {
                            token = value.replace(/^"|"$/g, ''); // Remove quotes if present
                            console.log('Found token in localStorage key:', key);
                            break;
                          }
                        }
                      }
                      
                      // Last resort: try cookies
                      if (!token) {
                        const cookies = document.cookie.split(';');
                        const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
                        if (tokenCookie) {
                          token = tokenCookie.split('=')[1].trim();
                          console.log('Found token in cookies');
                        }
                      }
                    } catch (e) {
                      console.error('Error extracting token:', e);
                    }
                    
                    // Get user agent for request headers
                    const userAgent = navigator.userAgent;
                    
                    // Generate timestamp for request
                    const timestamp = Math.floor(Date.now() / 1000).toString();
                    
                    // Return all the necessary auth information
                    return {
                      token: token,
                      userAgent: userAgent,
                      timestamp: timestamp,
                      traceId: 'AUTO-' + Math.random().toString(36).substring(2, 15)
                    };
                  })();
                \`);
                
                console.log('Auth info retrieved (token hidden):', {
                  ...authInfo,
                  token: authInfo.token ? '***token-hidden***' : 'null'
                });
                
                if (!authInfo.token) {
                  throw new Error('Authentication token not found');
                }
                
                // API endpoint for course list
                const apiUrl = \`https://cbiz.yanhekt.cn/v2/course/private/list?page=\${page}&page_size=\${pageSize}&user_relationship_type=1&with_introduction=true\`;
                
                // Call the API through our main process to avoid CORS issues
                const result = await window.electronAPI.makeApiRequest({
                  url: apiUrl,
                  headers: {
                    'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,zh-CN;q=0.7,zh;q=0.6',
                    'Authorization': \`Bearer \${authInfo.token}\`,
                    'Content-Type': 'application/json',
                    'Origin': 'https://www.yanhekt.cn',
                    'Referer': 'https://www.yanhekt.cn/',
                    'User-Agent': authInfo.userAgent,
                    'X-TRACE-ID': authInfo.traceId,
                    'Xdomain-Client': 'web_user',
                    'xclient-timestamp': authInfo.timestamp,
                    'xclient-version': 'v2'
                  }
                });
                
                // Process API response
                if (result.code === 0 && result.data) {
                  const courses = parseCourseInfo(result);
                  
                  // Add current page info to each course
                  courses.forEach(course => {
                    course.page = page;
                  });
                  
                  // Check if we need to fetch more pages
                  const totalPages = result.data.last_page || 1;
                  
                  if (page < totalPages) {
                    // Fetch next page and combine results
                    const nextPageCourses = await fetchPrivateCourseList(page + 1, pageSize);
                    return [...courses, ...nextPageCourses];
                  }
                  
                  return courses;
                } else {
                  const errorMsg = result.message || 'Unknown API error';
                  throw new Error(\`API Error: \${errorMsg}\`);
                }
              } catch (error) {
                console.error('Error fetching course list:', error);
                throw error;
              }
            }

            // Extract and format course information from API response
            function parseCourseInfo(apiResponse) {
              try {
                const courses = [];
                
                if (apiResponse?.data?.data && Array.isArray(apiResponse.data.data)) {
                  apiResponse.data.data.forEach(course => {
                    // Extract the key information
                    courses.push({
                      id: course.id,
                      nameZh: course.name_zh,
                      nameEn: course.name_en,
                      code: course.code,
                      collegeName: course.college_name,
                      collegeCode: course.college_code,
                      universityCode: course.university_code,
                      universityId: course.university_id,
                      schoolYear: course.school_year,
                      semester: course.semester,
                      imageUrl: course.image_url,
                      state: course.state,
                      participantCount: course.participant_count,
                      professors: Array.isArray(course.professors) 
                        ? course.professors.map(prof => {
                            // Handle both cases: when prof is a string (name) or an object with a name property
                            if (typeof prof === 'string') {
                              return { name: prof };
                            } else if (typeof prof === 'object' && prof.name) {
                              return prof;
                            } else {
                              return { name: String(prof) };
                            }
                          }) 
                        : [],
                      classrooms: Array.isArray(course.classrooms) ? 
                        course.classrooms.map(classroom => ({
                          id: classroom.id,
                          name: classroom.name,
                          number: classroom.number
                        })) : []
                    });
                  });
                }
                
                return courses;
              } catch (error) {
                console.error('Error parsing course info:', error);
                return [];
              }
            }

            // Start fetching course data
            return { 
              success: true, 
              courses: await fetchPrivateCourseList()
            };
          } catch (error) {
            console.error('Error in course retrieval:', error);
            return { 
              success: false, 
              message: error.message || 'Failed to fetch course information'
            };
          }
        })();
      `);
      
      res.json(result);
    } catch (error) {
      console.error('Error in courses endpoint:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch courses'
      });
    }
  });
  
  // Add fetch sessions endpoint
  expressApp.get('/api/sessions', async (req, res) => {
    try {
      const courseId = req.query.courseId;
      
      if (!courseId) {
        return res.status(400).json({
          success: false,
          message: 'Course ID is required'
        });
      }
      
      // Send request to main window and wait for response
      const result = await mainWindow.webContents.executeJavaScript(`
        (async function() {
          try {
            if (!document.querySelector('webview')) {
              return { success: false, message: 'No webview found' };
            }
            
            const webview = document.querySelector('webview');
            
            async function fetchSessionList(courseId, page = 1, pageSize = 10) {
              try {
                // Extract authentication token from localStorage
                const authInfo = await webview.executeJavaScript(\`
                  (function() {
                    // Get auth data from localStorage (this is where YanHeKT stores it)
                    let token = null;
                    try {
                      // First try to get from localStorage (primary method)
                      const authData = localStorage.getItem('auth');
                      if (authData) {
                        const parsed = JSON.parse(authData);
                        token = parsed.token;
                        console.log('Found token in localStorage');
                      }
                      
                      // If not found, try backup locations
                      if (!token) {
                        for (const key of ['token', 'accessToken', 'yanhekt_token']) {
                          const value = localStorage.getItem(key);
                          if (value) {
                            token = value.replace(/^"|"$/g, ''); // Remove quotes if present
                            console.log('Found token in localStorage key:', key);
                            break;
                          }
                        }
                      }
                      
                      // Last resort: try cookies
                      if (!token) {
                        const cookies = document.cookie.split(';');
                        const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
                        if (tokenCookie) {
                          token = tokenCookie.split('=')[1].trim();
                          console.log('Found token in cookies');
                        }
                      }
                    } catch (e) {
                      console.error('Error extracting token:', e);
                    }
                    
                    // Get user agent for request headers
                    const userAgent = navigator.userAgent;
                    
                    // Generate timestamp for request
                    const timestamp = Math.floor(Date.now() / 1000).toString();
                    
                    return {
                      token: token,
                      userAgent: userAgent,
                      timestamp: timestamp,
                      traceId: 'AUTO-' + Math.random().toString(36).substring(2, 15)
                    };
                  })();
                \`);
                
                if (!authInfo.token) {
                  throw new Error('Authentication token not found');
                }
                
                // API endpoint for session list
                const apiUrl = \`https://cbiz.yanhekt.cn/v2/course/session/list?course_id=\${courseId}&with_page=true&page=\${page}&page_size=\${pageSize}&order_type=desc&order_type_weight=desc\`;
                
                // Call the API through main process
                const result = await window.electronAPI.makeApiRequest({
                  url: apiUrl,
                  headers: {
                    'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,zh-CN;q=0.7,zh;q=0.6',
                    'Authorization': \`Bearer \${authInfo.token}\`,
                    'Content-Type': 'application/json',
                    'Origin': 'https://www.yanhekt.cn',
                    'Referer': 'https://www.yanhekt.cn/',
                    'User-Agent': authInfo.userAgent,
                    'X-TRACE-ID': authInfo.traceId,
                    'Xdomain-Client': 'web_user',
                    'xclient-timestamp': authInfo.timestamp,
                    'xclient-version': 'v2'
                  }
                });
                
                return result;
              } catch (error) {
                console.error('Error fetching session list:', error);
                throw error;
              }
            }
            
            // Parse session information from API response
            function parseSessionInfo(apiResponse) {
              try {
                const sessions = [];
                
                if (apiResponse?.data?.data && Array.isArray(apiResponse.data.data)) {
                  apiResponse.data.data.forEach(session => {
                    // Extract the key information
                    sessions.push({
                      sessionId: session.id,
                      courseId: session.course_id,
                      title: session.title,
                      weekNumber: session.week_number,
                      dayOfWeek: session.day, // 1=Monday, 7=Sunday
                      startedAt: session.started_at,
                      endedAt: session.ended_at,
                      videoId: session.video_ids?.[0] || null,
                      videoUrl: session.videos?.[0]?.main || null,
                      location: session.location || '',
                      // Calculate progress percentage if available
                      progressPercent: session.user_progress ? 
                        Math.round((parseInt(session.user_progress.progress_current, 10) / 
                                   parseInt(session.user_progress.progress_overall, 10)) * 100) : 0
                    });
                  });
                }
                
                return sessions;
              } catch (error) {
                console.error('Error parsing session info:', error);
                return [];
              }
            }
            
            // Start fetching session data with pagination
            async function getAllSessions() {
              try {
                // Fetch first page
                const firstPageResponse = await fetchSessionList(${courseId}, 1);
                
                if (firstPageResponse.code !== 0) {
                  throw new Error(firstPageResponse.message || 'Failed to fetch sessions');
                }
                
                let allSessions = parseSessionInfo(firstPageResponse);
                
                // Check for additional pages
                const totalPages = firstPageResponse.data.last_page || 1;
                
                // Fetch remaining pages (with a reasonable limit)
                const maxPagesToFetch = 5; // Limit to avoid excessive API calls
                const pagesToFetch = Math.min(totalPages, maxPagesToFetch);
                
                if (pagesToFetch > 1) {
                  // Fetch all other pages except the first one which we already fetched
                  for (let page = 2; page <= pagesToFetch; page++) {
                    try {
                      const pageResponse = await fetchSessionList(${courseId}, page);
                      const pageSessions = parseSessionInfo(pageResponse);
                      allSessions = [...allSessions, ...pageSessions];
                    } catch (pageError) {
                      console.error(\`Error fetching page \${page}:\`, pageError);
                    }
                  }
                }
                
                return { 
                  success: true,
                  sessions: allSessions,
                  totalPages: totalPages,
                  courseId: ${courseId}
                };
              } catch (error) {
                console.error('Error in sessions retrieval:', error);
                return { 
                  success: false, 
                  message: error.message || 'Failed to fetch sessions',
                  error: error.toString()
                };
              }
            }
            
            return getAllSessions();
          } catch (error) {
            return { 
              success: false, 
              message: error.message || 'Failed to process session data',
              error: error.toString()
            };
          }
        })();
      `);
      
      res.json(result);
    } catch (error) {
      console.error('Error in sessions endpoint:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch sessions',
        error: error.toString()
      });
    }
  });
  
  // Start the server
  remoteServer = http.createServer(expressApp);
  remoteServer.listen(port, '0.0.0.0', () => {
    console.log(`Remote management server running on port ${port}, accessible from network`);
  });
  
  // Error handling
  remoteServer.on('error', (error) => {
    console.error('Remote server error:', error);
    if (error.code === 'EADDRINUSE') {
      dialog.showErrorBox(
        'Port In Use',
        `Port ${port} is already in use. Please choose another port in preferences.`
      );
    }
  });
}

function stopRemoteServer() {
  if (remoteServer) {
    remoteServer.close();
    remoteServer = null;
    console.log('Remote management server stopped');
  }
}

app.whenReady().then(async () => {
  createApplicationMenu(); // Add this line to create the menu
  createWindow();
  setupProgressInterceptor();

  // Ensure output directory exists
  ensureDirectoryExists(config.get('outputDir'));

  // Start remote server if enabled in config
  startRemoteServer(config.store);
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Request Notification Permission (macOS only)
  if (process.platform === 'darwin') {
    app.setAppUserModelId('com.autoslides.app');
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Handle API requests from renderer
ipcMain.handle('make-api-request', async (event, options) => {
  try {
    const { url, headers, method = 'GET', body } = options;
    
    // Request configuration
    const config = {
      method: method,
      headers: headers
    };
    
    // Add body for PUT/POST requests
    if (body && (method === 'PUT' || method === 'POST')) {
      config.body = body;
    }
    
    // Make the API request
    const response = await fetch(url, config);
    
    // Parse JSON response
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error making API request:', error);
    return {
      code: -1,
      message: `API Request failed: ${error.message}`,
      error: error.toString()
    };
  }
});

// Cache management utilities
async function calculateCacheSize() {
  try {
    const cachePath = app.getPath('userData');
    let totalSize = 0;
    
    // Function to recursively calculate directory size
    const getDirSize = async (dirPath) => {
      try {
        const files = await fsReaddir(dirPath);
        const stats = await Promise.all(
          files.map(async (file) => {
            const filePath = path.join(dirPath, file);
            const stat = await fsStat(filePath);
            if (stat.isDirectory()) {
              return getDirSize(filePath);
            }
            return stat.size;
          })
        );
        return stats.reduce((acc, size) => acc + size, 0);
      } catch (e) {
        console.error(`Error calculating size for ${dirPath}:`, e);
        return 0;
      }
    };

    // Calculate cache directories sizes
    const cacheSize = await getDirSize(path.join(cachePath, 'Cache'));
    const gpuCacheSize = await getDirSize(path.join(cachePath, 'GPUCache'));
    const storageSize = await getDirSize(path.join(cachePath, 'Local Storage'));
    const sessionStorageSize = await getDirSize(path.join(cachePath, 'Session Storage'));
    
    totalSize = cacheSize + gpuCacheSize + storageSize + sessionStorageSize;
    
    // Format to MB with 2 decimal places
    return {
      totalMB: (totalSize / (1024 * 1024)).toFixed(2),
      details: {
        cache: (cacheSize / (1024 * 1024)).toFixed(2),
        gpuCache: (gpuCacheSize / (1024 * 1024)).toFixed(2),
        localStorage: (storageSize / (1024 * 1024)).toFixed(2),
        sessionStorage: (sessionStorageSize / (1024 * 1024)).toFixed(2)
      }
    };
  } catch (error) {
    console.error('Error calculating cache size:', error);
    return { totalMB: 'Error', details: {} };
  }
}

async function clearCacheDirectory(dirPath) {
  try {
    // Check if directory exists
    await fsAccess(dirPath).catch(() => {
      // Directory doesn't exist, nothing to delete
      return null;
    });
    
    // Read directory contents
    const files = await fsReaddir(dirPath);
    
    // Delete all files in the directory
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = await fsStat(filePath);
      
      if (stat.isDirectory()) {
        await clearCacheDirectory(filePath);
      } else {
        await fsUnlink(filePath).catch(err => {
          console.error(`Failed to delete file ${filePath}:`, err);
        });
      }
    }
    
    // Don't delete the directory itself as Electron might recreate it
    // and could have issues if it's missing
    
    return true;
  } catch (error) {
    console.error(`Error clearing directory ${dirPath}:`, error);
    return false;
  }
}

async function clearAllCacheData() {
  try {
    const userData = app.getPath('userData');
    const appName = 'com.autoslides.app';
    
    // Clear various cache directories in userData
    await Promise.all([
      clearCacheDirectory(path.join(userData, 'Cache')),
      clearCacheDirectory(path.join(userData, 'Code Cache')),
      clearCacheDirectory(path.join(userData, 'GPUCache')),
      clearCacheDirectory(path.join(userData, 'Local Storage')),
      clearCacheDirectory(path.join(userData, 'Session Storage')),
      clearCacheDirectory(path.join(userData, 'IndexedDB')),
      clearCacheDirectory(path.join(userData, 'Cookies')),
      session.defaultSession.clearCache(),
      session.defaultSession.clearStorageData({
        storages: ['appcache', 'cookies', 'filesystem', 'indexdb', 'localstorage', 
                   'shadercache', 'websql', 'serviceworkers', 'cachestorage'],
      }),
    ]);
    
    // Clear savedState folder on macOS
    if (process.platform === 'darwin') {
      const homeDir = app.getPath('home');
      const savedStatePath = path.join(homeDir, 'Library/Saved Application State', `${appName}.savedState`);
      
      try {
        // First check if the directory exists
        await fsAccess(savedStatePath).catch(() => null);
        console.log(`Clearing savedState folder: ${savedStatePath}`);
        await clearCacheDirectory(savedStatePath);
        
        // Try to remove the directory itself
        await fsRmdir(savedStatePath).catch(err => {
          console.log(`Note: Could not remove savedState directory (this is often normal): ${err.message}`);
        });
      } catch (err) {
        console.log(`Note: savedState folder handling: ${err.message}`);
      }
    }
    
    // Clear additional app-specific data on Windows
    if (process.platform === 'win32') {
      try {
        const appData = app.getPath('appData');
        const roamingPath = path.join(appData, appName);
        await clearCacheDirectory(roamingPath).catch(() => null);
        
        const localAppData = app.getPath('appData');
        const localAppDataPath = path.join(localAppData, appName);
        await clearCacheDirectory(localAppDataPath).catch(() => null);
      } catch (err) {
        console.log(`Note: Windows app data handling: ${err.message}`);
      }
    }
    
    console.log('All application data successfully cleared');
    return true;
  } catch (error) {
    console.error('Error clearing all cache data:', error);
    return false;
  }
}

// Add these variables to track intercept state
let interceptProgress = false;

// Add this function to set up the webRequest interceptor
function setupProgressInterceptor() {
  // Filter for API responses from YanHeKT
  const filter = {
    urls: [
      'https://cbiz.yanhekt.cn/v2/course/session/*', 
      'https://cbiz.yanhekt.cn/v1/course/session/*',
      'https://cbiz.yanhekt.cn/v2/session/*/progress',
      'https://cbiz.yanhekt.cn/v1/session/*/progress'
    ]
  };

  // Intercept response headers
  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    if (!interceptProgress) {
      // If not intercepting, just pass through
      callback({ cancel: false });
      return;
    }

    // Get content type to check if JSON
    const contentTypeHeader = details.responseHeaders['content-type'] || details.responseHeaders['Content-Type'];
    const isJson = contentTypeHeader && contentTypeHeader[0] && 
                   contentTypeHeader[0].toLowerCase().includes('application/json');

    if (isJson) {
      // For JSON responses, we'll need to modify the response body
      // We'll do this by setting a flag to handle it in onResponseStarted
      details.interceptResponse = true;
    }

    callback({ responseHeaders: details.responseHeaders });
  });

  // Intercept and modify response bodies
  session.defaultSession.webRequest.onResponseStarted(filter, (details) => {
    if (!interceptProgress || !details.interceptResponse) {
      return;
    }

      // Add this to your setupProgressInterceptor function, within the onResponseStarted callback
      const code = `
        // Override fetch for YanHeKT progress APIs
        const originalFetch = window.fetch;
        window.fetch = async function(url, options) {
          // ...existing fetch override code
        };
        
        // Also override XMLHttpRequest for older implementations
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
          this._autoSlidesUrl = url;
          return originalXHROpen.call(this, method, url, ...args);
        };
        
        XMLHttpRequest.prototype.send = function(...args) {
          const url = this._autoSlidesUrl || '';
          
          if (typeof url === 'string' && (
              url.includes('/course/session/') || 
              url.includes('/session/') && url.includes('/progress'))) {
            
            const originalOnReadyStateChange = this.onreadystatechange;
            this.onreadystatechange = function() {
              if (this.readyState === 4 && this.status === 200) {
                try {
                  const originalResponse = JSON.parse(this.responseText);
                  const modifiedResponse = JSON.parse(JSON.stringify(originalResponse));
                  
                  // Modify user_progress in session list
                  if (modifiedResponse.data && Array.isArray(modifiedResponse.data.data)) {
                    modifiedResponse.data.data.forEach(session => {
                      if (session.user_progress) {
                        session.user_progress.progress_current = "0";
                        console.log('[AutoSlides] Reset progress for session (XHR):', session.id);
                      }
                    });
                  }
                  
                  // Modify direct progress response
                  if (modifiedResponse.data && modifiedResponse.data.progress_current) {
                    modifiedResponse.data.progress_current = "0";
                    console.log('[AutoSlides] Reset progress for current session (XHR)');
                  }
                  
                  // Override the response properties
                  Object.defineProperty(this, 'responseText', {
                    get: function() {
                      return JSON.stringify(modifiedResponse);
                    }
                  });
                } catch (e) {
                  console.error('[AutoSlides] Error modifying XHR response:', e);
                }
              }
              
              if (originalOnReadyStateChange) {
                originalOnReadyStateChange.apply(this, arguments);
              }
            };
          }
          
          return originalXHRSend.apply(this, args);
        };
        
        console.log('[AutoSlides] Progress intercept fully installed (fetch+XHR)');
      `;

    // Execute this code in all frames
    details.webContents.executeJavaScript(code)
      .catch(err => console.error('Error installing progress intercept:', err));
  });
}

// Background running handling
let powerSaveBlockerId = null;

function enableBackgroundRunning() {
  try {
    if (powerSaveBlockerId === null) {
      // The 'prevent-app-suspension' reason works on both macOS and Windows
      powerSaveBlockerId = require('electron').powerSaveBlocker.start('prevent-app-suspension');
      console.log('Background running enabled, ID:', powerSaveBlockerId);
      
      // On macOS, we can also prevent display sleep if needed
      if (process.platform === 'darwin') {
        const displayBlockerId = require('electron').powerSaveBlocker.start('prevent-display-sleep');
        console.log('Display sleep prevention enabled, ID:', displayBlockerId);
      }
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to enable background running:', error);
    return false;
  }
}

function disableBackgroundRunning() {
  try {
    if (powerSaveBlockerId !== null) {
      require('electron').powerSaveBlocker.stop(powerSaveBlockerId);
      console.log('Background running disabled');
      powerSaveBlockerId = null;
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to disable background running:', error);
    return false;
  }
}

// IPC handlers
ipcMain.handle('get-config', () => {
  return config.store;
});

ipcMain.handle('save-config', (event, newConfig) => {
  for (const key in newConfig) {
    config.set(key, newConfig[key]);
  }

  startRemoteServer(newConfig);

  return config.store;
});

ipcMain.handle('select-output-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const outputDir = result.filePaths[0];
    config.set('outputDir', outputDir);
    return outputDir;
  }
  return config.get('outputDir');
});

// Add this helper function for sanitizing folder names
function sanitizeFolderName(name) {
  if (!name) return 'Untitled';
  
  // First replace spaces with underscores
  let sanitized = name.replace(/\s+/g, '_');
  
  // Then replace invalid characters with underscores, but preserve hyphens
  sanitized = sanitized.replace(/[\\/:*?"<>|]/g, '_');
  
  // Convert multiple sequential underscores to single
  sanitized = sanitized.replace(/_+/g, '_');
  
  // Limit length to avoid path issues
  return sanitized.substring(0, 100);
}

// Handle saving screenshots
ipcMain.handle('save-slide', (event, { imageData, timestamp, title }) => {
  try {
    const baseOutputDir = config.get('outputDir');
    ensureDirectoryExists(baseOutputDir);
    
    // Create a title-based subfolder if title is provided
    let targetDir = baseOutputDir;
    if (title) {
      const folderName = sanitizeFolderName(title);
      targetDir = path.join(baseOutputDir, folderName);
      ensureDirectoryExists(targetDir);
    }
    
    const fileName = `slide_${timestamp}.png`;
    const filePath = path.join(targetDir, fileName);
    
    // Remove the data URL prefix
    const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(filePath, base64Data, 'base64');
    
    return { success: true, filePath };
  } catch (error) {
    console.error('Error saving slide:', error);
    return { success: false, error: error.message };
  }
});

// Blocking rules handlers
ipcMain.handle('get-blocking-rules', () => {
  return config.get('blockingRules');
});

ipcMain.handle('save-blocking-rules', (event, rules) => {
  config.set('blockingRules', rules);
  return true;
});

ipcMain.handle('open-link', async (event, url) => {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  
  if (win) {
    win.webContents.send('open-url', url);
  }
  
  return true;
});

// Cache management IPC handlers
ipcMain.handle('clear-browser-cache', async () => {
  try {
    await session.defaultSession.clearCache();
    await clearCacheDirectory(path.join(app.getPath('userData'), 'Cache'));
    await clearCacheDirectory(path.join(app.getPath('userData'), 'GPUCache'));
    return { success: true };
  } catch (error) {
    console.error('Error clearing browser cache:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-cookies', async () => {
  try {
    await session.defaultSession.clearStorageData({
      storages: ['cookies']
    });
    return { success: true };
  } catch (error) {
    console.error('Error clearing cookies:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-all-data', async () => {
  try {
    const result = await clearAllCacheData();
    return { success: result };
  } catch (error) {
    console.error('Error clearing all data:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-cache-size', async () => {
  return calculateCacheSize();
});

// Add IPC handlers for background running
ipcMain.handle('enable-background-running', () => {
  return enableBackgroundRunning();
});

ipcMain.handle('disable-background-running', () => {
  return disableBackgroundRunning();
});

ipcMain.handle('get-background-running-status', () => {
  return powerSaveBlockerId !== null;
});

ipcMain.handle('enableProgressIntercept', (event) => {
  interceptProgress = true;
  console.log('Progress intercept enabled');
  return true;
});

ipcMain.handle('disableProgressIntercept', (event) => {
  interceptProgress = false;
  console.log('Progress intercept disabled');
  return true;
});

ipcMain.handle('getProgressInterceptStatus', (event) => {
  return interceptProgress;
});

ipcMain.handle('muteWebviewAudio', async (event, webviewId) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: 'No window found' };
    
    const allWebContents = webContents.getAllWebContents();
    
    let webviewContents = null;
    for (const contents of allWebContents) {
      if (contents.id === event.sender.id) continue;
      
      if (contents.hostWebContents && contents.hostWebContents.id === event.sender.id) {
        webviewContents = contents;
        break;
      }
    }
    
    if (!webviewContents) {
      console.log('No webview webContents found');
      let mutedAny = false;
      for (const contents of allWebContents) {
        if (contents.id !== event.sender.id) {
          contents.setAudioMuted(true);
          mutedAny = true;
          console.log(`Muted webContents with ID: ${contents.id}`);
        }
      }
      return { success: mutedAny, message: 'Attempted to mute all secondary webContents' };
    }
    
    webviewContents.setAudioMuted(true);
    console.log(`Muted webview webContents with ID: ${webviewContents.id}`);
    return { success: true, message: 'Webview audio muted' };
    
  } catch (error) {
    console.error('Error in muteWebviewAudio:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('unmuteWebviewAudio', async (event, webviewId) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: 'No window found' };
    
    const allWebContents = webContents.getAllWebContents();
    
    let webviewContents = null;
    for (const contents of allWebContents) {
      if (contents.id === event.sender.id) continue;
      
      if (contents.hostWebContents && contents.hostWebContents.id === event.sender.id) {
        webviewContents = contents;
        break;
      }
    }
    
    if (!webviewContents) {
      console.log('No webview webContents found');
      let unmutedAny = false;
      for (const contents of allWebContents) {
        if (contents.id !== event.sender.id) {
          contents.setAudioMuted(false);
          unmutedAny = true;
          console.log(`Unmuted webContents with ID: ${contents.id}`);
        }
      }
      return { success: unmutedAny, message: 'Attempted to unmute all secondary webContents' };
    }
    
    webviewContents.setAudioMuted(false);
    console.log(`Unmuted webview webContents with ID: ${webviewContents.id}`);
    return { success: true, message: 'Webview audio unmuted' };
    
  } catch (error) {
    console.error('Error in unmuteWebviewAudio:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('apply-blocking-rules', async (event) => {
  try {
    // Get the main window
    const mainWindow = BrowserWindow.getAllWindows().find(win => win !== BrowserWindow.fromWebContents(event.sender));
    
    if (mainWindow) {
      // Send message to main window to apply rules
      mainWindow.webContents.send('apply-blocking-rules');
      return { success: true };
    } else {
      return { success: false, error: 'Main window not found' };
    }
  } catch (error) {
    console.error('Error applying blocking rules:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('send-to-main-window', async (event, channel, data) => {
  mainWindow.webContents.send(channel, data);

  if (channel === 'retrieve-token') {
    // Send request to main window and wait for response
    const result = await mainWindow.webContents.executeJavaScript(`
      (async function() {
        try {
          if (!document.querySelector('webview')) {
            return { success: false, message: 'No webview found' };
          }
          
          const webview = document.querySelector('webview');

          // Check if webview is on homepage.html and redirect if needed
          const currentUrl = webview.getURL();
          if (currentUrl.includes('homepage.html')) {
            console.log('Detected homepage.html, navigating to YanHeKT home...');
            // Navigate to YanHeKT home
            await new Promise((resolve) => {
              const loadListener = () => {
                webview.removeEventListener('did-finish-load', loadListener);
                resolve();
              };
              webview.addEventListener('did-finish-load', loadListener);
              webview.src = 'https://www.yanhekt.cn/home';
            });
            console.log('Navigation to YanHeKT home completed');
          }
          
          const authInfo = await webview.executeJavaScript(\`
            (function() {
              // Get auth data from localStorage (this is where YanHeKT stores it)
              let token = null;
              try {
                // First try to get from localStorage (primary method)
                const authData = localStorage.getItem('auth');
                if (authData) {
                  const parsed = JSON.parse(authData);
                  token = parsed.token;
                  console.log('Found token in localStorage');
                }
                
                // If not found in localStorage, try backup locations
                if (!token) {
                  for (const key of ['token', 'accessToken', 'yanhekt_token']) {
                    const value = localStorage.getItem(key);
                    if (value) {
                      token = value.replace(/^"|"$/g, ''); // Remove quotes if present
                      console.log('Found token in localStorage key:', key);
                      break;
                    }
                  }
                }
                
                // Last resort: try cookies
                if (!token) {
                  const cookies = document.cookie.split(';');
                  const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
                  if (tokenCookie) {
                    token = tokenCookie.split('=')[1].trim();
                    console.log('Found token in cookies');
                  }
                }
              } catch (e) {
                console.error('Error extracting token:', e);
              }
              
              return { token: token };
            })();
          \`);
          
          return authInfo;
        } catch (error) {
          console.error('Error retrieving token:', error);
          return { success: false, error: error.toString() };
        }
      })();
    `);
    
    return result;
  }
  
  return null;
});

ipcMain.on('show-crop-guides', (event) => {
  mainWindow.webContents.send('show-crop-guides');
});

ipcMain.on('update-crop-preview', (event, data) => {
  mainWindow.webContents.send('update-crop-preview', data);
});

// Add this new IPC handler for fetching recorded courses
ipcMain.handle('fetch-recorded-courses', async (event) => {
  try {
    // Send request to main window and wait for response
    const result = await mainWindow.webContents.executeJavaScript(`
      (async function() {
        try {
          if (!document.querySelector('webview')) {
            return { success: false, message: 'No webview found' };
          }
          
          const webview = document.querySelector('webview');
          
          async function fetchPrivateCourseList(page = 1, pageSize = 16) {
            try {
              // Extract authentication token from localStorage similar to fetchSessionList
              const authInfo = await webview.executeJavaScript(\`
                (function() {
                  // Get auth data from localStorage (this is where YanHeKT stores it)
                  let token = null;
                  try {
                    // First try to get from localStorage (primary method)
                    const authData = localStorage.getItem('auth');
                    if (authData) {
                      const parsed = JSON.parse(authData);
                      token = parsed.token;
                      console.log('Found token in localStorage');
                    }
                    
                    // If not found in localStorage, try backup locations
                    if (!token) {
                      // Check alternative localStorage keys
                      for (const key of ['token', 'accessToken', 'yanhekt_token']) {
                        const value = localStorage.getItem(key);
                        if (value) {
                          token = value.replace(/^"|"$/g, ''); // Remove quotes if present
                          console.log('Found token in localStorage key:', key);
                          break;
                        }
                      }
                    }
                    
                    // Last resort: try cookies
                    if (!token) {
                      const cookies = document.cookie.split(';');
                      const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
                      if (tokenCookie) {
                        token = tokenCookie.split('=')[1].trim();
                        console.log('Found token in cookies');
                      }
                    }
                  } catch (e) {
                    console.error('Error extracting token:', e);
                  }
                  
                  // Get user agent for request headers
                  const userAgent = navigator.userAgent;
                  
                  // Generate timestamp for request
                  const timestamp = Math.floor(Date.now() / 1000).toString();
                  
                  // Return all the necessary auth information
                  return {
                    token: token,
                    userAgent: userAgent,
                    timestamp: timestamp,
                    traceId: 'AUTO-' + Math.random().toString(36).substring(2, 15)
                  };
                })();
              \`);
              
              console.log('Auth info retrieved (token hidden):', {
                ...authInfo,
                token: authInfo.token ? '***token-hidden***' : 'null'
              });
              
              if (!authInfo.token) {
                throw new Error('Authentication token not found');
              }
              
              // API endpoint for course list
              const apiUrl = \`https://cbiz.yanhekt.cn/v2/course/private/list?page=\${page}&page_size=\${pageSize}&user_relationship_type=1&with_introduction=true\`;
              
              // Call the API through our main process to avoid CORS issues
              const result = await window.electronAPI.makeApiRequest({
                url: apiUrl,
                headers: {
                  'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,zh-CN;q=0.7,zh;q=0.6',
                  'Authorization': \`Bearer \${authInfo.token}\`,
                  'Content-Type': 'application/json',
                  'Origin': 'https://www.yanhekt.cn',
                  'Referer': 'https://www.yanhekt.cn/',
                  'User-Agent': authInfo.userAgent,
                  'X-TRACE-ID': authInfo.traceId,
                  'Xdomain-Client': 'web_user',
                  'xclient-timestamp': authInfo.timestamp,
                  'xclient-version': 'v2'
                }
              });
              
              // Process API response
              if (result.code === 0 && result.data) {
                const courses = parseCourseInfo(result);
                
                // Add current page info to each course
                courses.forEach(course => {
                  course.page = page;
                });
                
                // Check if we need to fetch more pages
                const totalPages = result.data.last_page || 1;
                
                if (page < totalPages) {
                  // Fetch next page and combine results
                  const nextPageCourses = await fetchPrivateCourseList(page + 1, pageSize);
                  return [...courses, ...nextPageCourses];
                }
                
                return courses;
              } else {
                const errorMsg = result.message || 'Unknown API error';
                throw new Error(\`API Error: \${errorMsg}\`);
              }
            } catch (error) {
              console.error('Error fetching course list:', error);
              throw error;
            }
          }

          // Extract and format course information from API response
          function parseCourseInfo(apiResponse) {
            try {
              const courses = [];
              
              if (apiResponse?.data?.data && Array.isArray(apiResponse.data.data)) {
                apiResponse.data.data.forEach(course => {
                  // Extract the key information
                  courses.push({
                    id: course.id,
                    nameZh: course.name_zh,
                    nameEn: course.name_en,
                    code: course.code,
                    collegeName: course.college_name,
                    collegeCode: course.college_code,
                    universityCode: course.university_code,
                    universityId: course.university_id,
                    schoolYear: course.school_year,
                    semester: course.semester,
                    imageUrl: course.image_url,
                    state: course.state,
                    participantCount: course.participant_count,
                    professors: Array.isArray(course.professors) 
                      ? course.professors.map(prof => {
                          // Handle both cases: when prof is a string (name) or an object with a name property
                          if (typeof prof === 'string') {
                            return { name: prof };
                          } else if (typeof prof === 'object' && prof.name) {
                            return prof;
                          } else {
                            return { name: String(prof) };
                          }
                        }) 
                      : [],
                    classrooms: Array.isArray(course.classrooms) ? 
                      course.classrooms.map(classroom => ({
                        id: classroom.id,
                        name: classroom.name,
                        number: classroom.number
                      })) : []
                  });
                });
              }
              
              return courses;
            } catch (error) {
              console.error('Error parsing course info:', error);
              return [];
            }
          }

          // Start fetching course data
          return { 
            success: true, 
            courses: await fetchPrivateCourseList()
          };
        } catch (error) {
          console.error('Error in course retrieval:', error);
          return { 
            success: false, 
            message: error.message || 'Failed to fetch course information'
          };
        }
      })();
    `);
    
    return result;
  } catch (error) {
    console.error('Error fetching recorded courses:', error);
    return { success: false, error: error.message };
  }
});

// Add this new IPC handler for fetching live courses
ipcMain.handle('fetch-live-courses', async (event) => {
  try {
    // Send request to main window and wait for response
    const result = await mainWindow.webContents.executeJavaScript(`
      (async function() {
        try {
          if (!document.querySelector('webview')) {
            return { success: false, message: 'No webview found' };
          }
          
          const webview = document.querySelector('webview');
          
          async function fetchLiveList(page = 1, pageSize = 16) {
            try {
              // Extract authentication token from localStorage
              const authInfo = await webview.executeJavaScript(\`
                (function() {
                  // Get auth data from localStorage (this is where YanHeKT stores it)
                  let token = null;
                  try {
                    // First try to get from localStorage (primary method)
                    const authData = localStorage.getItem('auth');
                    if (authData) {
                      const parsed = JSON.parse(authData);
                      token = parsed.token;
                      console.log('Found token in localStorage');
                    }
                    
                    // If not found in localStorage, try backup locations
                    if (!token) {
                      for (const key of ['token', 'accessToken', 'yanhekt_token']) {
                        const value = localStorage.getItem(key);
                        if (value) {
                          token = value.replace(/^"|"$/g, ''); // Remove quotes if present
                          console.log('Found token in localStorage key:', key);
                          break;
                        }
                      }
                    }
                    
                    // Last resort: try cookies
                    if (!token) {
                      const cookies = document.cookie.split(';');
                      const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
                      if (tokenCookie) {
                        token = tokenCookie.split('=')[1].trim();
                        console.log('Found token in cookies');
                      }
                    }
                  } catch (e) {
                    console.error('Error extracting token:', e);
                  }
                  
                  // Get user agent for request headers
                  const userAgent = navigator.userAgent;
                  
                  // Generate timestamp for request
                  const timestamp = Math.floor(Date.now() / 1000).toString();
                  
                  return {
                    token: token,
                    userAgent: userAgent,
                    timestamp: timestamp,
                    traceId: 'AUTO-' + Math.random().toString(36).substring(2, 15)
                  };
                })();
              \`);
              
              console.log('Auth info retrieved (token hidden):', {
                ...authInfo,
                token: authInfo.token ? '***token-hidden***' : 'null'
              });
              
              if (!authInfo.token) {
                throw new Error('Authentication token not found.');
              }
              
              // Call the API through our main process to avoid CORS issues
              const result = await window.electronAPI.makeApiRequest({
                url: \`https://cbiz.yanhekt.cn/v2/live/list?page=\${page}&page_size=\${pageSize}&user_relationship_type=1\`,
                headers: {
                  'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,zh-CN;q=0.7,zh;q=0.6',
                  'Authorization': \`Bearer \${authInfo.token}\`,
                  'Content-Type': 'application/json',
                  'Origin': 'https://www.yanhekt.cn',
                  'Referer': 'https://www.yanhekt.cn/',
                  'User-Agent': authInfo.userAgent,
                  'X-TRACE-ID': authInfo.traceId,
                  'Xdomain-Client': 'web_user',
                  'xclient-timestamp': authInfo.timestamp,
                  'xclient-version': 'v2'
                }
              });
              
              console.log(\`API response for live courses page \${page}:\`, result);
              
              // Process API response
              if (result.code === 0 && result.data) {
                return result; // Return the raw API response
              } else if (result.code === 401) {
                throw new Error('Authentication failed. Please refresh the page and log in again.');
              } else {
                throw new Error(result.message || 'Failed to fetch live courses data from API');
              }
            } catch (error) {
              console.error('Error fetching live list:', error);
              throw error;
            }
          }
          
          // Helper function to get status text for display
          function getStatusText(status) {
            switch (status) {
              case 1: return 'Upcoming';
              case 2: return 'Live';
              case 3: return 'Ended';
              default: return 'Unknown';
            }
          }

          // Extract and format live course information from API response
          function parseLiveInfo(apiResponse) {
            try {
              const liveCourses = [];
              
              if (apiResponse?.data?.data && Array.isArray(apiResponse.data.data)) {
                apiResponse.data.data.forEach(live => {
                  // Extract the key information
                  liveCourses.push({
                    liveId: live.id,
                    courseId: live.source_id,
                    courseName: live.course?.name_zh || live.title,
                    title: live.title,
                    subtitle: live.subtitle,
                    startedAt: live.started_at,
                    endedAt: live.ended_at,
                    status: live.status, // 1=upcoming, 2=live, 3=ended
                    statusText: getStatusText(live.status),
                    professorName: live.session?.professor?.name || '',
                    location: live.location || '',
                    participantCount: live.participant_count || 0
                  });
                });
              }
              
              return liveCourses;
            } catch (error) {
              console.error('Error parsing live info:', error);
              return [];
            }
          }

          // Start fetching live course data with pagination
          async function getAllLiveCourses() {
            try {
              // Fetch first page
              const firstPageResponse = await fetchLiveList(1);
              
              if (firstPageResponse.code !== 0) {
                throw new Error(firstPageResponse.message || 'Failed to fetch live courses');
              }
              
              let allLiveCourses = parseLiveInfo(firstPageResponse);
              
              // Check for additional pages
              const totalPages = firstPageResponse.data.pagination?.last_page || 1;
              
              // Fetch remaining pages (with a reasonable limit)
              const maxPagesToFetch = 3; // Limit to avoid excessive API calls
              const pagesToFetch = Math.min(totalPages, maxPagesToFetch);
              
              if (pagesToFetch > 1) {
                // Fetch all other pages except the first one which we already fetched
                for (let page = 2; page <= pagesToFetch; page++) {
                  try {
                    const pageResponse = await fetchLiveList(page);
                    const pageLives = parseLiveInfo(pageResponse);
                    allLiveCourses = [...allLiveCourses, ...pageLives];
                  } catch (pageError) {
                    console.error(\`Error fetching page \${page}:\`, pageError);
                  }
                }
              }
              
              return { 
                success: true,
                liveCourses: allLiveCourses,
                totalPages: totalPages
              };
            } catch (error) {
              console.error('Error in live courses retrieval:', error);
              return { 
                success: false, 
                message: error.message || 'Failed to fetch live courses',
                error: error.toString()
              };
            }
          }
          
          return getAllLiveCourses();
        } catch (error) {
          return { 
            success: false, 
            message: error.message || 'Failed to process live course data',
            error: error.toString()
          };
        }
      })();
    `);
    
    return result;
  } catch (error) {
    console.error('Error fetching live courses:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to fetch live courses',
      error: error.toString()
    };
  }
});

// Add this new IPC handler for fetching course sessions
ipcMain.handle('fetch-course-sessions', async (event, courseId) => {
  try {
    if (!courseId) {
      return { success: false, message: 'Course ID is required' };
    }
    
    // Send request to main window and wait for response
    const result = await mainWindow.webContents.executeJavaScript(`
      (async function() {
        try {
          if (!document.querySelector('webview')) {
            return { success: false, message: 'No webview found' };
          }
          
          const webview = document.querySelector('webview');
          
          async function fetchSessionList(courseId, page = 1, pageSize = 10) {
            try {
              // Extract authentication token from localStorage
              const authInfo = await webview.executeJavaScript(\`
                (function() {
                  // Get auth data from localStorage (this is where YanHeKT stores it)
                  let token = null;
                  try {
                    // First try to get from localStorage (primary method)
                    const authData = localStorage.getItem('auth');
                    if (authData) {
                      const parsed = JSON.parse(authData);
                      token = parsed.token;
                      console.log('Found token in localStorage');
                    }
                    
                    // If not found, try backup locations
                    if (!token) {
                      for (const key of ['token', 'accessToken', 'yanhekt_token']) {
                        const value = localStorage.getItem(key);
                        if (value) {
                          token = value.replace(/^"|"$/g, ''); // Remove quotes if present
                          console.log('Found token in localStorage key:', key);
                          break;
                        }
                      }
                    }
                    
                    // Last resort: try cookies
                    if (!token) {
                      const cookies = document.cookie.split(';');
                      const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
                      if (tokenCookie) {
                        token = tokenCookie.split('=')[1].trim();
                        console.log('Found token in cookies');
                      }
                    }
                  } catch (e) {
                    console.error('Error extracting token:', e);
                  }
                  
                  // Get user agent for request headers
                  const userAgent = navigator.userAgent;
                  
                  // Generate timestamp for request
                  const timestamp = Math.floor(Date.now() / 1000).toString();
                  
                  return {
                    token: token,
                    userAgent: userAgent,
                    timestamp: timestamp,
                    traceId: 'AUTO-' + Math.random().toString(36).substring(2, 15)
                  };
                })();
              \`);
              
              if (!authInfo.token) {
                throw new Error('Authentication token not found');
              }
              
              // API endpoint for session list
              const apiUrl = \`https://cbiz.yanhekt.cn/v2/course/session/list?course_id=\${courseId}&with_page=true&page=\${page}&page_size=\${pageSize}&order_type=desc&order_type_weight=desc\`;
              
              // Call the API through main process
              const result = await window.electronAPI.makeApiRequest({
                url: apiUrl,
                headers: {
                  'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,zh-CN;q=0.7,zh;q=0.6',
                  'Authorization': \`Bearer \${authInfo.token}\`,
                  'Content-Type': 'application/json',
                  'Origin': 'https://www.yanhekt.cn',
                  'Referer': 'https://www.yanhekt.cn/',
                  'User-Agent': authInfo.userAgent,
                  'X-TRACE-ID': authInfo.traceId,
                  'Xdomain-Client': 'web_user',
                  'xclient-timestamp': authInfo.timestamp,
                  'xclient-version': 'v2'
                }
              });
              
              return result;
            } catch (error) {
              console.error('Error fetching session list:', error);
              throw error;
            }
          }
          
          // Parse session information from API response
          function parseSessionInfo(apiResponse) {
            try {
              const sessions = [];
              
              if (apiResponse?.data?.data && Array.isArray(apiResponse.data.data)) {
                apiResponse.data.data.forEach(session => {
                  // Extract the key information
                  sessions.push({
                    sessionId: session.id,
                    courseId: session.course_id,
                    title: session.title,
                    weekNumber: session.week_number,
                    dayOfWeek: session.day, // 1=Monday, 7=Sunday
                    startedAt: session.started_at,
                    endedAt: session.ended_at,
                    videoId: session.video_ids?.[0] || null,
                    videoUrl: session.videos?.[0]?.main || null,
                    location: session.location || '',
                    // Calculate progress percentage if available
                    progressPercent: session.user_progress ? 
                      Math.round((parseInt(session.user_progress.progress_current, 10) / 
                                 parseInt(session.user_progress.progress_overall, 10)) * 100) : 0
                  });
                });
              }
              
              return sessions;
            } catch (error) {
              console.error('Error parsing session info:', error);
              return [];
            }
          }
          
          // Start fetching session data with pagination
          async function getAllSessions() {
            try {
              // Fetch first page
              const firstPageResponse = await fetchSessionList(${courseId}, 1);
              
              if (firstPageResponse.code !== 0) {
                throw new Error(firstPageResponse.message || 'Failed to fetch sessions');
              }
              
              let allSessions = parseSessionInfo(firstPageResponse);
              
              // Check for additional pages
              const totalPages = firstPageResponse.data.last_page || 1;
              
              // Fetch remaining pages (with a reasonable limit)
              const maxPagesToFetch = 5; // Limit to avoid excessive API calls
              const pagesToFetch = Math.min(totalPages, maxPagesToFetch);
              
              if (pagesToFetch > 1) {
                // Fetch all other pages except the first one which we already fetched
                for (let page = 2; page <= pagesToFetch; page++) {
                  try {
                    const pageResponse = await fetchSessionList(${courseId}, page);
                    const pageSessions = parseSessionInfo(pageResponse);
                    allSessions = [...allSessions, ...pageSessions];
                  } catch (pageError) {
                    console.error(\`Error fetching page \${page}:\`, pageError);
                  }
                }
              }
              
              return { 
                success: true,
                sessions: allSessions,
                totalPages: totalPages,
                courseId: ${courseId}
              };
            } catch (error) {
              console.error('Error in sessions retrieval:', error);
              return { 
                success: false, 
                message: error.message || 'Failed to fetch sessions',
                error: error.toString()
              };
            }
          }
          
          return getAllSessions();
        } catch (error) {
          return { 
            success: false, 
            message: error.message || 'Failed to process session data',
            error: error.toString()
          };
        }
      })();
    `);
    
    return result;
  } catch (error) {
    console.error('Error fetching course sessions:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to fetch course sessions',
      error: error.toString()
    };
  }
});

ipcMain.handle('get-dark-mode-status', async () => {
  try {
      const mode = await Store.getItem('darkMode') || 'system';
      // For backwards compatibility, convert boolean to string
      if (typeof mode === 'boolean') {
          return mode ? 'dark' : 'light';
      }
      return mode;
  } catch (error) {
      console.error('Error getting dark mode status:', error);
      return 'system';
  }
});

ipcMain.handle('toggle-dark-mode', async () => {
  try {
      const currentMode = await Store.getItem('darkMode') || 'system';
      let newMode;
      
      if (currentMode === 'light') {
          newMode = 'dark';
      } else if (currentMode === 'dark') {
          newMode = 'system';
      } else {
          newMode = 'light';
      }
      
      await Store.setItem('darkMode', newMode);
      return newMode;
  } catch (error) {
      console.error('Error toggling dark mode:', error);
      return 'system';
  }
});

ipcMain.handle('update-remote-server', (event, newConfig) => {
  try {
    // Start or stop the remote server based on updated config
    startRemoteServer(newConfig);
    return { success: true };
  } catch (error) {
    console.error('Error updating remote server:', error);
    return { success: false, error: error.message };
  }
});

// System notification handler
ipcMain.handle('show-notification', async (event, options) => {
  // Determine which icon to use based on platform
  const getIconPath = () => {
    const iconName = process.platform === 'darwin' ? 'icon.icns' : 'icon.ico';
    
    // For packaged app
    if (process.resourcesPath) {
      return path.join(process.resourcesPath, iconName);
    } 
    
    // Fallback for development environment
    return path.join(__dirname, '../build', iconName);
  };

  try {

    const iconPath = getIconPath();
    
    // Create notification options with platform-specific settings
    const notificationOptions = {
      title: options.title,
      body: options.body,
      icon: iconPath,
      silent: false
    };
    
    // Add taskbar/dock bounce effect on macOS for task queue completions
    if (process.platform === 'darwin' && options.isTaskQueue) {
      app.dock.bounce('critical');
    }
    
    // Show the notification
    const notification = new Notification(notificationOptions);
    notification.show();
    
    return { success: true };
  } catch (error) {
    console.error('Error showing notification:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-local-ip-addresses', () => {
  const networkInterfaces = os.networkInterfaces();
  const addresses = [];
  
  for (const interfaceName of Object.keys(networkInterfaces)) {
      for (const iface of networkInterfaces[interfaceName]) {
          // Skip over internal (non-public) and non-IPv4 addresses
          if (!iface.internal) {
              addresses.push(iface.address);
          }
      }
  }
  
  return addresses;
});

ipcMain.handle('open-external-url', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Failed to open external URL:', error);
    return { success: false, error: error.message };
  }
});