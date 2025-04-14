// Basic script to fetch status
async function checkStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        document.getElementById('status-container').innerHTML = `
            <p>Status: ${data.status}</p>
        `;
    } catch (error) {
        document.getElementById('status-container').innerHTML = 
            `<p>Error connecting to server: ${error.message}</p>`;
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
    return card;
}

// Function to fetch sessions for a course
async function fetchCourseSessions(courseId) {
    try {
        // Validate course ID
        if (!courseId) {
            sessionsStatus.textContent = 'Error: Course ID is required';
            setTimeout(() => {
                sessionsStatus.textContent = 'Enter a course ID or select a course above';
            }, 3000);
            return;
        }
        
        // Clear previous session cards
        sessionListContainer.innerHTML = '';
        
        // Update status
        sessionsStatus.textContent = 'Fetching session data...';
        
        // Fetch session data
        const response = await fetch(`/api/sessions?courseId=${courseId}`);
        const result = await response.json();
        
        if (result.success && result.sessions && result.sessions.length > 0) {
            
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
            
            sessionsStatus.textContent = `Found ${result.sessions.length} sessions`;
            setTimeout(() => {
                sessionsStatus.textContent = 'Idle';
            }, 3000);
        } else {
            const errorMsg = result.message || 'No sessions found or failed to retrieve sessions';
            sessionsStatus.textContent = `Error: ${errorMsg}`;
            sessionListContainer.innerHTML = `<div class="empty-state">
                <div class="empty-state-title">No sessions found</div>
                <div class="empty-state-message">${errorMsg}</div>
            </div>`;
            setTimeout(() => {
                sessionsStatus.textContent = 'Idle';
            }, 3000);
        }
    } catch (error) {
        console.error('Error fetching sessions:', error);
        sessionsStatus.textContent = `Error: ${error.message || 'Unknown error'}`;
        setTimeout(() => {
            sessionsStatus.textContent = 'Idle';
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

// Check status when page loads
window.addEventListener('load', checkStatus);