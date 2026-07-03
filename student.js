// Student Portal JavaScript
const API_BASE = window.location.origin;
const socket = io();
let currentUser = null;

// Notification Helper
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `notification ${type} show`;
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Check authentication on load
window.addEventListener('load', () => {
  console.log('Student dashboard loading...');
  
  const savedUser = localStorage.getItem('studentData');
  console.log('Saved user data:', savedUser);
  
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      console.log('Current user:', currentUser);
      
      // Ensure dashboard is visible
      document.getElementById('dashboardSection').style.display = 'block';
      
      // Populate user info
      if (currentUser.username) {
        document.getElementById('displayUsername').textContent = currentUser.username;
      }
      if (currentUser.course) {
        document.getElementById('courseName').textContent = currentUser.course;
      }
      document.getElementById('joinedDate').textContent = new Date().toLocaleDateString();
      
      // Load saved theme preference
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
      }
      
      // Socket connections
      if (currentUser.id) {
        socket.emit('user_online', { userId: currentUser.id, userType: 'student' });
      }
      socket.emit('join_chat', { chatType: 'general' });
      
      // Load initial data
      loadMessages();
      loadMeet();
      loadResources();
      
    } catch (error) {
      console.error('Error parsing user data:', error);
      localStorage.removeItem('studentData');
      window.location.href = '/login.html';
    }
  } else {
    console.log('No saved user data, redirecting to login');
    window.location.href = '/login.html';
  }
});

// Theme Toggle
document.getElementById('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('light-mode');
  const isLightMode = document.body.classList.contains('light-mode');
  
  if (isLightMode) {
    document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>';
    localStorage.setItem('theme', 'light');
  } else {
    document.getElementById('themeToggle').innerHTML = '<i class="fas fa-moon"></i>';
    localStorage.setItem('theme', 'dark');
  }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('studentData');
  currentUser = null;
  window.location.href = '/login.html';
});

// Tab Navigation
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
    
    if (tab.dataset.tab === 'chat') {
      loadMessages();
    } else if (tab.dataset.tab === 'private-chat') {
      loadPrivateMessages();
    } else if (tab.dataset.tab === 'resources') {
      loadResources();
    } else if (tab.dataset.tab === 'meet') {
      loadMeet();
    }
  });
});

// Chat Functionality
async function loadMessages() {
  const chatContainer = document.getElementById('chatMessages');
  
  // Show skeleton loading
  chatContainer.innerHTML = '<div class="skeleton skeleton-card"></div>';
  
  try {
    const response = await fetch(`${API_BASE}/api/messages?limit=100&chatType=general`);
    const messages = await response.json();
    
    chatContainer.innerHTML = '';
    
    messages.forEach(message => {
      renderMessage(message);
    });
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
  } catch (error) {
    console.error('Error loading messages:', error);
    chatContainer.innerHTML = '<p style="color: #888888; text-align: center; padding: 20px;">Failed to load messages</p>';
  }
}

function renderMessage(message) {
  const chatContainer = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  
  const senderName = message.sender ? message.sender.username : 'Admin';
  const isOwnMessage = currentUser && message.sender && message.sender._id === currentUser.id;
  
  messageDiv.className = `message ${isOwnMessage ? 'sent' : 'received'}`;
  messageDiv.dataset.messageId = message._id;
  
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
  `;
  
  chatContainer.appendChild(messageDiv);
}

// Private Chat Functionality
async function loadPrivateMessages() {
  const chatContainer = document.getElementById('privateChatMessages');
  
  // Show skeleton loading
  chatContainer.innerHTML = '<div class="skeleton skeleton-card"></div>';
  
  try {
    const response = await fetch(`${API_BASE}/api/messages?chatType=private&limit=100`);
    const messages = await response.json();
    
    chatContainer.innerHTML = '';
    
    // Filter messages: only show messages between current student and admin
    const privateMessages = messages.filter(message => {
      // Message is from current student to admin (recipient is 'admin' string)
      if (message.sender && message.sender._id === currentUser.id && message.recipient === 'admin') {
        return true;
      }
      // Message is from admin to current student (recipient is current student)
      if (!message.sender && message.recipient && message.recipient._id === currentUser.id) {
        return true;
      }
      return false;
    });
    
    privateMessages.forEach(message => {
      renderPrivateMessage(message);
    });
  } catch (error) {
    console.error('Error loading private messages:', error);
    chatContainer.innerHTML = '<p style="color: #888888;">Error loading messages</p>';
  }
}

function renderPrivateMessage(message) {
  const chatContainer = document.getElementById('privateChatMessages');
  const messageDiv = document.createElement('div');
  
  const senderName = message.sender ? message.sender.username : 'Admin';
  const isOwnMessage = currentUser && message.sender && message.sender._id === currentUser.id;
  
  messageDiv.className = `message ${isOwnMessage ? 'sent' : 'received'}`;
  messageDiv.dataset.messageId = message._id;
  
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
  const input = document.getElementById('privateMessageInput');
  const content = input.value.trim();
  
  if (!content || !currentUser) return;
  
  try {
    const response = await fetch(`${API_BASE}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: currentUser.id,
        recipient: 'admin', // Send to admin
        content,
        chatType: 'private',
        messageType: 'text'
      })
    });
    
    if (response.ok) {
      input.value = '';
    }
  } catch (error) {
    console.error('Error sending private message:', error);
  }
}

// Resources Functionality
async function loadResources() {
  const container = document.getElementById('resourcesContainer');
  
  try {
    const response = await fetch(`${API_BASE}/api/resources`);
    const resources = await response.json();
    
    if (resources.length === 0) {
      container.innerHTML = `
        <div class="no-resources">
          <i class="fas fa-folder-open" style="font-size: 48px; margin-bottom: 20px; color: #ccc;"></i>
          <p>No resources available yet</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = '';
    
    resources.forEach(resource => {
      const resourceDiv = document.createElement('div');
      resourceDiv.className = 'resource-item';
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
          <h4 style="color: #FFFFFF; font-weight: 600; margin-bottom: 8px;">${resource.title}</h4>
          <p style="color: #888888; font-size: 14px;">${resource.description || 'No description'}</p>
        </div>
        <a href="${resource.link}" target="_blank" class="btn btn-primary" style="padding: 10px 20px; font-size: 14px;">
          <i class="fas fa-external-link-alt"></i> Open
        </a>
      `;
      
      container.appendChild(resourceDiv);
    });
  } catch (error) {
    console.error('Error loading resources:', error);
    container.innerHTML = '<p style="color: #888888;">Error loading resources</p>';
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
  
  if (!content || !currentUser) return;
  
  try {
    const response = await fetch(`${API_BASE}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: currentUser.id,
        content,
        chatType: 'general',
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
          
          if (!currentUser) return;
          
          try {
            const response = await fetch(`${API_BASE}/api/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sender: currentUser.id,
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

socket.on('account_blocked', (data) => {
  showNotification(data.message, 'error');
  localStorage.removeItem('currentUser');
  currentUser = null;
  
  setTimeout(() => {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('dashboardSection').style.display = 'none';
    document.getElementById('loginForm').reset();
  }, 2000);
});

socket.on('account_deleted', (data) => {
  showNotification(data.message, 'error');
  localStorage.removeItem('currentUser');
  currentUser = null;
  
  setTimeout(() => {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('dashboardSection').style.display = 'none';
    document.getElementById('loginForm').reset();
  }, 2000);
});

socket.on('logged_out_elsewhere', (data) => {
  showNotification(data.message, 'error');
  localStorage.removeItem('currentUser');
  currentUser = null;
  
  setTimeout(() => {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('dashboardSection').style.display = 'none';
    document.getElementById('loginForm').reset();
  }, 2000);
});

socket.on('meet_scheduled', (data) => {
  loadMeet();
  showNotification('New class scheduled!');
});

socket.on('message_deleted', (data) => {
  // Remove message from DOM when admin deletes it
  const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
  if (messageElement) {
    messageElement.remove();
  }
});

// Google Meet
async function loadMeet() {
  try {
    const response = await fetch(`${API_BASE}/api/googlemeet`);
    
    if (response.ok) {
      const meet = await response.json();
      // Parse the datetime-local string as local time (IST)
      // Format: "YYYY-MM-DDTHH:mm"
      const scheduledTime = new Date(meet.scheduledTime);
      const now = new Date();
      
      // Calculate class end time (2 hours after start)
      const classEndTime = new Date(scheduledTime.getTime() + 2 * 60 * 60 * 1000);
      
      if (now >= scheduledTime && now < classEndTime) {
        // Class is live - show join button
        document.getElementById('countdownContainer').style.display = 'block';
        document.getElementById('noMeetMessage').style.display = 'none';
        document.getElementById('countdownTimer').style.display = 'none';
        document.getElementById('joinButtonContainer').style.display = 'block';
        
        const joinBtn = document.getElementById('joinLiveBtn');
        joinBtn.onclick = () => window.open(meet.link, '_blank');
      } else if (now < scheduledTime) {
        // Show countdown
        document.getElementById('countdownContainer').style.display = 'block';
        document.getElementById('noMeetMessage').style.display = 'none';
        document.getElementById('countdownTimer').style.display = 'flex';
        document.getElementById('joinButtonContainer').style.display = 'none';
        startCountdown(scheduledTime, classEndTime, meet.link);
      } else {
        // Class has ended
        document.getElementById('countdownContainer').style.display = 'block';
        document.getElementById('noMeetMessage').style.display = 'none';
        document.getElementById('countdownTimer').style.display = 'none';
        document.getElementById('joinButtonContainer').style.display = 'none';
        document.getElementById('countdownContainer').innerHTML = '<p style="color: #888888; text-align: center;">Class has ended</p>';
      }
    } else {
      document.getElementById('countdownContainer').style.display = 'none';
      document.getElementById('noMeetMessage').style.display = 'block';
    }
  } catch (error) {
    console.error('Error loading meet:', error);
  }
}

let countdownInterval;

function startCountdown(scheduledTime, classEndTime, meetLink) {
  if (countdownInterval) clearInterval(countdownInterval);
  
  function updateCountdown() {
    const now = new Date();
    // Calculate difference in milliseconds - both are local times
    const diff = scheduledTime.getTime() - now.getTime();
    
    if (diff <= 0) {
      clearInterval(countdownInterval);
      // Check if class is currently live
      if (now.getTime() < classEndTime.getTime()) {
        document.getElementById('countdownTimer').style.display = 'none';
        document.getElementById('joinButtonContainer').style.display = 'block';
        
        const joinBtn = document.getElementById('joinLiveBtn');
        joinBtn.onclick = () => window.open(meetLink, '_blank');
      } else {
        document.getElementById('countdownTimer').style.display = 'none';
        document.getElementById('joinButtonContainer').style.display = 'none';
        document.getElementById('countdownContainer').innerHTML = '<p style="color: #888888; text-align: center;">Class has ended</p>';
      }
      return;
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    document.getElementById('days').textContent = String(days).padStart(2, '0');
    document.getElementById('hours').textContent = String(hours).padStart(2, '0');
    document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
  }
  
  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

// Auto-refresh meet info every 30 seconds
setInterval(loadMeet, 30000);
