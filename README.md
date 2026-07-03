# MOCO V2 - E-Learning & Chat Platform

A production-ready, premium minimalist E-Learning and Chat platform built with Node.js, Express, Socket.io, MongoDB, and real-time communication features.

## Features

### Core Functionality
- **Student Management**: Add, block/unblock, update passwords, and delete students
- **Real-time Chat**: Group and private messaging with text and voice notes
- **Voice Notes**: Record and send voice messages with HTML5 audio player rendering
- **Google Meet Integration**: Schedule and manage online classes
- **Live Dashboard**: Real-time statistics (total students, courses, online users)
- **Presence Tracking**: Track online/offline student status
- **Account Blocking**: Instant blocking with forced logout via socket events

### Admin Dashboard
- Add new students with username, password, and course
- View all students with status (Active/Blocked)
- Toggle block status with immediate effect
- Change student passwords securely
- Delete students with confirmation
- Real-time statistics auto-refresh
- Schedule Google Meet sessions
- Group chat with voice recording

### Student Portal
- Secure login with account blocking check
- View course information
- Participate in group chat
- Send voice notes
- View scheduled Google Meet sessions with direct JOIN button
- Real-time notifications for account changes

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB (Mongoose)
- **Real-time**: Socket.io
- **Authentication**: bcrypt for password hashing
- **Frontend**: Vanilla JavaScript with premium minimalist white theme

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally on port 27017)
- npm or yarn

## Installation

1. **Clone or navigate to the project directory**
   ```bash
   cd c:/Users/krsha/OneDrive/Desktop/MOCO
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start MongoDB**
   - Ensure MongoDB is running locally on `mongodb://localhost:27017`
   - The application uses the database name `moco_v2`

4. **Start the server**
   ```bash
   npm start
   ```

   The server will start on port 3000 (or the PORT specified in environment variables).

## Access URLs

- **Admin Dashboard**: http://localhost:3000/admin
- **Student Portal**: http://localhost:3000/student
- **Home (redirects to admin)**: http://localhost:3000

## API Endpoints

### Student Management
- `POST /api/students` - Add new student
- `GET /api/students` - Get all students
- `GET /api/students/:id` - Get student by ID
- `POST /api/students/login` - Student login
- `PATCH /api/students/:id/block` - Toggle block status
- `PATCH /api/students/:id/password` - Update password
- `DELETE /api/students/:id` - Delete student

### Statistics
- `GET /api/students/count` - Get total student count
- `GET /api/students/stats` - Get dashboard statistics

### Chat
- `GET /api/messages` - Get chat messages
- `POST /api/messages` - Send message

### Google Meet
- `POST /api/googlemeet` - Schedule meet
- `GET /api/googlemeet` - Get current meet

## Database Schema

### Student
```javascript
{
  username: String (unique, trimmed),
  password: String (bcrypt hashed),
  course: String (required),
  isBlocked: Boolean (default: false),
  joinedAt: Date,
  lastLogin: Date,
  socketId: String
}
```

### Message
```javascript
{
  sender: ObjectId (ref: Student),
  recipient: ObjectId (ref: Student),
  content: String,
  chatType: String (enum: 'group', 'private'),
  messageType: String (enum: 'text', 'voice'),
  timestamp: Date
}
```

### GoogleMeet
```javascript
{
  link: String,
  scheduledTime: Date,
  createdAt: Date
}
```

## Key Features Implementation

### Error Handling
- All routes use `handleAsync` wrapper to catch async errors
- Every route explicitly ends with `return res.status().json()`
- Prevents server crashes and frontend hanging

### Voice Notes
- Voice messages stored as Base64 strings in MongoDB
- Frontend detects voice messages and renders HTML5 audio player
- No raw Base64 strings displayed in chat UI

### Real-time Updates
- Student table refreshes dynamically after CRUD operations
- Dashboard stats auto-refresh every 5 seconds
- Socket events for immediate notifications
- Online/offline status tracking

### Account Blocking
- Login route checks `isBlocked` status
- Returns 403 with "Your account is blocked" message
- Socket event forces immediate logout when blocked
- Admin can toggle block status with one click

## Design

- **Theme**: Premium minimalist white
- **Logo**: Uses `logo.png` from root directory
- **Typography**: Clean, high-contrast text for readability
- **UI Components**: Modern cards, buttons, and tables
- **Responsive**: Works on various screen sizes

## Security

- Passwords hashed with bcrypt (10 rounds)
- Username uniqueness validation
- Input validation on all endpoints
- Socket-based session revocation for blocked/deleted accounts

## Development

The codebase is organized as follows:
- `server.js` - Main server with Express, Socket.io, and API routes
- `admin.html` - Admin dashboard UI
- `student.html` - Student portal UI
- `admin.js` - Admin dashboard JavaScript
- `student.js` - Student portal JavaScript
- `package.json` - Dependencies and scripts

## Troubleshooting

### MongoDB Connection Error
- Ensure MONGO_URI is set in environment variables
- Verify MongoDB connection string is correct
- Check MongoDB cluster is accessible

### Port Already in Use
- Change PORT in environment variable or modify server.js

### Voice Recording Not Working
- Ensure browser has microphone permissions
- Check HTTPS requirement for microphone access in production

## License

ISC
