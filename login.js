// Unified Login JavaScript
const API_BASE = window.location.origin;

// Notification Helper
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `notification ${type} show`;
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Login Form Handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const loading = document.getElementById('loading');
  
  // Show loading spinner
  loading.classList.add('show');
  
  try {
    const response = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Login successful
      if (data.userType === 'admin') {
        // Store admin token
        localStorage.setItem('adminToken', data.token);
        showNotification('Admin login successful');
        setTimeout(() => {
          window.location.href = '/admin.html';
        }, 500);
      } else if (data.userType === 'student') {
        // Store student data
        localStorage.setItem('studentData', JSON.stringify(data.student));
        showNotification('Student login successful');
        setTimeout(() => {
          window.location.href = '/student.html';
        }, 500);
      }
    } else {
      // Login failed
      showNotification(data.error || 'Invalid credentials', 'error');
      loading.classList.remove('show');
    }
  } catch (error) {
    console.error('Login error:', error);
    showNotification('Login failed. Please try again.', 'error');
    loading.classList.remove('show');
  }
});
