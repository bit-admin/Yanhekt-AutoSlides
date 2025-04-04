document.addEventListener('DOMContentLoaded', async () => {
    // Tab switching logic
    const tabs = document.querySelectorAll('.tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and content
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Show corresponding content
            const tabName = tab.getAttribute('data-tab');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });

    // Default rules
    const DEFAULT_RULES = `yanhekt.cn###root > div.app > div.sidebar-open:first-child
yanhekt.cn###root > div.app > div.BlankLayout_layout__kC9f3:last-child > div.ant-spin-nested-loading:nth-child(2) > div.ant-spin-container > div.index_liveWrapper__YGcpO > div.index_userlist__T-6xf:last-child > div.index_staticContainer__z3yt-
yanhekt.cn###ai-bit-shortcut
yanhekt.cn##div#ai-bit-animation-modal`;
    
    // Preference elements
    const allowBackgroundRunning = document.getElementById('allowBackgroundRunning');
    const cacheCleanInterval = document.getElementById('cacheCleanInterval');
    const gaussianBlurSigma = document.getElementById('gaussianBlurSigma');
    const btnClearCookies = document.getElementById('btnClearCookies');
    const btnClearAll = document.getElementById('btnClearAll');
    const blockingRules = document.getElementById('blockingRules');
    const btnApplyRules = document.getElementById('btnApplyRules');
    const btnResetRules = document.getElementById('btnResetRules');
    const btnSave = document.getElementById('btnSave');
    const btnCancel = document.getElementById('btnCancel');
    const btnDefault = document.getElementById('btnDefault');
    const pixelDiffThreshold = document.getElementById('pixelDiffThreshold');
    const changeRatioThreshold = document.getElementById('changeRatioThreshold');
    const hammingThresholdLow = document.getElementById('hammingThresholdLow');
    const hammingThresholdUp = document.getElementById('hammingThresholdUp');
    const ssimThreshold = document.getElementById('ssimThreshold');
    const verificationCount = document.getElementById('verificationCount');

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
    
    // Load current preferences
    try {
        const config = await window.electronAPI.getConfig();
        allowBackgroundRunning.checked = config.allowBackgroundRunning || false;
        cacheCleanInterval.value = config.cacheCleanInterval || 15;

        if (config.captureStrategy && config.captureStrategy.gaussianBlurSigma !== undefined) {
            gaussianBlurSigma.value = config.captureStrategy.gaussianBlurSigma;
        }

        if (config.captureStrategy && config.captureStrategy.pixelDiffThreshold !== undefined) {
            pixelDiffThreshold.value = config.captureStrategy.pixelDiffThreshold;
        }
        
        if (config.captureStrategy && config.captureStrategy.changeRatioThreshold !== undefined) {
            changeRatioThreshold.value = config.captureStrategy.changeRatioThreshold;
        }

        if (config.captureStrategy && config.captureStrategy.hammingThresholdLow !== undefined) {
            hammingThresholdLow.value = config.captureStrategy.hammingThresholdLow;
        }

        if (config.captureStrategy && config.captureStrategy.hammingThresholdUp !== undefined) {
            hammingThresholdUp.value = config.captureStrategy.hammingThresholdUp;
        }

        if (config.captureStrategy && config.captureStrategy.ssimThreshold !== undefined) {
            ssimThreshold.value = config.captureStrategy.ssimThreshold;
        }

        if (config.captureStrategy && config.captureStrategy.verificationCount !== undefined) {
            verificationCount.value = config.captureStrategy.verificationCount;
        }
        
        // Load blocking rules
        const rules = await window.electronAPI.getBlockingRules();
        blockingRules.value = rules || DEFAULT_RULES;
        enhanceBlockingRulesEditor();
    } catch (error) {
        console.error('Failed to load preferences:', error);
    }

    // Clear cookies handler
    btnClearCookies.addEventListener('click', async () => {
        try {
            btnClearCookies.disabled = true;
            const result = await window.electronAPI.clearCookies();
            btnClearCookies.disabled = false;
            
            if (result.success) {
                alert('Cookies cleared successfully');
            } else {
                alert('Failed to clear cookies');
            }
        } catch (error) {
            console.error('Error clearing cookies:', error);
            btnClearCookies.disabled = false;
            alert('Error clearing cookies: ' + error.message);
        }
    });

    // Clear all data handler
    btnClearAll.addEventListener('click', async () => {
        try {
            btnClearAll.disabled = true;
            const result = await window.electronAPI.clearAllData();
            btnClearAll.disabled = false;
            
            if (result.success) {
                alert('All data cleared successfully');
            } else {
                alert('Failed to clear all data');
            }
        } catch (error) {
            console.error('Error clearing all data:', error);
            btnClearAll.disabled = false;
            alert('Error clearing all data: ' + error.message);
        }
    });
    
    // Save button handler
    btnSave.addEventListener('click', async () => {
        try {
            // Get the current config first
            const config = await window.electronAPI.getConfig();
            
            // Update only the preferences-related settings
            const updatedConfig = {
                ...config,
                allowBackgroundRunning: allowBackgroundRunning.checked,
                cacheCleanInterval: parseInt(cacheCleanInterval.value, 10),
                captureStrategy: {
                    ...(config.captureStrategy || {}),
                    gaussianBlurSigma: parseFloat(gaussianBlurSigma.value),
                    pixelDiffThreshold: parseInt(pixelDiffThreshold.value, 10),
                    changeRatioThreshold: parseFloat(changeRatioThreshold.value),
                    hammingThresholdLow: parseInt(hammingThresholdLow.value),
                    hammingThresholdUp: parseInt(hammingThresholdUp.value),
                    ssimThreshold: parseFloat(ssimThreshold.value),
                    verificationCount: parseFloat(verificationCount.value)
                }
            };
            
            // Save the updated config
            await window.electronAPI.saveConfig(updatedConfig);
            
            // Save blocking rules separately and apply them
            await window.electronAPI.saveBlockingRules(blockingRules.value);
            await window.electronAPI.applyBlockingRules();
            
            // Update background running state
            if (allowBackgroundRunning.checked) {
                await window.electronAPI.enableBackgroundRunning();
            } else {
                await window.electronAPI.disableBackgroundRunning();
            }
            
            // Close the window
            window.close();
        } catch (error) {
            console.error('Failed to save preferences:', error);
            alert('Failed to save preferences: ' + error.message);
        }
    });
    
    // Cancel button handler
    btnCancel.addEventListener('click', () => {
        window.close();
    });
    
    // Default button handler
    btnDefault.addEventListener('click', async () => {
        // Set to default values for general settings
        allowBackgroundRunning.checked = false;
        cacheCleanInterval.value = 15;
        blockingRules.value = DEFAULT_RULES;

        // If on capture strategy tab, restore default strategy settings
        const captureTabActive = document.getElementById('capture-tab').classList.contains('active');
        if (captureTabActive) {
            gaussianBlurSigma.value = 0.5;
            pixelDiffThreshold.value = 30;
            changeRatioThreshold.value = 0.005;
            hammingThresholdLow.value = 0;
            hammingThresholdUp.value = 5;
            ssimThreshold.value = 0.999;
            verificationCount.value = 2
        }
        
        // If on profiles tab, restore default profiles
        const profilesTabActive = document.getElementById('profiles-tab').classList.contains('active');
        if (profilesTabActive) {
            // Define default values for built-in profiles
            const defaultProfiles = {
                "yanhekt_session": {
                    "name": "YanHeKT Session Player",
                    "elementSelector": "#video_id_topPlayer_html5_api",
                    "urlPattern": "yanhekt.cn/session",
                    "builtin": true,
                    "automation": {
                        "autoDetectEnd": true,
                        "endDetectionSelector": ".player-ended-poster",
                        "autoStartPlayback": true,
                        "playButtonSelector": ".player-mid-button-container button",
                        "countdownSelector": "",
                        "autoAdjustSpeed": false,
                        "speedSelector": "#video_id_mainPlayer_html5_api",
                        "playbackSpeed": "3.0",
                        "autoDetectTitle": true,
                        "courseTitleSelector": ".ant-breadcrumb li:nth-child(2) a",
                        "sessionInfoSelector": ".ant-breadcrumb li:nth-child(3) span",
                        "autoRetryError": true,
                        "errorSelector": ".vjs-errors-dialog",
                        "maxRetryAttempts": "30"
                    }
                },
                "yanhekt_live": {
                    "name": "YanHeKT Live Player",
                    "elementSelector": "#video_id_mainPlayer_html5_api",
                    "urlPattern": "yanhekt.cn/live",
                    "builtin": true,
                    "automation": {
                        "autoDetectEnd": true,
                        "endDetectionSelector": ".VideoResult_result__LdbB3",
                        "autoStartPlayback": true,
                        "playButtonSelector": ".player-mid-button-container button",
                        "countdownSelector": ".countdown-content",
                        "autoAdjustSpeed": false,
                        "speedSelector": "#video_id_mainPlayer_html5_api",
                        "playbackSpeed": "1.0",
                        "autoDetectTitle": true,
                        "courseTitleSelector": ".index_liveHeader__uN3uM",
                        "sessionInfoSelector": "",
                        "autoRetryError": true,
                        "errorSelector": ".vjs-errors-dialog",
                        "maxRetryAttempts": "3"
                    }
                }
            };
            
            // Get current config to preserve custom profiles
            try {
                const config = await window.electronAPI.getConfig();
                const currentProfiles = config.siteProfiles || {};
                
                // Reset built-in profiles while preserving custom ones
                for (const [id, profile] of Object.entries(defaultProfiles)) {
                    profiles[id] = profile;
                }
                
                // Preserve custom profiles
                for (const [id, profile] of Object.entries(currentProfiles)) {
                    if (!profile.builtin && id !== 'default') {
                        profiles[id] = profile;
                    }
                }
                
                // Clear existing profiles containers
                document.querySelector('.built-in-profiles .profiles-grid').innerHTML = '';
                document.querySelector('.custom-profiles .profiles-grid').innerHTML = '';
                
                // Recreate UI for all profiles
                for (const [id, profile] of Object.entries(profiles)) {
                    if (id !== 'default') {
                        createProfileSection(id, profile);
                    }
                }
                
                // Mark as changed
                hasChanges = true;
                
            } catch (error) {
                console.error('Failed to restore default profiles:', error);
                alert('Failed to restore default profiles: ' + error.message);
            }
        }
    });

    // Profiles related elements
    const profilesContainer = document.getElementById('profilesContainer');
    const profileTemplate = document.getElementById('profileTemplate');
    const newProfileName = document.getElementById('newProfileName');
    const btnCreateProfile = document.getElementById('btnCreateProfile');
    
    // Global buttons
    const btnRestoreDefaults = document.getElementById('btnRestoreDefaults');
    
    let profiles = {};
    let hasChanges = false;
    
    // Load all profiles from configuration
    async function loadAllProfiles() {
        try {
            const config = await window.electronAPI.getConfig();
            profiles = config.siteProfiles || {};
            
            // Clear existing profiles containers
            document.querySelector('.built-in-profiles .profiles-grid').innerHTML = '';
            document.querySelector('.custom-profiles .profiles-grid').innerHTML = '';
            
            // Create UI for each non-default profile
            for (const [id, profile] of Object.entries(profiles)) {
                if (id !== 'default') {
                    createProfileSection(id, profile);
                }
            }
        } catch (error) {
            console.error('Failed to load profiles:', error);
            alert('Failed to load profiles: ' + error.message);
        }
    }
    
    // Create settings section for a single profile          
    function createProfileSection(profileId, profile) {
        // Clone template
        const profileSection = profileTemplate.content.cloneNode(true).querySelector('.profile-card');
        
        // Set profile ID
        profileSection.dataset.profileId = profileId;
        
        // Add class for built-in profiles
        if (profile.builtin) {
            profileSection.classList.add('built-in');
        }
        
        // Set profile name
        const profileName = profileSection.querySelector('.profile-name');
        profileName.textContent = profile.name || profileId;
        
        // Set basic attributes
        const elementSelector = profileSection.querySelector('.profileElementSelector');
        const urlPattern = profileSection.querySelector('.profileUrlPattern');
        elementSelector.value = profile.elementSelector || '';
        urlPattern.value = profile.urlPattern || '';
        
        // Set automation attributes
        const automation = profile.automation || {};
        const endDetectionSelector = profileSection.querySelector('.profileEndDetectionSelector');
        const playButtonSelector = profileSection.querySelector('.profilePlayButtonSelector');
        const countdownSelector = profileSection.querySelector('.profileCountdownSelector');
        const speedSelector = profileSection.querySelector('.profileSpeedSelector');
        const playbackSpeed = profileSection.querySelector('.profilePlaybackSpeed');
        const courseTitleSelector = profileSection.querySelector('.profileCourseTitleSelector');
        const sessionInfoSelector = profileSection.querySelector('.profileSessionInfoSelector');
        const errorSelector = profileSection.querySelector('.profileErrorSelector');
        const maxRetryAttempts = profileSection.querySelector('.profileMaxRetryAttempts');
        
        endDetectionSelector.value = automation.endDetectionSelector || '';
        playButtonSelector.value = automation.playButtonSelector || '';
        countdownSelector.value = automation.countdownSelector || '';
        speedSelector.value = automation.speedSelector || '';
        playbackSpeed.value = automation.playbackSpeed || '2.0';
        courseTitleSelector.value = automation.courseTitleSelector || '';
        sessionInfoSelector.value = automation.sessionInfoSelector || '';
        errorSelector.value = automation.errorSelector || '';
        maxRetryAttempts.value = automation.maxRetryAttempts || '3';
        
        // Hide delete button for built-in profiles
        const deleteButton = profileSection.querySelector('.profile-delete-btn');
        if (profile.builtin) {
            deleteButton.style.display = 'none';
        } else {
            deleteButton.addEventListener('click', () => deleteProfile(profileId));
        }
        
        // Add change event to all inputs to mark changes
        const allInputs = profileSection.querySelectorAll('input, select');
        allInputs.forEach(input => {
            input.addEventListener('change', () => {
                hasChanges = true;
            });
        });
        
        // Add to appropriate container
        if (profile.builtin) {
            document.querySelector('.built-in-profiles .profiles-grid').appendChild(profileSection);
        } else {
            document.querySelector('.custom-profiles .profiles-grid').appendChild(profileSection);
        }
    }
    
    // Create new profile
    function createNewProfile() {
        const name = newProfileName.value.trim();
        if (!name) {
            alert('Please enter a profile name');
            return;
        }
        
        // Create unique ID
        const profileId = 'profile_' + Date.now();
        
        // Create new profile with default values
        const newProfile = {
            name: name,
            elementSelector: '',
            urlPattern: '',
            automation: {
                // No boolean flags here, only configuration values
                endDetectionSelector: '',
                playButtonSelector: '',
                countdownSelector: '',
                speedSelector: '',
                playbackSpeed: '2.0',
                courseTitleSelector: '',
                sessionInfoSelector: '',
                errorSelector: '',
                maxRetryAttempts: '3'
            }
        };
        
        // Add to profiles object
        profiles[profileId] = newProfile;
        
        // Create UI element
        createProfileSection(profileId, newProfile);
        
        // Clear input field
        newProfileName.value = '';
        
        // Mark changes
        hasChanges = true;
    }
    
    // Delete profile
    function deleteProfile(profileId) {
        if (confirm(`Are you sure you want to delete the profile "${profiles[profileId].name}"?`)) {
            // Fix the selector - use profile-card instead of profile-section
            const profileCard = document.querySelector(`.profile-card[data-profile-id="${profileId}"]`);
            if (profileCard) {
                // Find the correct parent container
                profileCard.parentNode.removeChild(profileCard);
            }
            
            // Remove data
            delete profiles[profileId];
            
            // Mark changes
            hasChanges = true;
        }
    }
    
    async function saveAllProfiles() {
        try {
            // Get current config
            const config = await window.electronAPI.getConfig();
            const currentProfiles = config.siteProfiles || {};
            
            // FIXED SELECTOR: Use .profile-card instead of .profile-section
            const profileCards = document.querySelectorAll('.profile-card');
            for (const card of profileCards) {
                const profileId = card.dataset.profileId;
                if (profileId && profiles[profileId]) {
                    const profile = profiles[profileId];
                    
                    // Update basic attributes
                    profile.elementSelector = card.querySelector('.profileElementSelector').value;
                    profile.urlPattern = card.querySelector('.profileUrlPattern').value;
                    
                    // Initialize or get existing automation object
                    if (!profile.automation) profile.automation = {};
                    
                    // Get the current automation settings that might have checkbox states
                    const currentAutomation = currentProfiles[profileId]?.automation || {};
                    
                    // Preserve checkbox states from current config if they exist
                    profile.automation.autoDetectEnd = currentAutomation.autoDetectEnd || false;
                    profile.automation.autoStartPlayback = currentAutomation.autoStartPlayback || false;
                    profile.automation.autoAdjustSpeed = currentAutomation.autoAdjustSpeed || false;
                    profile.automation.autoDetectTitle = currentAutomation.autoDetectTitle || false;
                    profile.automation.autoRetryError = currentAutomation.autoRetryError || false;
                    
                    // Update configuration fields (not checkbox states)
                    profile.automation.endDetectionSelector = card.querySelector('.profileEndDetectionSelector').value;
                    profile.automation.playButtonSelector = card.querySelector('.profilePlayButtonSelector').value;
                    profile.automation.countdownSelector = card.querySelector('.profileCountdownSelector').value;
                    profile.automation.speedSelector = card.querySelector('.profileSpeedSelector').value;
                    profile.automation.playbackSpeed = card.querySelector('.profilePlaybackSpeed').value;
                    profile.automation.courseTitleSelector = card.querySelector('.profileCourseTitleSelector').value;
                    profile.automation.sessionInfoSelector = card.querySelector('.profileSessionInfoSelector').value;
                    profile.automation.errorSelector = card.querySelector('.profileErrorSelector').value;
                    profile.automation.maxRetryAttempts = card.querySelector('.profileMaxRetryAttempts').value;
                }
            }
            
            // Update profiles in configuration
            config.siteProfiles = profiles;
            
            // Save configuration
            await window.electronAPI.saveConfig(config);
            
            // Send a message to the main window to update profile dropdown
            await window.electronAPI.sendToMainWindow('update-profiles', profiles);
            
            hasChanges = false;
            return true;
        } catch (error) {
            console.error('Failed to save profiles:', error);
            alert('Failed to save profiles: ' + error.message);
            return false;
        }
    }
    
    // Bind events
    btnCreateProfile.addEventListener('click', createNewProfile);
    
    // Load data when Profiles tab is displayed
    document.querySelector('.tab[data-tab="profiles"]').addEventListener('click', loadAllProfiles);
    
    // Enhance Save button to save profiles
    btnSave.addEventListener('click', async function() {
        // Check if on Profiles tab
        const profilesTabActive = document.getElementById('profiles-tab').classList.contains('active');
        
        if (profilesTabActive && hasChanges) {
            await saveAllProfiles();
        }
    });
    
    // Enhance Cancel button to reload profiles
    btnCancel.addEventListener('click', function() {
        const profilesTabActive = document.getElementById('profiles-tab').classList.contains('active');
        
        if (profilesTabActive && hasChanges) {
            loadAllProfiles();
            hasChanges = false;
        }
    });
    
    // Initial load of profiles
    if (document.getElementById('profiles-tab').classList.contains('active')) {
        loadAllProfiles();
    }

    // Default profile crop settings
    const inputTopCrop = document.getElementById('inputTopCrop');
    const inputBottomCrop = document.getElementById('inputBottomCrop');
    const btnShowCropGuides = document.getElementById('btnShowCropGuides');
    
    // Load crop settings from config
    async function loadCropSettings() {
        try {
            const config = await window.electronAPI.getConfig();
            inputTopCrop.value = config.topCropPercent || 5;
            inputBottomCrop.value = config.bottomCropPercent || 5;
        } catch (error) {
            console.error('Failed to load crop settings:', error);
        }
    }
    
    // Show crop guides button handler
    btnShowCropGuides.addEventListener('click', async () => {
        try {
            // Save current crop settings first
            const config = await window.electronAPI.getConfig();
            config.topCropPercent = parseFloat(inputTopCrop.value);
            config.bottomCropPercent = parseFloat(inputBottomCrop.value);
            await window.electronAPI.saveConfig(config);
            
            // Tell main window to show crop guides
            await window.electronAPI.sendToMainWindow('show-crop-guides');
        } catch (error) {
            console.error('Failed to show crop guides:', error);
            alert('Failed to show crop guides: ' + error.message);
        }
    });
    
    // Mark changes and show real-time preview when crop settings change
    inputTopCrop.addEventListener('input', async () => {
        hasChanges = true;
        await updateCropPreviewInMainWindow();
    });
    
    inputBottomCrop.addEventListener('input', async () => {
        hasChanges = true;
        await updateCropPreviewInMainWindow();
    });
    
    // Focus events to show crop guides
    inputTopCrop.addEventListener('focus', async () => {
        await updateCropPreviewInMainWindow();
    });
    
    inputBottomCrop.addEventListener('focus', async () => {
        await updateCropPreviewInMainWindow();
    });
    
    // Helper function to update crop preview in main window
    async function updateCropPreviewInMainWindow() {
        try {
            // Send current values directly to main window without saving to config
            await window.electronAPI.sendToMainWindow('update-crop-preview', {
                topCropPercent: parseFloat(inputTopCrop.value) || 0,
                bottomCropPercent: parseFloat(inputBottomCrop.value) || 0
            });
        } catch (error) {
            console.error('Failed to update crop preview:', error);
        }
    }
    
    // Load crop settings when Profiles tab is displayed
    document.querySelector('.tab[data-tab="profiles"]').addEventListener('click', () => {
        loadCropSettings();
        // Also load profiles (existing functionality)
        if (typeof loadAllProfiles === 'function') {
            loadAllProfiles();
        }
    });
    
    // Enhance save button to also save crop settings
    const originalSaveHandler = btnSave.onclick;
    btnSave.onclick = async function() {
        const profilesTabActive = document.getElementById('profiles-tab').classList.contains('active');
        
        if (profilesTabActive) {
            try {
                // Save crop settings
                const config = await window.electronAPI.getConfig();
                config.topCropPercent = parseFloat(inputTopCrop.value);
                config.bottomCropPercent = parseFloat(inputBottomCrop.value);
                await window.electronAPI.saveConfig(config);
            } catch (error) {
                console.error('Failed to save crop settings:', error);
                alert('Failed to save crop settings: ' + error.message);
                return;
            }
        }
        
        // Call original save handler for other settings
        if (originalSaveHandler) {
            return originalSaveHandler.call(this);
        }
    };
    
    // Also restore crop settings when defaults are restored
    const enhanceResetDefaults = btnDefault.onclick;
    btnDefault.addEventListener('click', async function() {
        const profilesTabActive = document.getElementById('profiles-tab').classList.contains('active');
        
        if (profilesTabActive) {
            // Reset crop settings to defaults
            inputTopCrop.value = 5;
            inputBottomCrop.value = 5;
            hasChanges = true;
        }
        
        // Call original handler
        if (enhanceResetDefaults) {
            return enhanceResetDefaults.call(this);
        }
    });
    
    // Initial load if profiles tab is active
    if (document.getElementById('profiles-tab').classList.contains('active')) {
        loadCropSettings();
    }
});