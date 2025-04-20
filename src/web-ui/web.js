document.addEventListener('DOMContentLoaded', () => {
    // Dark mode toggle functionality
    const themeToggle = document.getElementById('theme-toggle');
    const lightIcon = document.getElementById('light-icon');
    const darkIcon = document.getElementById('dark-icon');
    const themeText = document.getElementById('theme-text');

    // Check for saved theme preference or use system preference
    function getThemePreference() {
        const savedTheme = localStorage.getItem('theme');
        
        if (savedTheme) {
            return savedTheme;
        }
        
        // Use system preference as default
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // Apply theme based on preference
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            lightIcon.style.display = 'none';
            darkIcon.style.display = 'block';
            themeText.textContent = 'Light';
        } else {
            document.body.classList.remove('dark-mode');
            lightIcon.style.display = 'block';
            darkIcon.style.display = 'none';
            themeText.textContent = 'Dark';
        }
    }

    // Set initial theme
    const currentTheme = getThemePreference();
    applyTheme(currentTheme);

    // Toggle theme when button is clicked
    themeToggle.addEventListener('click', () => {
        const isDarkMode = document.body.classList.contains('dark-mode');
        const newTheme = isDarkMode ? 'light' : 'dark';
        
        // Save preference
        localStorage.setItem('theme', newTheme);
        
        // Apply theme
        applyTheme(newTheme);
        
        // Debug info - can be removed after testing
        console.log(`Theme toggled to: ${newTheme}`);
    });

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        // Only apply system change if user hasn't set a preference
        if (!localStorage.getItem('theme')) {
            const newTheme = e.matches ? 'dark' : 'light';
            applyTheme(newTheme);
        }
    });

    // Notification system
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notification-message');
    const closeNotification = document.getElementById('close-notification');
    
    let notificationTimeout;
    
    // Function to show a notification
    function showNotification(message, type = 'success', duration = 3000) {
        // Clear any existing timeout
        if (notificationTimeout) {
            clearTimeout(notificationTimeout);
        }
        
        // Set the message
        notificationMessage.textContent = message;
        
        // Reset classes
        notification.className = 'notification';
        
        // Add the type class
        notification.classList.add(type);
        
        // Set the appropriate icon based on type
        const iconContainer = document.getElementById('notification-icon');
        if (type === 'success') {
            iconContainer.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#28a745" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
            `;
        } else if (type === 'error') {
            iconContainer.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            `;
        } else {
            iconContainer.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007bff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
            `;
        }
        
        // Show the notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Set timeout to hide it
        notificationTimeout = setTimeout(() => {
            notification.classList.remove('show');
        }, duration);
    }
    
    // Close notification when clicking the X
    closeNotification.addEventListener('click', () => {
        notification.classList.remove('show');
        if (notificationTimeout) {
            clearTimeout(notificationTimeout);
        }
    });

    // New function to check task status without setting up polling
    async function checkTaskStatus() {
        try {
            const response = await fetch('/api/task-status');
            const result = await response.json();
            
            if (result.success && result.isProcessing) {
                let statusMsg = result.status || `Processing task ${result.currentTaskIndex + 1} of ${result.totalTasks}`;
                
                if (result.slideCount) {
                    statusMsg += ` (${result.slideCount})`;
                }
                
                // Update status display with 'progress' class and start polling
                updateTaskStatus(statusMsg, 'progress', 0); // No timeout
                pollTaskStatus();
            }
        } catch (error) {
            console.error('Error checking task status:', error);
        }
    }

    function updateTaskStatus(message, type = null, timeout = 3000) {
        const taskStatus = document.getElementById('task-status');
        
        if (!taskStatus) return;
        
        // Update message
        taskStatus.textContent = message;
        
        // Update class based on type
        taskStatus.className = 'token-status';
        if (type === 'error') {
            taskStatus.classList.add('error');
        } else if (type === 'success') {
            taskStatus.classList.add('success');
        } else if (type === 'progress') {
            taskStatus.classList.add('progress');
        }
        
        // Only reset to idle for success/error messages, not for progress
        if (timeout > 0 && (type === 'error' || type === 'success')) {
            setTimeout(() => {
                taskStatus.textContent = 'Idle';
                taskStatus.className = 'token-status';
            }, timeout);
        }
    }

    // Function to fetch and display the current task queue
    async function fetchTaskQueue() {
        try {
            const response = await fetch('/api/tasks');
            const result = await response.json();
            
            const taskTableBody = document.getElementById('web-task-table-body');
            
            if (!result.success) {
                console.error('Failed to fetch tasks:', result.message);
                taskTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="no-tasks-message">Error loading tasks: ${result.message || 'Unknown error'}</td>
                    </tr>
                `;
                return;
            }
            
            if (!result.tasks || result.tasks.length === 0) {
                taskTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="no-tasks-message">No tasks in queue</td>
                    </tr>
                `;
                return;
            }
            
            // Create table rows for each task
            let tableHTML = '';
            result.tasks.forEach((task, i) => {
                const isCurrentTask = result.isProcessing && i === result.currentTaskIndex;
                
                tableHTML += `
                    <tr${isCurrentTask ? ' class="current-task"' : ''}>
                        <td>${i + 1}</td>
                        <td>${task.profileName || task.profileId}</td>
                        <td>${task.taskId}</td>
                        <td>
                            <div class="task-status-cell">
                                ${isCurrentTask ? '<span class="task-status-indicator processing"></span>' : 
                                                '<span class="task-status-indicator pending"></span>'}
                                <span class="task-info-text">${task.courseInfo || task.url || ''}</span>
                            </div>
                        </td>
                        <td>
                            ${isCurrentTask ? '' : `<button class="task-remove-btn" data-index="${i}">×</button>`}
                        </td>
                    </tr>
                `;
            });
            
            taskTableBody.innerHTML = tableHTML;
            
            // Add event listeners to delete buttons
            document.querySelectorAll('.task-remove-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const index = parseInt(this.getAttribute('data-index'), 10);
                    removeTask(index);
                });
            });
            
        } catch (error) {
            console.error('Error fetching task queue:', error);
            document.getElementById('web-task-table-body').innerHTML = `
                <tr>
                    <td colspan="5" class="no-tasks-message">Error loading tasks: ${error.message || 'Connection failed'}</td>
                </tr>
            `;
        }
    }
    
    // Function to remove a specific task
    async function removeTask(index) {
        try {
            updateTaskStatus(`Removing task at position ${index + 1}...`, 'progress');
            
            const response = await fetch(`/api/tasks/${index}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                updateTaskStatus(`Task removed successfully`, 'success');
                // Refresh the task queue
                fetchTaskQueue();
            } else {
                throw new Error(result.message || 'Failed to remove task');
            }
        } catch (error) {
            console.error('Error removing task:', error);
            updateTaskStatus(`Error: ${error.message || 'Failed to remove task'}`, 'error');
        }
    }
    
    // Function to clear all tasks
    async function clearAllTasks() {
        try {
            updateTaskStatus('Clearing all tasks...', 'progress');
            
            const response = await fetch('/api/tasks', {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                updateTaskStatus('All tasks cleared', 'success');
                // Refresh the task queue
                fetchTaskQueue();
            } else {
                throw new Error(result.message || 'Failed to clear tasks');
            }
        } catch (error) {
            console.error('Error clearing tasks:', error);
            updateTaskStatus(`Error: ${error.message || 'Failed to clear tasks'}`, 'error');
        }
    }

    // Token handling
    const tokenField = document.getElementById('tokenField');
    const btnTogglePassword = document.getElementById('btnTogglePassword');
    const btnRetrieveToken = document.getElementById('btnRetrieveToken');
    const btnCopyToken = document.getElementById('btnCopyToken');
    const tokenStatus = document.getElementById('tokenStatus');

    // Toggle password visibility
    btnTogglePassword.addEventListener('click', () => {
        if (tokenField.type === 'password') {
            tokenField.type = 'text';
            btnTogglePassword.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M3 3l18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
        } else {
            tokenField.type = 'password';
            btnTogglePassword.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
        }
    });

    // Retrieve token
    btnRetrieveToken.addEventListener('click', async () => {
        try {
            tokenStatus.textContent = 'Retrieving token...';
            tokenStatus.className = 'token-status';
            
            const response = await fetch('/api/retrieve-token');
            const result = await response.json();
            
            if (result.success && result.token) {
                tokenField.value = result.token;
                tokenStatus.textContent = 'Token retrieved successfully';
                tokenStatus.className = 'token-status success';
            } else {
                tokenStatus.textContent = result.message || 'No token found. Please log in to YanHeKT in the main app first.';
                tokenStatus.className = 'token-status error';
            }
        } catch (error) {
            console.error('Error retrieving token:', error);
            tokenStatus.textContent = `Error: ${error.message || 'Failed to retrieve token'}`;
            tokenStatus.className = 'token-status error';
        }
    });

    // Copy token to clipboard
    btnCopyToken.addEventListener('click', () => {
        if (!tokenField.value) {
            tokenStatus.textContent = 'No token to copy';
            tokenStatus.className = 'token-status error';
            return;
        }
        
        navigator.clipboard.writeText(tokenField.value)
            .then(() => {
                tokenStatus.textContent = 'Token copied to clipboard';
                tokenStatus.className = 'token-status success';
                setTimeout(() => {
                    tokenStatus.textContent = '';
                }, 3000);
            })
            .catch(err => {
                console.error('Failed to copy token:', err);
                tokenStatus.textContent = 'Failed to copy token';
                tokenStatus.className = 'token-status error';
            });
    });

    // Course Management
    const fetchCoursesBtn = document.getElementById('fetch-courses-btn');
    const coursesStatus = document.getElementById('courses-status');
    const courseListContainer = document.getElementById('course-list-container');

    // Function to create a course card
    function createCourseCard(course) {
        const card = document.createElement('div');
        card.className = 'course-card';
        
        // Title
        const titleContainer = document.createElement('div');
        titleContainer.className = 'course-header';
        
        const title = document.createElement('div');
        title.className = 'course-title';
        const fullTitle = course.nameEn || course.nameZh || 'Unnamed Course';
        title.textContent = fullTitle;
        title.setAttribute('title', fullTitle);
        
        titleContainer.appendChild(title);
        card.appendChild(titleContainer);
        
        // Course info table
        const infoTable = document.createElement('div');
        infoTable.className = 'course-info-table';
        
        // Course ID
        const idRow = document.createElement('div');
        idRow.className = 'course-info-row';
        
        const idLabel = document.createElement('div');
        idLabel.className = 'course-info-label';
        idLabel.textContent = 'Course ID:';
        
        const idValue = document.createElement('div');
        idValue.className = 'course-info-value highlight';
        idValue.textContent = course.id;
        
        idRow.appendChild(idLabel);
        idRow.appendChild(idValue);
        infoTable.appendChild(idRow);
        
        // Course details
        const details = [
            { label: 'Name', value: course.nameZh },
            { label: 'College', value: course.collegeName },
            { label: 'Year', value: course.schoolYear },
            { label: 'Semester', value: course.semester },
            { label: 'Participants', value: course.participantCount }
        ];
        
        details.forEach(detail => {
            if (detail.value) {
                const row = document.createElement('div');
                row.className = 'course-info-row';
                
                const label = document.createElement('div');
                label.className = 'course-info-label';
                label.textContent = `${detail.label}:`;
                
                const value = document.createElement('div');
                value.className = 'course-info-value';
                value.textContent = detail.value;
                
                row.appendChild(label);
                row.appendChild(value);
                infoTable.appendChild(row);
            }
        });
        
        // Professor information
        if (course.professors && course.professors.length > 0) {
            const profRow = document.createElement('div');
            profRow.className = 'course-info-row professors-row';
            
            const profLabel = document.createElement('div');
            profLabel.className = 'course-info-label';
            profLabel.textContent = 'Professors:';
            
            const profValue = document.createElement('div');
            profValue.className = 'course-info-value';
            profValue.textContent = course.professors.map(p => typeof p === 'object' ? p.name : p).join(', ');
            
            profRow.appendChild(profLabel);
            profRow.appendChild(profValue);
            infoTable.appendChild(profRow);
        }
        
        card.appendChild(infoTable);
        
        // Add "Get Sessions Info" button
        const getSessionsBtn = document.createElement('button');
        getSessionsBtn.className = 'get-sessions-btn';
        getSessionsBtn.textContent = 'Get Sessions Info';
        getSessionsBtn.dataset.courseId = course.id;
        getSessionsBtn.addEventListener('click', () => {
            // Fill the course ID input and trigger fetch
            document.getElementById('session-course-id').value = course.id;
            fetchCourseSessions(course.id);
        });
        card.appendChild(getSessionsBtn);
        
        return card;
    }

    // Function to fetch courses
    fetchCoursesBtn.addEventListener('click', async () => {
        try {
            // Clear previous course cards
            courseListContainer.innerHTML = '';
            
            // Update status
            coursesStatus.textContent = 'Fetching course data...';
            
            // Fetch course data
            const response = await fetch('/api/courses');
            const result = await response.json();
            
            if (result.success && result.courses && result.courses.length > 0) {             
                // Create a scrollable wrapper for course cards
                const coursesRow = document.createElement('div');
                coursesRow.className = 'scrollable-horizontal';
                
                // Create and display course cards
                result.courses.forEach(course => {
                    const card = createCourseCard(course);
                    coursesRow.appendChild(card);
                });
                
                courseListContainer.appendChild(coursesRow);
                
                coursesStatus.textContent = `Found ${result.courses.length} courses`;
                setTimeout(() => {
                    coursesStatus.textContent = 'Idle';
                }, 3000);
            } else {
                const errorMsg = result.message || 'No courses found or failed to retrieve courses';
                coursesStatus.textContent = `Error: ${errorMsg}`;
                courseListContainer.innerHTML = `<div class="empty-state">
                    <div class="empty-state-title">No courses found</div>
                    <div class="empty-state-message">${errorMsg}</div>
                </div>`;
                setTimeout(() => {
                    coursesStatus.textContent = 'Idle';
                }, 3000);
            }
        } catch (error) {
            console.error('Error fetching courses:', error);
            coursesStatus.textContent = `Error: ${error.message || 'Unknown error'}`;
            setTimeout(() => {
                coursesStatus.textContent = 'Idle';
            }, 3000);
        }
    });

    // Session Management
    const fetchSessionsBtn = document.getElementById('fetch-sessions-btn');
    const sessionsStatus = document.getElementById('sessions-status');
    const sessionCourseId = document.getElementById('session-course-id');
    const sessionListContainer = document.getElementById('session-list-container');

    // Function to create a session card
    function createSessionCard(session) {
        const card = document.createElement('div');
        card.className = 'session-card';
        
        // Set the week attribute for styling
        if (session.weekNumber) {
            card.setAttribute('data-week', session.weekNumber);
        }
        
        // Session Header
        const headerDiv = document.createElement('div');
        headerDiv.className = 'session-header';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'session-title';
        titleDiv.textContent = session.title || 'Untitled Session';
        titleDiv.setAttribute('title', session.title || 'Untitled Session');
        
        headerDiv.appendChild(titleDiv);
        card.appendChild(headerDiv);
        
        const infoTable = document.createElement('div');
        infoTable.className = 'course-info-table';
        infoTable.style.gridTemplateColumns = '50px 1fr'; 
        
        // Session ID
        const idRow = document.createElement('div');
        idRow.className = 'course-info-row';
        
        const idLabel = document.createElement('div');
        idLabel.className = 'course-info-label';
        idLabel.textContent = 'ID:';
        
        const idValue = document.createElement('div');
        idValue.className = 'course-info-value highlight';
        idValue.textContent = session.sessionId;
        
        idRow.appendChild(idLabel);
        idRow.appendChild(idValue);
        infoTable.appendChild(idRow);
        
        // Week
        if (session.weekNumber) {
            const weekRow = document.createElement('div');
            weekRow.className = 'course-info-row';
            
            const weekLabel = document.createElement('div');
            weekLabel.className = 'course-info-label';
            weekLabel.textContent = 'Week:';
            
            const weekValue = document.createElement('div');
            weekValue.className = 'course-info-value';
            weekValue.textContent = session.weekNumber;
            
            weekRow.appendChild(weekLabel);
            weekRow.appendChild(weekValue);
            infoTable.appendChild(weekRow);
        }
        
        // Day
        if (session.dayOfWeek) {
            const dayRow = document.createElement('div');
            dayRow.className = 'course-info-row';
            
            const dayLabel = document.createElement('div');
            dayLabel.className = 'course-info-label';
            dayLabel.textContent = 'Day:';
            
            const dayValue = document.createElement('div');
            dayValue.className = 'course-info-value';
            const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            dayValue.textContent = days[session.dayOfWeek] || `Day ${session.dayOfWeek}`;
            
            dayRow.appendChild(dayLabel);
            dayRow.appendChild(dayValue);
            infoTable.appendChild(dayRow);
        }
        
        // Date/Time
        if (session.startedAt) {
            const timeRow = document.createElement('div');
            timeRow.className = 'course-info-row';
            
            const timeLabel = document.createElement('div');
            timeLabel.className = 'course-info-label';
            timeLabel.textContent = 'Time:';
            
            const timeValue = document.createElement('div');
            timeValue.className = 'course-info-value';
            
            // Format the date nicely
            const startDate = new Date(session.startedAt);
            const dateStr = startDate.toLocaleDateString();
            const timeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            timeValue.textContent = `${dateStr} ${timeStr}`;
            
            timeRow.appendChild(timeLabel);
            timeRow.appendChild(timeValue);
            infoTable.appendChild(timeRow);
        }
        
        card.appendChild(infoTable);

        // Add "Add to Tasks" button
        const addToTasksBtn = document.createElement('button');
        addToTasksBtn.className = 'add-to-tasks-btn';
        addToTasksBtn.textContent = 'Add to Tasks';
        addToTasksBtn.dataset.sessionId = session.sessionId;
        addToTasksBtn.dataset.title = session.title || 'Untitled Session';
        addToTasksBtn.addEventListener('click', () => {
            // Pass the courseId as the fourth parameter
            sendTaskToMainWindow('session', session.sessionId, session.title || 'Untitled Session', session.courseId);
        });
        card.appendChild(addToTasksBtn);

        return card;
    }

    // Function to fetch sessions for a course
    async function fetchCourseSessions(courseId) {
        try {
            // Validate course ID
            if (!courseId) {
                // Now update the courses-status instead of sessions-status
                coursesStatus.textContent = 'Error: Course ID is required';
                setTimeout(() => {
                    coursesStatus.textContent = 'Idle';
                }, 3000);
                return;
            }
            
            // Clear previous session cards
            sessionListContainer.innerHTML = '';
            
            // Hide the Add All button while loading
            document.getElementById('add-all-sessions-btn').style.display = 'none';
            
            // Update status - now using coursesStatus
            coursesStatus.textContent = 'Fetching session data...';
            
            // Fetch session data
            const response = await fetch(`/api/sessions?courseId=${courseId}`);
            const result = await response.json();
            
            if (result.success && result.sessions && result.sessions.length > 0) {
                // Show the Add All button if we have sessions
                const addAllBtn = document.getElementById('add-all-sessions-btn');
                addAllBtn.style.display = 'flex';
                
                // Set up the Add All button click handler
                addAllBtn.onclick = () => {
                    sendAllSessionsToMainWindow(result.sessions);
                };
                
                // Sort by week number (descending) then day of week
                result.sessions.sort((a, b) => {
                    if (b.weekNumber !== a.weekNumber) {
                        return b.weekNumber - a.weekNumber;
                    }
                    if (a.dayOfWeek !== b.dayOfWeek) {
                        return a.dayOfWeek - b.dayOfWeek;
                    }
                    return new Date(a.startedAt) - new Date(b.startedAt);
                });
                
                // Create a scrollable container for sessions
                const sessionsRow = document.createElement('div');
                sessionsRow.className = 'scrollable-horizontal';
                
                // Create and display session cards
                result.sessions.forEach(session => {
                    const card = createSessionCard(session);
                    sessionsRow.appendChild(card);
                });
                
                sessionListContainer.appendChild(sessionsRow);
                
                coursesStatus.textContent = `Found ${result.sessions.length} sessions`;
                setTimeout(() => {
                    coursesStatus.textContent = 'Idle';
                }, 3000);
            } else {
                const errorMsg = result.message || 'No sessions found or failed to retrieve sessions';
                coursesStatus.textContent = `Error: ${errorMsg}`;
                sessionListContainer.innerHTML = `<div class="empty-state">
                    <div class="empty-state-title">No sessions found</div>
                    <div class="empty-state-message">${errorMsg}</div>
                </div>`;
                setTimeout(() => {
                    coursesStatus.textContent = 'Idle';
                }, 3000);
            }
        } catch (error) {
            console.error('Error fetching sessions:', error);
            coursesStatus.textContent = `Error: ${error.message || 'Unknown error'}`;
            setTimeout(() => {
                coursesStatus.textContent = 'Idle';
            }, 3000);
        }
    }

    // Add event listener for fetch sessions button
    fetchSessionsBtn.addEventListener('click', () => {
        const courseId = sessionCourseId.value.trim();
        fetchCourseSessions(courseId);
    });

    // Add event listener for enter key in course ID input
    sessionCourseId.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const courseId = sessionCourseId.value.trim();
            fetchCourseSessions(courseId);
        }
    });

    // Live courses functionality
    const fetchLiveCoursesBtn = document.getElementById('fetch-live-courses-btn');
    const liveCoursesStatus = document.getElementById('live-courses-status');
    const liveCourseListContainer = document.getElementById('live-course-list-container');

    // Function to fetch live courses
    async function fetchLiveCourses() {
        try {
            // Clear previous live course cards
            liveCourseListContainer.innerHTML = '';
            
            // Hide the Add All button while loading
            document.getElementById('add-all-lives-btn').style.display = 'none';
            
            // Update status
            liveCoursesStatus.textContent = 'Fetching live courses...';
            
            // Fetch live courses data
            const response = await fetch('/api/live-courses');
            const result = await response.json();
            
            if (result.success && result.liveCourses && result.liveCourses.length > 0) {
                // Find active courses (status 1 = live, status 2 = Upcoming)
                const activeLiveCourses = result.liveCourses.filter(course => course.status === 1 || course.status === 2);
                
                // Show the Add All button if we have active courses
                if (activeLiveCourses.length > 0) {
                    const addAllBtn = document.getElementById('add-all-lives-btn');
                    addAllBtn.style.display = 'flex';
                    
                    // Set up the Add All button click handler
                    addAllBtn.onclick = () => {
                        sendAllLivesToMainWindow(activeLiveCourses);
                    };
                }
                
                // Create a scrollable container for live courses
                const livesRow = document.createElement('div');
                livesRow.className = 'scrollable-horizontal';
                
                // Sort live courses by status
                result.liveCourses.sort((a, b) => {
                    // Sort logic remains unchanged
                });
                
                // Create and display live course cards
                result.liveCourses.forEach(liveCourse => {
                    const card = createLiveCourseCard(liveCourse);
                    livesRow.appendChild(card);
                });
                
                liveCourseListContainer.appendChild(livesRow);
                
                liveCoursesStatus.textContent = `Found ${result.liveCourses.length} live courses`;
                setTimeout(() => {
                    liveCoursesStatus.textContent = 'Idle';
                }, 3000);
            } else {
                const errorMsg = result.message || 'No live courses found or failed to retrieve courses';
                liveCoursesStatus.textContent = `Error: ${errorMsg}`;
                liveCourseListContainer.innerHTML = `<div class="empty-state">
                    <div class="empty-state-title">No live courses found</div>
                    <div class="empty-state-message">${errorMsg}</div>
                </div>`;
                setTimeout(() => {
                    liveCoursesStatus.textContent = 'Idle';
                }, 3000);
            }
        } catch (error) {
            console.error('Error fetching live courses:', error);
            liveCoursesStatus.textContent = `Error: ${error.message || 'Unknown error'}`;
            setTimeout(() => {
                liveCoursesStatus.textContent = 'Idle';
            }, 3000);
        }
    }

    // Function to create a live course card
    function createLiveCourseCard(liveCourse) {
        const card = document.createElement('div');
        card.className = 'course-card live-course-card';
        
        // Add status badge based on status
        const statusBadge = document.createElement('div');
        statusBadge.className = `status-badge status-${liveCourse.status}`;
        statusBadge.textContent = liveCourse.statusText;
        card.appendChild(statusBadge);
        
        // Title
        const titleContainer = document.createElement('div');
        titleContainer.className = 'course-header';
        
        const title = document.createElement('div');
        title.className = 'course-title';
        // Use course name or title without adding "Live" prefix
        const fullTitle = liveCourse.courseName || liveCourse.title || 'Unnamed Course';
        title.textContent = fullTitle;
        title.setAttribute('title', fullTitle);
        
        titleContainer.appendChild(title);
        card.appendChild(titleContainer);
        
        // Course info table
        const infoTable = document.createElement('div');
        infoTable.className = 'course-info-table';
        
        // Live ID
        const idRow = document.createElement('div');
        idRow.className = 'course-info-row';
        
        const idLabel = document.createElement('div');
        idLabel.className = 'course-info-label';
        idLabel.textContent = 'Live ID:';
        
        const idValue = document.createElement('div');
        idValue.className = 'course-info-value highlight';
        idValue.textContent = liveCourse.liveId;
        
        idRow.appendChild(idLabel);
        idRow.appendChild(idValue);
        infoTable.appendChild(idRow);
        
        // Course ID (if available)
        if (liveCourse.courseId) {
            const courseIdRow = document.createElement('div');
            courseIdRow.className = 'course-info-row';
            
            const courseIdLabel = document.createElement('div');
            courseIdLabel.className = 'course-info-label';
            courseIdLabel.textContent = 'Course ID:';
            
            const courseIdValue = document.createElement('div');
            courseIdValue.className = 'course-info-value';
            courseIdValue.textContent = liveCourse.courseId;
            
            courseIdRow.appendChild(courseIdLabel);
            courseIdRow.appendChild(courseIdValue);
            infoTable.appendChild(courseIdRow);
        }
        
        // Live course details
        const details = [
            { label: 'Location', value: liveCourse.subtitle || liveCourse.location },
            { label: 'Professor', value: liveCourse.professorName },
            { label: 'Participants', value: liveCourse.participantCount > 0 ? liveCourse.participantCount : undefined },
        ];
        
        details.forEach(detail => {
            if (detail.value) {
                const row = document.createElement('div');
                row.className = 'course-info-row';
                
                const label = document.createElement('div');
                label.className = 'course-info-label';
                label.textContent = `${detail.label}:`;
                
                const value = document.createElement('div');
                value.className = 'course-info-value';
                value.textContent = detail.value;
                
                row.appendChild(label);
                row.appendChild(value);
                infoTable.appendChild(row);
            }
        });
        
        // Schedule row (Start & End time)
        if (liveCourse.startedAt) {
            const scheduleRow = document.createElement('div');
            scheduleRow.className = 'course-info-row';
            
            const scheduleLabel = document.createElement('div');
            scheduleLabel.className = 'course-info-label';
            scheduleLabel.textContent = 'Schedule:';
            
            const scheduleValue = document.createElement('div');
            scheduleValue.className = 'course-info-value';
            
            // Format the dates nicely
            const startDate = new Date(liveCourse.startedAt);
            const endDate = liveCourse.endedAt ? new Date(liveCourse.endedAt) : null;
            
            const startDateStr = startDate.toLocaleDateString();
            const startTimeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            let scheduleText = `${startDateStr} ${startTimeStr}`;
            
            if (endDate) {
                // If end date is different from start date, show full date
                if (endDate.toDateString() !== startDate.toDateString()) {
                    const endDateStr = endDate.toLocaleDateString();
                    const endTimeStr = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    scheduleText += ` - ${endDateStr} ${endTimeStr}`;
                } else {
                    // Otherwise just show the end time
                    const endTimeStr = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    scheduleText += ` - ${endTimeStr}`;
                }
            }
            
            scheduleValue.textContent = scheduleText;
            
            scheduleRow.appendChild(scheduleLabel);
            scheduleRow.appendChild(scheduleValue);
            infoTable.appendChild(scheduleRow);
        }
        
        card.appendChild(infoTable);

        // Add "Add to Tasks" button
        const addToTasksBtn = document.createElement('button');
        addToTasksBtn.className = 'add-to-tasks-btn';
        addToTasksBtn.textContent = 'Add to Tasks';
        addToTasksBtn.dataset.liveId = liveCourse.liveId;
        addToTasksBtn.dataset.title = liveCourse.courseName || liveCourse.title || 'Unnamed Course';
        
        addToTasksBtn.addEventListener('click', () => {
            sendTaskToMainWindow('live', liveCourse.liveId, liveCourse.courseName || liveCourse.title || 'Unnamed Course');
        });
        
        card.appendChild(addToTasksBtn);
        
        return card;
    }

    // Add event listener for fetch live courses button
    fetchLiveCoursesBtn.addEventListener('click', fetchLiveCourses);
    
    // Task management button event listeners
    const startTasksBtn = document.getElementById('start-tasks-btn');
    const cancelTasksBtn = document.getElementById('cancel-tasks-btn');
    const resetProgressCheckbox = document.getElementById('resetProgressCheckbox');
    const fastModeCheckbox = document.getElementById('fastModeCheckbox');
    const autoMuteCheckbox = document.getElementById('autoMuteCheckbox');
    const taskStatus = document.getElementById('task-status');
    
    // Send a single task to the main window
    async function sendTaskToMainWindow(type, id, title, courseId = null) {
        try {
            // Prepare task data
            const task = {
                type: type,
                id: id,
                title: title,
                url: `https://www.yanhekt.cn/${type === 'session' ? 'session' : 'live'}/${id}`,
                courseId: courseId // Include courseId for session tasks
            };
            
            taskStatus.textContent = 'Adding task...';
            
            // Send request to add this task to the main window's task queue
            const response = await fetch('/api/add-task', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(task)
            });
            
            const result = await response.json();
            
            if (result.success) {
                taskStatus.textContent = `Task added: ${title} (${id})`;
                taskStatus.className = 'token-status success';
                fetchTaskQueue();

                // Show notification
                showNotification(`Task added: ${title}`, 'success');
            } else {
                throw new Error(result.message || 'Failed to add task');
            }
        } catch (error) {
            console.error('Error adding task:', error);
            taskStatus.textContent = `Error: ${error.message || 'Failed to add task'}`;
            taskStatus.className = 'token-status error';

            // Show error notification
            showNotification(`Error: ${error.message || 'Failed to add task'}`, 'error');
        } finally {
            setTimeout(() => {
                taskStatus.textContent = 'Idle';
                taskStatus.className = 'token-status';
            }, 3000);
        }
    }
    
    // Send all sessions to the main window
    async function sendAllSessionsToMainWindow(sessions) {
        try {
            // Prepare task data
            const tasks = sessions.map(session => ({
                type: 'session',
                id: session.sessionId,
                title: session.title || 'Untitled Session',
                url: `https://www.yanhekt.cn/session/${session.sessionId}`,
                courseId: session.courseId // Include courseId for each session
            }));
            
            taskStatus.textContent = `Adding ${tasks.length} sessions...`;
            
            // Send request to add these tasks to the main window's task queue
            const response = await fetch('/api/add-tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tasks })
            });
            
            const result = await response.json();
            
            if (result.success) {
                taskStatus.textContent = `Added ${result.addedCount || tasks.length} sessions to task queue`;
                taskStatus.className = 'token-status success';
                fetchTaskQueue();

                // Show notification
                showNotification(`Added ${result.addedCount || tasks.length} sessions to task queue`, 'success');
            } else {
                throw new Error(result.message || 'Failed to add sessions');
            }
        } catch (error) {
            console.error('Error adding sessions:', error);
            taskStatus.textContent = `Error: ${error.message || 'Failed to add sessions'}`;
            taskStatus.className = 'token-status error';

            // Show error notification
            showNotification(`Error: ${error.message || 'Failed to add sessions'}`, 'error');
        } finally {
            setTimeout(() => {
                taskStatus.textContent = 'Idle';
                taskStatus.className = 'token-status';
            }, 3000);
        }
    }
    
    // Send all live courses to the main window
    async function sendAllLivesToMainWindow(liveCourses) {
        try {
            // Filter to only keep upcoming and live courses
            const activeLives = liveCourses.filter(course => course.status === 1 || course.status === 2);
            
            // Prepare task data
            const tasks = activeLives.map(live => ({
                type: 'live',
                id: live.liveId,
                title: live.courseName || live.title || 'Unnamed Course',
                url: `https://www.yanhekt.cn/live/${live.liveId}`
            }));
            
            if (tasks.length === 0) {
                taskStatus.textContent = 'No active live courses to add';
                setTimeout(() => {
                    taskStatus.textContent = 'Idle';
                }, 3000);
                return;
            }
            
            taskStatus.textContent = `Adding ${tasks.length} live courses...`;
            
            // Send request to add these tasks to the main window's task queue
            const response = await fetch('/api/add-tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tasks })
            });
            
            const result = await response.json();
            
            if (result.success) {
                taskStatus.textContent = `Added ${result.addedCount || tasks.length} live courses to task queue`;
                taskStatus.className = 'token-status success';
                fetchTaskQueue();

                // Show notification
                showNotification(`Added ${result.addedCount || tasks.length} live courses to task queue`, 'success');
            } else {
                throw new Error(result.message || 'Failed to add live courses');
            }
        } catch (error) {
            console.error('Error adding live courses:', error);
            taskStatus.textContent = `Error: ${error.message || 'Failed to add live courses'}`;
            taskStatus.className = 'token-status error';

            // Show error notification
            showNotification(`Error: ${error.message || 'Failed to add live courses'}`, 'error');
        } finally {
            setTimeout(() => {
                taskStatus.textContent = 'Idle';
                taskStatus.className = 'token-status';
            }, 3000);
        }
    }
    
    // Function to start tasks in the main window
    async function startTasksInMainWindow() {
        try {
            const resetProgress = resetProgressCheckbox.checked;
            const fastMode = fastModeCheckbox.checked;
            const autoMute = autoMuteCheckbox.checked;
            
            taskStatus.textContent = 'Starting tasks...';
            
            // Send request to start tasks in the main window
            const response = await fetch('/api/start-tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    options: {
                        resetProgress,
                        fastMode,
                        autoMute
                    }
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                taskStatus.textContent = 'Tasks started in main application';
                taskStatus.className = 'token-status success';
                
                // Poll for task status to keep UI updated
                pollTaskStatus();
            } else {
                throw new Error(result.message || 'Failed to start tasks');
            }
        } catch (error) {
            console.error('Error starting tasks:', error);
            taskStatus.textContent = `Error: ${error.message || 'Failed to start tasks'}`;
            taskStatus.className = 'token-status error';
        }
    }
    
    // Function to cancel tasks in the main window
    async function cancelTasksInMainWindow() {
        try {
            taskStatus.textContent = 'Canceling tasks...';
            
            // Send request to cancel tasks in the main window
            const response = await fetch('/api/cancel-tasks', {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                taskStatus.textContent = 'Tasks canceled in main application';
                taskStatus.className = 'token-status success';
            } else {
                throw new Error(result.message || 'Failed to cancel tasks');
            }
        } catch (error) {
            console.error('Error canceling tasks:', error);
            taskStatus.textContent = `Error: ${error.message || 'Failed to cancel tasks'}`;
            taskStatus.className = 'token-status error';
        } finally {
            setTimeout(() => {
                taskStatus.textContent = 'Idle';
                taskStatus.className = 'token-status';
            }, 3000);
        }
    }
    
    // Function to poll for task status from the main window
    async function pollTaskStatus() {
        try {
            // Send request to get task status from the main window
            const response = await fetch('/api/task-status');
            const result = await response.json();
            
            if (result.success) {
                // Update status text based on current task status
                if (result.isProcessing) {
                    let statusMsg = result.status || `Processing task ${result.currentTaskIndex + 1} of ${result.totalTasks}`;
                    
                    // Add slide count if available
                    if (result.slideCount) {
                        statusMsg += ` (${result.slideCount})`;
                    }
                    
                    // Update status display with 'progress' class
                    updateTaskStatus(statusMsg, 'progress');
                    
                    // Refresh the task queue to show current progress
                    fetchTaskQueue();
                    
                    // Continue polling
                    setTimeout(pollTaskStatus, 2000);
                } else {
                    updateTaskStatus('Task processing completed or idle', 'success');
                    
                    // Refresh the task queue one last time
                    fetchTaskQueue();
                    
                    setTimeout(() => {
                        updateTaskStatus('Idle');
                    }, 3000);
                }
            } else {
                throw new Error(result.message || 'Failed to get task status');
            }
        } catch (error) {
            console.error('Error polling task status:', error);
            updateTaskStatus(`Error: ${error.message || 'Failed to get task status'}`, 'error');
            
            // Try again after a longer delay
            setTimeout(pollTaskStatus, 5000);
        }
    }

    // Add event listener to refresh tasks button
    const refreshTasksBtn = document.getElementById('refresh-tasks-btn');
    refreshTasksBtn.addEventListener('click', fetchTaskQueue);

    // Add event listener to clear tasks button
    const clearTasksBtn = document.getElementById('clear-tasks-btn');
    clearTasksBtn.addEventListener('click', clearAllTasks);

    // Initial task fetch
    fetchTaskQueue();

    // Check task status immediately when page loads
    checkTaskStatus();
    
    // Set up periodic task queue refresh
    setInterval(fetchTaskQueue, 10000); // Refresh every 10 seconds
    
    // When starting tasks or canceling tasks, refresh the task queue
    startTasksBtn.addEventListener('click', async () => {
        await startTasksInMainWindow();
        fetchTaskQueue();
    });
    
    cancelTasksBtn.addEventListener('click', async () => {
        await cancelTasksInMainWindow();
        fetchTaskQueue();
    });
});