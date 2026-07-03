const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// MongoDB Connection
const mongoUri = process.env.MONGO_URI || 'mongodb+srv://aboosh768_db_user:GDGfRlynPDaNnTbK@cluster0.ulllcji.mongodb.net/moco_academy?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

// handleAsync wrapper for error handling
const handleAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('Async error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  });
};

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.substring(7);
  const session = adminSessions.get(token);
  
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Check if session is older than 24 hours
  if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
    adminSessions.delete(token);
    return res.status(401).json({ error: 'Session expired' });
  }
  
  next();
};

// Generate simple session token
const generateSessionToken = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Track online users
const onlineUsers = new Map(); // userId -> socketId

// Admin Credentials (Hardcoded)
const ADMIN_CREDENTIALS = {
  username: 'Mentalist_shaihan',
  password: 'Moco-academy22'
};

// Admin session storage (in-memory for simplicity)
const adminSessions = new Map(); // sessionId -> { createdAt }

// MongoDB Schemas
const studentSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  course: { 
    type: String, 
    required: true 
  },
  isBlocked: { 
    type: Boolean, 
    default: false 
  },
  joinedAt: { 
    type: Date, 
    default: Date.now 
  },
  lastLogin: { 
    type: Date 
  },
  socketId: { 
    type: String 
  },
  activeSocketId: {
    type: String,
    default: null
  }
});

const messageSchema = new mongoose.Schema({
  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student',
    required: false
  },
  recipient: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student',
    required: false
  },
  content: { 
    type: String, 
    required: true 
  },
  chatType: { 
    type: String, 
    enum: ['group', 'private'],
    default: 'group'
  },
  messageType: { 
    type: String, 
    enum: ['text', 'voice'],
    default: 'text'
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
}, {
  // Optimize for large content (voice messages)
  minimize: false
});

const googleMeetSchema = new mongoose.Schema({
  link: { 
    type: String, 
    required: true 
  },
  scheduledTime: { 
    type: Date, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

const resourceSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String 
  },
  link: { 
    type: String, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

const courseSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    unique: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

const Student = mongoose.model('Student', studentSchema);
const Message = mongoose.model('Message', messageSchema);
const GoogleMeet = mongoose.model('GoogleMeet', googleMeetSchema);
const Resource = mongoose.model('Resource', resourceSchema);
const Course = mongoose.model('Course', courseSchema);

// Routes

// Admin Login
app.post('/api/admin/login', handleAsync(async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  if (username !== ADMIN_CREDENTIALS.username || password !== ADMIN_CREDENTIALS.password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = generateSessionToken();
  adminSessions.set(token, { createdAt: Date.now() });
  
  return res.status(200).json({ 
    message: 'Login successful', 
    token,
    admin: { username: ADMIN_CREDENTIALS.username }
  });
}));

// Admin Logout
app.post('/api/admin/logout', handleAsync(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    adminSessions.delete(token);
  }
  return res.status(200).json({ message: 'Logout successful' });
}));

// Unified Login (Admin + Student)
app.post('/api/login', handleAsync(async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  // Normalize username: trim and lowercase for case-insensitive matching
  const normalizedUsername = username.trim().toLowerCase();
  
  // Check if it's admin
  if (normalizedUsername === ADMIN_CREDENTIALS.username.toLowerCase() && password === ADMIN_CREDENTIALS.password) {
    const token = generateSessionToken();
    adminSessions.set(token, { createdAt: Date.now() });
    
    return res.status(200).json({ 
      message: 'Login successful', 
      userType: 'admin',
      token,
      admin: { username: ADMIN_CREDENTIALS.username }
    });
  }
  
  // Check if it's student
  const student = await Student.findOne({ username: normalizedUsername });
  
  if (!student) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  if (student.isBlocked) {
    return res.status(403).json({ error: 'Your account is blocked' });
  }
  
  const isPasswordValid = await bcrypt.compare(password, student.password);
  
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Single-device login: Disconnect previous session if exists
  if (student.activeSocketId) {
    io.to(student.activeSocketId).emit('logged_out_elsewhere', { 
      message: 'You have been logged out because your account is active on another device.' 
    });
  }
  
  student.lastLogin = new Date();
  student.activeSocketId = null; // Will be set when socket connects
  await student.save();
  
  return res.status(200).json({ 
    message: 'Login successful', 
    userType: 'student',
    student: { 
      id: student._id, 
      username: student.username, 
      course: student.course 
    } 
  });
}));

// Verify Admin Session
app.get('/api/admin/verify', handleAsync(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.substring(7);
  const session = adminSessions.get(token);
  
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
    adminSessions.delete(token);
    return res.status(401).json({ error: 'Session expired' });
  }
  
  return res.status(200).json({ valid: true });
}));

// Student Registration
app.post('/api/students', handleAsync(async (req, res) => {
  const { username, password, course } = req.body;
  
  if (!username || !password || !course) {
    return res.status(400).json({ error: 'Username, password, and course are required' });
  }

  // Normalize username: trim and lowercase for case-insensitive matching
  const normalizedUsername = username.trim().toLowerCase();

  // Check for duplicate username (case-insensitive)
  const existingStudent = await Student.findOne({ username: normalizedUsername });
  if (existingStudent) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  
  const student = new Student({
    username: normalizedUsername,
    password: hashedPassword,
    course
  });

  await student.save();
  return res.status(201).json({ message: 'Student created successfully', student: { id: student._id, username: student.username, course: student.course } });
}));

// Student Login
app.post('/api/students/login', handleAsync(async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Normalize username: trim and lowercase for case-insensitive matching
  const normalizedUsername = username.trim().toLowerCase();

  const student = await Student.findOne({ username: normalizedUsername });
  
  if (!student) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (student.isBlocked) {
    return res.status(403).json({ error: 'Your account is blocked' });
  }

  const isPasswordValid = await bcrypt.compare(password, student.password);
  
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Single-device login: Disconnect previous session if exists
  if (student.activeSocketId) {
    io.to(student.activeSocketId).emit('logged_out_elsewhere', { 
      message: 'You have been logged out because your account is active on another device.' 
    });
  }

  student.lastLogin = new Date();
  student.activeSocketId = null; // Will be set when socket connects
  await student.save();

  return res.status(200).json({ 
    message: 'Login successful', 
    student: { 
      id: student._id, 
      username: student.username, 
      course: student.course 
    } 
  });
}));

// Get All Students (Protected)
app.get('/api/students', authenticateAdmin, handleAsync(async (req, res) => {
  const students = await Student.find({}, '-password');
  return res.status(200).json(students);
}));

// Get Student by ID
app.get('/api/students/:id', handleAsync(async (req, res) => {
  const student = await Student.findById(req.params.id, '-password');
  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }
  return res.status(200).json(student);
}));

// Block/Unblock Student (Protected)
app.patch('/api/students/:id/block', authenticateAdmin, handleAsync(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  student.isBlocked = !student.isBlocked;
  await student.save();

  // Emit socket event to force logout if blocked
  if (student.isBlocked && student.socketId) {
    io.to(student.socketId).emit('account_blocked', { message: 'Your account has been blocked' });
  }
  if (student.isBlocked && student.activeSocketId) {
    io.to(student.activeSocketId).emit('account_blocked', { message: 'Your account has been blocked' });
  }

  return res.status(200).json({ 
    message: `Student ${student.isBlocked ? 'blocked' : 'unblocked'} successfully`, 
    isBlocked: student.isBlocked 
  });
}));

// Update Student Password (Protected)
app.patch('/api/students/:id/password', authenticateAdmin, handleAsync(async (req, res) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const student = await Student.findById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  student.password = hashedPassword;
  await student.save();

  return res.status(200).json({ message: 'Password updated successfully' });
}));

// Delete Student (Protected)
app.delete('/api/students/:id', authenticateAdmin, handleAsync(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  await Student.findByIdAndDelete(req.params.id);
  
  // Emit socket event to force logout
  if (student.socketId) {
    io.to(student.socketId).emit('account_deleted', { message: 'Your account has been deleted' });
  }
  if (student.activeSocketId) {
    io.to(student.activeSocketId).emit('account_deleted', { message: 'Your account has been deleted' });
  }

  return res.status(200).json({ message: 'Student deleted successfully' });
}));

// Student Count
app.get('/api/students/count', handleAsync(async (req, res) => {
  try {
    const count = await Student.countDocuments({});
    return res.status(200).json({ count });
  } catch (error) {
    console.error('Error fetching student count:', error);
    return res.status(500).json({ error: 'Failed to fetch student count', message: error.message });
  }
}));

// Student Stats (Protected)
app.get('/api/students/stats', authenticateAdmin, handleAsync(async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments({});
    const onlineStudents = onlineUsers.size;
    const totalCourses = await Course.countDocuments({});
    return res.status(200).json({ totalStudents, onlineStudents, totalCourses });
  } catch (error) {
    console.error('Error fetching student stats:', error);
    return res.status(500).json({ error: 'Failed to fetch student stats', message: error.message });
  }
}));

// Public Stats Endpoints (No authentication required)
app.get('/api/admin/stats/students', handleAsync(async (req, res) => {
  try {
    const count = await Student.countDocuments({});
    return res.status(200).json({ count });
  } catch (error) {
    console.error('Error fetching student count:', error);
    return res.status(500).json({ error: 'Failed to fetch student count', message: error.message });
  }
}));

app.get('/api/admin/stats/online', handleAsync(async (req, res) => {
  try {
    const count = onlineUsers.size;
    return res.status(200).json({ count });
  } catch (error) {
    console.error('Error fetching online count:', error);
    return res.status(500).json({ error: 'Failed to fetch online count', message: error.message });
  }
}));

app.get('/api/admin/stats/courses', handleAsync(async (req, res) => {
  try {
    const count = await Course.countDocuments({});
    return res.status(200).json({ count });
  } catch (error) {
    console.error('Error fetching course count:', error);
    return res.status(500).json({ error: 'Failed to fetch course count', message: error.message });
  }
}));

// Google Meet Routes (Protected)
app.post('/api/googlemeet', authenticateAdmin, handleAsync(async (req, res) => {
  const { link, scheduledTime } = req.body;
  
  if (!link || !scheduledTime) {
    return res.status(400).json({ error: 'Link and scheduled time are required' });
  }

  // Delete any existing meet
  await GoogleMeet.deleteMany({});

  // Parse the date and ensure it's treated as local time (IST)
  const dateObj = new Date(scheduledTime);
  const meet = new GoogleMeet({
    link,
    scheduledTime: dateObj
  });

  await meet.save();
  
  // Notify all clients with the exact time as stored
  io.emit('meet_scheduled', { link, scheduledTime: meet.scheduledTime });

  return res.status(201).json({ message: 'Google Meet scheduled successfully', meet });
}));

app.get('/api/googlemeet', handleAsync(async (req, res) => {
  const meet = await GoogleMeet.findOne().sort({ createdAt: -1 });
  if (!meet) {
    return res.status(404).json({ error: 'No Google Meet scheduled' });
  }
  return res.status(200).json(meet);
}));

app.delete('/api/googlemeet', authenticateAdmin, handleAsync(async (req, res) => {
  await GoogleMeet.deleteMany({});
  
  // Notify all clients
  io.emit('meet_deleted', { message: 'Google Meet cancelled' });
  
  return res.status(200).json({ message: 'Google Meet deleted successfully' });
}));

// Chat Routes
app.get('/api/messages', handleAsync(async (req, res) => {
  const { chatType, limit = 100 } = req.query;
  const query = chatType ? { chatType } : {};
  const messages = await Message.find(query)
    .populate('sender', 'username')
    .populate('recipient', 'username')
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .lean();
  return res.status(200).json(messages.reverse());
}));

app.delete('/api/messages/:id', authenticateAdmin, handleAsync(async (req, res) => {
  const message = await Message.findById(req.params.id);
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  await Message.findByIdAndDelete(req.params.id);
  
  // Broadcast to all clients to remove the message
  io.emit('message_deleted', { messageId: req.params.id });
  
  return res.status(200).json({ message: 'Message deleted successfully' });
}));

app.post('/api/messages', handleAsync(async (req, res) => {
  const { sender, recipient, content, chatType, messageType } = req.body;
  
  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  try {
    const message = new Message({
      sender: sender || null,
      recipient: recipient || null,
      content,
      chatType: chatType || 'group',
      messageType: messageType || 'text'
    });

    await message.save();

    // Populate sender/recipient before emitting
    await message.populate('sender', 'username');
    await message.populate('recipient', 'username');

    // Emit socket event
    io.emit('new_message', message);

    return res.status(201).json({ message: 'Message sent successfully', data: message });
  } catch (error) {
    console.error('Error saving message:', error);
    return res.status(500).json({ error: 'Failed to save message', message: error.message });
  }
}));

// Resource Routes (Protected)
app.get('/api/resources', handleAsync(async (req, res) => {
  const resources = await Resource.find().sort({ createdAt: -1 });
  return res.status(200).json(resources);
}));

app.post('/api/resources', authenticateAdmin, handleAsync(async (req, res) => {
  const { title, description, link } = req.body;
  
  if (!title || !link) {
    return res.status(400).json({ error: 'Title and link are required' });
  }

  const resource = new Resource({ title, description, link });
  await resource.save();

  return res.status(201).json({ message: 'Resource created successfully', resource });
}));

app.delete('/api/resources/:id', authenticateAdmin, handleAsync(async (req, res) => {
  const resource = await Resource.findById(req.params.id);
  if (!resource) {
    return res.status(404).json({ error: 'Resource not found' });
  }

  await Resource.findByIdAndDelete(req.params.id);
  return res.status(200).json({ message: 'Resource deleted successfully' });
}));

// Course Routes (Protected)
app.get('/api/courses', handleAsync(async (req, res) => {
  const courses = await Course.find().sort({ createdAt: -1 });
  return res.status(200).json(courses);
}));

app.post('/api/courses', authenticateAdmin, handleAsync(async (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Course name is required' });
  }

  const existingCourse = await Course.findOne({ name });
  if (existingCourse) {
    return res.status(400).json({ error: 'Course already exists' });
  }

  const course = new Course({ name });
  await course.save();

  return res.status(201).json({ message: 'Course created successfully', course });
}));

app.delete('/api/courses/:id', authenticateAdmin, handleAsync(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }

  // Check if students are enrolled in this course
  const studentsInCourse = await Student.countDocuments({ course: course.name });
  if (studentsInCourse > 0) {
    return res.status(400).json({ error: 'Cannot delete course with enrolled students' });
  }

  await Course.findByIdAndDelete(req.params.id);
  return res.status(200).json({ message: 'Course deleted successfully' });
}));

// Socket.io Connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('user_online', async ({ userId, userType }) => {
    onlineUsers.set(userId, socket.id);
    
    if (userType === 'student') {
      const student = await Student.findById(userId);
      if (student) {
        // Update both socketId and activeSocketId for single-device tracking
        student.socketId = socket.id;
        student.activeSocketId = socket.id;
        await student.save();
      }
    }

    io.emit('user_status', { userId, status: 'online', onlineCount: onlineUsers.size });
  });

  socket.on('join_chat', ({ chatType }) => {
    socket.join(chatType);
  });

  socket.on('send_message', async (messageData) => {
    try {
      const message = new Message({
        sender: messageData.sender || null,
        recipient: messageData.recipient || null,
        content: messageData.content,
        chatType: messageData.chatType || 'group',
        messageType: messageData.messageType || 'text'
      });
      
      await message.save();
      
      // Populate before emitting
      await message.populate('sender', 'username');
      await message.populate('recipient', 'username');
      
      if (messageData.chatType === 'private' && messageData.recipient) {
        const recipientSocketId = onlineUsers.get(messageData.recipient);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('new_message', message);
        }
      } else {
        io.emit('new_message', message);
      }
    } catch (error) {
      console.error('Error sending message via socket:', error);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    
    // Remove from online users
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        await Student.findByIdAndUpdate(userId, { socketId: null, activeSocketId: null });
        io.emit('user_status', { userId, status: 'offline', onlineCount: onlineUsers.size });
        break;
      }
    }
  });
});

// Serve HTML files
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/student', (req, res) => {
  res.sendFile(path.join(__dirname, 'student.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
