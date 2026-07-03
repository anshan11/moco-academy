// Admin Dashboard JavaScript
const API_BASE = window.location.origin;
const socket = io();
let currentStudentId = null;
let adminToken = localStorage.getItem('adminToken');

// Check authentication on load
window.addEventListener('load', async () => {
  if (adminToken) {
    try {
      const response = await fetch(`${API_BASE}/api/admin/verify`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      
      if (response.ok) {
        loadHomeStats();
        loadStudents();
      } else {
        localStorage.removeItem('adminToken');
        adminToken = null;
        window.location.href = '/login.html';
      }
    } catch (error) {
      localStorage.removeItem('adminToken');
      adminToken = null;
      window.location.href = '/login.html';
    }
  } else {
    window.location.href = '/login.html';
  }
});

// Admin Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    await fetch(`${API_BASE}/api/admin/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
  } catch (error) {
    console.error('Logout error:', error);
  }
  
  localStorage.removeItem('adminToken');
  adminToken = null;
  window.location.href = '/login.html';
});

// Helper function for authenticated requests
async function authenticatedFetch(url, options = {}) {
  if (!options.headers) {
    options.headers = {};
  }
  options.headers['Authorization'] = `Bearer ${adminToken}`;
  return fetch(url, options);
}

// Tab Navigation
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
    
    // Load data based on tab
    if (tab.dataset.tab === 'home') {
      loadHomeStats();
    } else if (tab.dataset.tab === 'students') {
      loadStudents();
    } else if (tab.dataset.tab === 'courses') {
      loadCourses();
      filterStudentsByCourse();
    } else if (tab.dataset.tab === 'resources') {
      loadResources();
    } else if (tab.dataset.tab === 'chat') {
      loadMessages();
    } else if (tab.dataset.tab === 'private-chat') {
      loadPrivateChatStudents();
    } else if (tab.dataset.tab === 'meet') {
      loadMeet();
    }
  });
});

// Notification Helper
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `notification ${type} show`;
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Home Stats
async function loadHomeStats() {
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/students/stats`);
    
    if (!response.ok) {
      console.error('Stats API returned error:', response.status);
      const element = document.getElementById('home-total-students');
      if (element) element.innerText = 'Error';
      return;
    }
    
    const data = await response.json();
    console.log('Stats data received:', data);
    
    const element = document.getElementById('home-total-students');
    if (element) {
      element.innerText = data.totalStudents !== undefined && data.totalStudents !== null ? data.totalStudents : '0';
    }
  } catch (error) {
    console.error('Error loading stats:', error);
    const element = document.getElementById('home-total-students');
    if (element) element.innerText = 'Error';
  }
}

// Auto-refresh home stats every 5 seconds
setInterval(loadHomeStats, 5000);

// Student Management
async function loadStudents() {
  const tbody = document.getElementById('studentTableBody');
  const courseSelect = document.getElementById('studentCourse');
  
  // Show skeleton loading
  tbody.innerHTML = '<tr><td colspan="6"><div class="skeleton skeleton-card"></div></td></tr>';
  
  try {
    const [studentsResponse, coursesResponse] = await Promise.all([
      authenticatedFetch(`${API_BASE}/api/students`),
      authenticatedFetch(`${API_BASE}/api/courses`)
    ]);
    
    const students = await studentsResponse.json();
    const courses = await coursesResponse.json();
    
    tbody.innerHTML = '';
    
    // Populate course dropdown
    courseSelect.innerHTML = '<option value="">Select Course</option>';
    courses.forEach(course => {
      const option = document.createElement('option');
      option.value = course.name;
      option.textContent = course.name;
      courseSelect.appendChild(option);
    });
    
    students.forEach(student => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color: #111111 !important; font-weight: 600;">${student.username}</td>
        <td style="color: #111111 !important;">${student.course}</td>
        <td>
          <span class="status-badge ${student.isBlocked ? 'status-blocked' : 'status-active'}">
            <i class="fas ${student.isBlocked ? 'fa-ban' : 'fa-check-circle'}"></i>
            ${student.isBlocked ? 'Blocked' : 'Active'}
          </span>
        </td>
        <td style="color: #111111 !important;">${new Date(student.joinedAt).toLocaleDateString()}</td>
        <td style="color: #111111 !important;">${student.lastLogin ? new Date(student.lastLogin).toLocaleString() : 'Never'}</td>
        <td>
          <div class="actions">
            <button class="btn btn-sm ${student.isBlocked ? 'btn-success' : 'btn-danger'}" 
                    onclick="toggleBlock('${student._id}', ${student.isBlocked})">
              <i class="fas ${student.isBlocked ? 'fa-unlock' : 'fa-ban'}"></i>
              ${student.isBlocked ? 'Unblock' : 'Block'}
            </button>
            <button class="btn btn-sm btn-success" onclick="openPasswordModal('${student._id}')">
              <i class="fas fa-key"></i> Password
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteStudent('${student._id}')">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error loading students:', error);
  }
}

// Course Management
async function loadCourses() {
  const tbody = document.getElementById('courseTableBody');
  const filterSelect = document.getElementById('courseFilter');
  
  try {
    const [coursesResponse, studentsResponse] = await Promise.all([
      authenticatedFetch(`${API_BASE}/api/courses`),
      authenticatedFetch(`${API_BASE}/api/students`)
    ]);
    
    const courses = await coursesResponse.json();
    const students = await studentsResponse.json();
    
    tbody.innerHTML = '';
    filterSelect.innerHTML = '<option value="">All Courses</option>';
    
    courses.forEach(course => {
      // Get student count for this course
      const studentCount = students.filter(s => s.course === course.name).length;
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color: #111111 !important; font-weight: 600;">${course.name}</td>
        <td style="color: #111111 !important;">${new Date(course.createdAt).toLocaleDateString()}</td>
        <td style="color: #111111 !important;">${studentCount}</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="deleteCourse('${course._id}')">
            <i class="fas fa-trash"></i> Delete
          </button>
        </td>
      `;
      tbody.appendChild(tr);
      
      // Add to filter dropdown
      const option = document.createElement('option');
      option.value = course.name;
      option.textContent = course.name;
      filterSelect.appendChild(option);
    });
    
    // Store students for filtering
    window.allStudents = students;
  } catch (error) {
    console.error('Error loading courses:', error);
  }
}

// Add Course
document.getElementById('addCourseForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const courseName = document.getElementById('courseNameInput').value;
  
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: courseName })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showNotification('Course added successfully');
      document.getElementById('addCourseForm').reset();
      loadCourses();
    } else {
      showNotification(data.error || 'Error adding course', 'error');
    }
  } catch (error) {
    console.error('Error adding course:', error);
    showNotification('Error adding course', 'error');
  }
});

// Delete Course
async function deleteCourse(courseId) {
  if (!confirm('Are you sure you want to delete this course?')) return;
  
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/courses/${courseId}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showNotification('Course deleted successfully');
      loadCourses();
    } else {
      showNotification(data.error || 'Error deleting course', 'error');
    }
  } catch (error) {
    console.error('Error deleting course:', error);
    showNotification('Error deleting course', 'error');
  }
}

// Course Statistics
async function loadCourseStats() {
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/students`);
    const students = await response.json();
    
    // Group students by course
    const courseGroups = {};
    students.forEach(student => {
      if (!courseGroups[student.course]) {
        courseGroups[student.course] = [];
      }
      courseGroups[student.course].push(student);
    });
    
    // Store students for filtering
    window.allStudents = students;
  } catch (error) {
    console.error('Error loading course stats:', error);
  }
}

// Filter Students by Course
function filterStudentsByCourse() {
  const selectedCourse = document.getElementById('courseFilter').value;
  const tbody = document.getElementById('filteredStudentTableBody');
  
  if (!window.allStudents) {
    loadStudents().then(() => {
      filterStudentsByCourse();
    });
    return;
  }
  
  const filteredStudents = selectedCourse 
    ? window.allStudents.filter(s => s.course === selectedCourse)
    : window.allStudents;
  
  tbody.innerHTML = '';
  
  filteredStudents.forEach(student => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color: #111111 !important; font-weight: 600;">${student.username}</td>
      <td style="color: #111111 !important;">${student.course}</td>
      <td>
        <span class="status-badge ${student.isBlocked ? 'status-blocked' : 'status-active'}">
          <i class="fas ${student.isBlocked ? 'fa-ban' : 'fa-check-circle'}"></i>
          ${student.isBlocked ? 'Blocked' : 'Active'}
        </span>
      </td>
      <td style="color: #111111 !important;">${new Date(student.joinedAt).toLocaleDateString()}</td>
      <td style="color: #111111 !important;">${student.lastLogin ? new Date(student.lastLogin).toLocaleString() : 'Never'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Resources Management
async function loadResources() {
  const container = document.getElementById('resourcesList');
  
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/resources`);
    const resources = await response.json();
    
    if (resources.length === 0) {
      container.innerHTML = '<p style="color: #111111 !important;">No resources added yet</p>';
      return;
    }
    
    container.innerHTML = '';
    
    resources.forEach(resource => {
      const resourceDiv = document.createElement('div');
      resourceDiv.style.cssText = `
        background: #1E1E1E;
        border: 1px solid #252525;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        transition: all 0.3s ease;
      `;
      
      resourceDiv.innerHTML = `
        <div style="flex: 1;">
          <h4 style="color: #111111 !important; font-weight: 600; margin-bottom: 8px;">${resource.title}</h4>
          <p style="color: #111111 !important; font-size: 14px; margin-bottom: 8px;">${resource.description || 'No description'}</p>
          <a href="${resource.link}" target="_blank" style="color: #111111 !important; font-size: 13px;">${resource.link}</a>
        </div>
        <button class="btn btn-danger" onclick="deleteResource('${resource._id}')" style="padding: 8px 16px; font-size: 12px;">
          <i class="fas fa-trash"></i> Delete
        </button>
      `;
      
      container.appendChild(resourceDiv);
    });
  } catch (error) {
    console.error('Error loading resources:', error);
    container.innerHTML = '<p style="color: #111111 !important;">Error loading resources</p>';
  }
}

// Add Resource
document.getElementById('resourceForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const title = document.getElementById('resourceTitle').value;
  const description = document.getElementById('resourceDescription').value;
  const link = document.getElementById('resourceLink').value;
  
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, link })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showNotification('Resource added successfully');
      document.getElementById('resourceForm').reset();
      loadResources();
    } else {
      showNotification(data.error || 'Error adding resource', 'error');
    }
  } catch (error) {
    console.error('Error adding resource:', error);
    showNotification('Error adding resource', 'error');
  }
});

// Delete Resource
async function deleteResource(resourceId) {
  if (!confirm('Are you sure you want to delete this resource?')) return;
  
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/resources/${resourceId}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showNotification('Resource deleted successfully');
      loadResources();
    } else {
      showNotification(data.error || 'Error deleting resource', 'error');
    }
  } catch (error) {
    console.error('Error deleting resource:', error);
    showNotification('Error deleting resource', 'error');
  }
}

// Add Student
document.getElementById('addStudentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('studentUsername').value;
  const password = document.getElementById('studentPassword').value;
  const course = document.getElementById('studentCourse').value;
  
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, course })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showNotification('Student added successfully');
      document.getElementById('addStudentForm').reset();
      loadStudents();
      loadHomeStats();
    } else {
      showNotification(data.error || 'Error adding student', 'error');
    }
  } catch (error) {
    console.error('Error adding student:', error);
    showNotification('Error adding student', 'error');
  }
});

// Toggle Block
async function toggleBlock(studentId, currentStatus) {
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/students/${studentId}/block`, {
      method: 'PATCH'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showNotification(`Student ${data.isBlocked ? 'blocked' : 'unblocked'} successfully`);
      loadStudents();
    } else {
      showNotification(data.error || 'Error updating status', 'error');
    }
  } catch (error) {
    console.error('Error toggling block:', error);
    showNotification('Error updating status', 'error');
  }
}

// Password Modal
function openPasswordModal(studentId) {
  currentStudentId = studentId;
  document.getElementById('passwordModal').classList.add('active');
}

document.getElementById('cancelPasswordBtn').addEventListener('click', () => {
  document.getElementById('passwordModal').classList.remove('active');
  document.getElementById('newPassword').value = '';
  currentStudentId = null;
});

document.getElementById('savePasswordBtn').addEventListener('click', async () => {
  const newPassword = document.getElementById('newPassword').value;
  
  if (!newPassword) {
    showNotification('Password is required', 'error');
    return;
  }
  
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/students/${currentStudentId}/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showNotification('Password updated successfully');
      document.getElementById('passwordModal').classList.remove('active');
      document.getElementById('newPassword').value = '';
      currentStudentId = null;
    } else {
      showNotification(data.error || 'Error updating password', 'error');
    }
  } catch (error) {
    console.error('Error updating password:', error);
    showNotification('Error updating password', 'error');
  }
});

// Delete Student
async function deleteStudent(studentId) {
  if (!confirm('Are you sure you want to delete this student?')) {
    return;
  }
  
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/students/${studentId}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showNotification('Student deleted successfully');
      loadStudents();
      loadHomeStats();
    } else {
      showNotification(data.error || 'Error deleting student', 'error');
    }
  } catch (error) {
    console.error('Error deleting student:', error);
    showNotification('Error deleting student', 'error');
  }
}

// Chat Functionality
async function loadMessages() {
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/messages?limit=100`);
    const messages = await response.json();
    
    const chatContainer = document.getElementById('chatMessages');
    chatContainer.innerHTML = '';
    
    messages.forEach(message => {
      renderMessage(message);
    });
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
  } catch (error) {
    console.error('Error loading messages:', error);
  }
}

function renderMessage(message) {
  const chatContainer = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  
  const senderName = message.sender ? message.sender.username : 'Unknown';
  const isAdmin = senderName === 'Admin' || !message.sender;
  
  messageDiv.className = `message ${isAdmin ? 'sent' : 'received'}`;
  
  let contentHtml = '';
  
  // Check if message is voice note (Base64)
  if (message.messageType === 'voice' && message.content) {
    contentHtml = `
      <div class="audio-player">
        <audio controls src="${message.content}"></audio>
      </div>
    `;
  } else {
    contentHtml = `<div class="content">${message.content}</div>`;
  }
  
  messageDiv.innerHTML = `
    <div class="sender">${senderName}</div>
    ${contentHtml}
    <div class="timestamp">${new Date(message.timestamp).toLocaleString()}</div>
    <button class="delete-message-btn" onclick="deleteMessage('${message._id}')" title="Delete message">
      <i class="fas fa-trash"></i>
    </button>
  `;
  
  chatContainer.appendChild(messageDiv);
}

// Delete Message (Admin Only)
async function deleteMessage(messageId) {
  if (!confirm('Are you sure you want to delete this message?')) return;
  
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/messages/${messageId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      // Remove message from DOM immediately
      const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
      if (messageElement) {
        messageElement.remove();
      }
      showNotification('Message deleted successfully');
    } else {
      const data = await response.json();
      showNotification(data.error || 'Error deleting message', 'error');
    }
  } catch (error) {
    console.error('Error deleting message:', error);
    showNotification('Error deleting message', 'error');
  }
}

// Send Message
document.getElementById('sendMessageBtn').addEventListener('click', sendMessage);
document.getElementById('messageInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  
  if (!content) return;
  
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: null, // Admin (null represents admin in this context)
        content,
        chatType: 'group',
        messageType: 'text'
      })
    });
    
    if (response.ok) {
      input.value = '';
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// Voice Recording
let mediaRecorder;
let audioChunks = [];

document.getElementById('recordBtn').addEventListener('click', async () => {
  const btn = document.getElementById('recordBtn');
  
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        
        reader.onloadend = async () => {
          const base64Audio = reader.result;
          
          try {
            const response = await authenticatedFetch(`${API_BASE}/api/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sender: null,
                content: base64Audio,
                chatType: 'group',
                messageType: 'voice'
              })
            });
            
            if (response.ok) {
              showNotification('Voice message sent');
            }
          } catch (error) {
            console.error('Error sending voice message:', error);
          }
        };
        
        reader.readAsDataURL(audioBlob);
      };
      
      mediaRecorder.start();
      btn.classList.add('recording');
      btn.innerHTML = '<i class="fas fa-stop"></i>';
    } catch (error) {
      console.error('Error accessing microphone:', error);
      showNotification('Error accessing microphone', 'error');
    }
  } else {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    btn.classList.remove('recording');
    btn.innerHTML = '<i class="fas fa-microphone"></i>';
  }
});

// Socket.io Events
socket.on('new_message', (message) => {
  renderMessage(message);
  const chatContainer = document.getElementById('chatMessages');
  chatContainer.scrollTop = chatContainer.scrollHeight;
});

socket.on('user_status', (data) => {
  if (document.getElementById('home').classList.contains('active')) {
    loadHomeStats();
  }
});

socket.on('meet_scheduled', (data) => {
  loadMeet();
});

socket.on('meet_deleted', (data) => {
  loadMeet();
  showNotification('Meet cancelled');
});

// Private Chat Functions
async function loadPrivateChatStudents() {
  const select = document.getElementById('privateChatStudent');
  
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/students`);
    const students = await response.json();
    
    select.innerHTML = '<option value="">Select a student...</option>';
    
    students.forEach(student => {
      const option = document.createElement('option');
      option.value = student._id;
      option.textContent = `${student.username} (${student.course})`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading students:', error);
  }
}

async function loadPrivateChat() {
  const studentId = document.getElementById('privateChatStudent').value;
  const chatContainer = document.getElementById('privateChatMessages');
  
  if (!studentId) {
    chatContainer.innerHTML = '<p style="color: #111111 !important; text-align: center; padding: 20px;">Select a student to start chatting</p>';
    return;
  }
  
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/messages?chatType=private&limit=100`);
    const messages = await response.json();
    
    chatContainer.innerHTML = '';
    
    // Filter messages: only show messages between admin and selected student
    const privateMessages = messages.filter(message => {
      // Message is from selected student to admin (recipient is null for admin)
      if (message.sender && message.sender._id === studentId && !message.recipient) {
        return true;
      }
      // Message is from admin to selected student (recipient is selected student)
      if (!message.sender && message.recipient && message.recipient._id === studentId) {
        return true;
      }
      return false;
    });
    
    privateMessages.forEach(message => {
      renderPrivateMessage(message);
    });
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
  } catch (error) {
    console.error('Error loading private messages:', error);
    chatContainer.innerHTML = '<p style="color: #111111 !important;">Error loading messages</p>';
  }
}

function renderPrivateMessage(message) {
  const chatContainer = document.getElementById('privateChatMessages');
  const messageDiv = document.createElement('div');
  
  const senderName = message.sender ? message.sender.username : 'Admin';
  const isOwnMessage = !message.sender; // Admin sent it
  
  messageDiv.className = `message ${isOwnMessage ? 'sent' : 'received'}`;
  
  let contentHtml = '';
  
  // Check if message is voice note (Base64)
  if (message.messageType === 'voice' && message.content) {
    contentHtml = `
      <div class="audio-player">
        <audio controls src="${message.content}"></audio>
      </div>
    `;
  } else {
    // Display content as-is - NO encryption/masking
    contentHtml = `<div class="content">${message.content}</div>`;
  }
  
  messageDiv.innerHTML = `
    <div class="sender">${senderName}</div>
    ${contentHtml}
    <div class="timestamp">${new Date(message.timestamp).toLocaleString()}</div>
    <button class="delete-message-btn" onclick="deleteMessage('${message._id}')" title="Delete message">
      <i class="fas fa-trash"></i>
    </button>
  `;
  
  chatContainer.appendChild(messageDiv);
}

// Send Private Message
document.getElementById('sendPrivateMessageBtn').addEventListener('click', sendPrivateMessage);
document.getElementById('privateMessageInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendPrivateMessage();
  }
});

async function sendPrivateMessage() {
  const studentId = document.getElementById('privateChatStudent').value;
  const input = document.getElementById('privateMessageInput');
  const content = input.value.trim();
  
  if (!content || !studentId) {
    showNotification('Please select a student and enter a message', 'error');
    return;
  }
  
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: null, // Admin (null represents admin)
        recipient: studentId,
        content,
        chatType: 'private',
        messageType: 'text'
      })
    });
    
    if (response.ok) {
      input.value = '';
      loadPrivateChat();
    }
  } catch (error) {
    console.error('Error sending private message:', error);
  }
}

// Private Voice Recording
let privateMediaRecorder;
let privateAudioChunks = [];

document.getElementById('privateRecordBtn').addEventListener('click', async () => {
  const btn = document.getElementById('privateRecordBtn');
  const studentId = document.getElementById('privateChatStudent').value;
  
  if (!studentId) {
    showNotification('Please select a student first', 'error');
    return;
  }
  
  if (!privateMediaRecorder || privateMediaRecorder.state === 'inactive') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      privateMediaRecorder = new MediaRecorder(stream);
      privateAudioChunks = [];
      
      privateMediaRecorder.ondataavailable = (event) => {
        privateAudioChunks.push(event.data);
      };
      
      privateMediaRecorder.onstop = async () => {
        const audioBlob = new Blob(privateAudioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        
        reader.onloadend = async () => {
          const base64Audio = reader.result;
          
          try {
            const response = await authenticatedFetch(`${API_BASE}/api/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sender: null,
                recipient: studentId,
                content: base64Audio,
                chatType: 'private',
                messageType: 'voice'
              })
            });
            
            if (response.ok) {
              showNotification('Voice message sent');
              loadPrivateChat();
            }
          } catch (error) {
            console.error('Error sending voice message:', error);
          }
        };
        
        reader.readAsDataURL(audioBlob);
      };
      
      privateMediaRecorder.start();
      btn.classList.add('recording');
      btn.innerHTML = '<i class="fas fa-stop"></i>';
    } catch (error) {
      console.error('Error accessing microphone:', error);
      showNotification('Error accessing microphone', 'error');
    }
  } else {
    privateMediaRecorder.stop();
    privateMediaRecorder.stream.getTracks().forEach(track => track.stop());
    btn.classList.remove('recording');
    btn.innerHTML = '<i class="fas fa-microphone"></i>';
  }
});

// Google Meet
async function loadMeet() {
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/googlemeet`);
    
    if (response.ok) {
      const meet = await response.json();
      const container = document.getElementById('currentMeet');
      
      container.innerHTML = `
        <div class="meet-info">
          <div class="details">
            <h4>Class Scheduled</h4>
            <p><strong>Time:</strong> ${new Date(meet.scheduledTime).toLocaleString()}</p>
            <p><strong>Link:</strong> ${meet.link}</p>
          </div>
          <a href="${meet.link}" target="_blank" class="join-btn">JOIN CLASS</a>
        </div>
      `;
      
      // Show delete button
      document.getElementById('deleteMeetCard').style.display = 'block';
    } else {
      document.getElementById('currentMeet').innerHTML = '<p style="color: #666;">No meet scheduled</p>';
      document.getElementById('deleteMeetCard').style.display = 'none';
    }
  } catch (error) {
    console.error('Error loading meet:', error);
  }
}

document.getElementById('meetForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const link = document.getElementById('meetLink').value;
  const scheduledTime = document.getElementById('meetTime').value;
  
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/googlemeet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ link, scheduledTime })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showNotification('Google Meet scheduled successfully');
      document.getElementById('meetForm').reset();
      loadMeet();
    } else {
      showNotification(data.error || 'Error scheduling meet', 'error');
    }
  } catch (error) {
    console.error('Error scheduling meet:', error);
    showNotification('Error scheduling meet', 'error');
  }
});

// Delete Meet
document.getElementById('deleteMeetBtn').addEventListener('click', async () => {
  if (!confirm('Are you sure you want to cancel this meet?')) return;
  
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/googlemeet`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showNotification('Google Meet cancelled successfully');
      loadMeet();
    } else {
      showNotification(data.error || 'Error cancelling meet', 'error');
    }
  } catch (error) {
    console.error('Error cancelling meet:', error);
    showNotification('Error cancelling meet', 'error');
  }
});

// Initial Load (only if authenticated)
if (adminToken) {
  loadHomeStats();
}
