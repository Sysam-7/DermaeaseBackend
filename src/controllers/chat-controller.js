import ChatMessage from '../models/chat-message.model.js';
import User from '../models/user.model.js';
import { sendInApp } from './notification-controller.js';
import { getIO } from '../services/socket.service.js';

export async function sendMessage(req, res) {
  const { to, message } = req.body;
  const userId = req.user.id;
  const sender = await User.findById(userId).select('name role');
  
  // Create the message
  const msg = await ChatMessage.create({ senderId: userId, receiverId: to, message });
  
  // Get receiver info for notification
  const receiver = await User.findById(to).select('name role');
  
  // Send notification to receiver
  try {
    const senderName = sender?.name || 'Someone';
    const senderRole = sender?.role || 'user';
    
    // Determine notification message based on sender role
    let notificationMessage;
    if (senderRole === 'doctor') {
      notificationMessage = `New unread message from Dr. ${senderName}`;
    } else if (senderRole === 'patient') {
      notificationMessage = `New unread message from ${senderName}`;
    } else {
      notificationMessage = `New unread message from ${senderName}`;
    }
    
    await sendInApp(
      to,
      'chat_message',
      notificationMessage,
      null, // No appointmentId for chat messages
      { 
        senderId: userId.toString(),
        senderName: senderName,
        senderRole: senderRole,
        message: message.substring(0, 100), // First 100 chars as preview
        chatMessageId: msg._id.toString()
      }
    );
    
    // Emit real-time notification via socket
    try {
      const io = getIO();
      if (io) {
        io.to(String(to)).emit('new-chat-message', {
          senderId: userId.toString(),
          senderName: senderName,
          message: message.substring(0, 100),
          timestamp: msg.timestamp || new Date()
        });
      }
    } catch (socketErr) {
      console.error('Socket emit error:', socketErr);
    }
  } catch (notifErr) {
    console.error('Notification error:', notifErr);
  }
  
  res.json({ success: true, message: 'Message sent', data: msg });
}

export async function getHistory(req, res) {
  const { withUserId, page = 1, limit = 20 } = req.query;
  const p = Number(page);
  const l = Number(limit);
  const userId = req.user.id;
  const filter = {
    $or: [
      { senderId: userId, receiverId: withUserId },
      { senderId: withUserId, receiverId: userId }
    ]
  };
  const messages = await ChatMessage.find(filter)
    .sort({ timestamp: -1 })
    .skip((p - 1) * l)
    .limit(l);
  res.json({ success: true, message: 'History', data: messages.reverse() });
}

// Get conversations list for patients (list of doctors they can chat with)
export async function getPatientConversations(req, res) {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'patient') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get all doctors
    const doctors = await User.find({ role: 'doctor' })
      .select('name email specialty location profilePic')
      .lean();

    // Get last message for each doctor conversation
    const userIdStr = userId.toString();
    const conversations = await Promise.all(
      doctors.map(async (doctor) => {
        const lastMessage = await ChatMessage.findOne({
          $or: [
            { senderId: userIdStr, receiverId: doctor._id },
            { senderId: doctor._id, receiverId: userIdStr }
          ]
        })
          .sort({ timestamp: -1 })
          .lean();

        return {
          userId: doctor._id.toString(),
          name: doctor.name,
          specialty: doctor.specialty,
          location: doctor.location,
          profilePic: doctor.profilePic,
          lastMessage: lastMessage ? {
            message: lastMessage.message,
            timestamp: lastMessage.timestamp,
            senderId: lastMessage.senderId.toString()
          } : null,
          unreadCount: 0 // Can be enhanced later
        };
      })
    );

    // Sort by last message timestamp (most recent first)
    conversations.sort((a, b) => {
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp);
    });

    res.json({ success: true, data: conversations });
  } catch (err) {
    console.error('getPatientConversations error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Get conversations list for doctors (list of patients who messaged them)
export async function getDoctorConversations(req, res) {
  try {
    const doctorId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get distinct patient IDs who have messaged this doctor or been messaged by this doctor
    const doctorIdStr = doctorId.toString();
    const messages = await ChatMessage.find({
      $or: [
        { senderId: doctorId },
        { receiverId: doctorId }
      ]
    })
      .select('senderId receiverId')
      .lean();

    const patientIds = new Set();
    messages.forEach(msg => {
      const senderId = msg.senderId.toString();
      const receiverId = msg.receiverId.toString();
      if (senderId === doctorIdStr) {
        patientIds.add(receiverId);
      } else {
        patientIds.add(senderId);
      }
    });

    // Get patient details and last message
    const conversations = await Promise.all(
      Array.from(patientIds).map(async (patientId) => {
        const patient = await User.findById(patientId)
          .select('name email profilePic')
          .lean();

        if (!patient) return null;

        const lastMessage = await ChatMessage.findOne({
          $or: [
            { senderId: doctorIdStr, receiverId: patientId },
            { senderId: patientId, receiverId: doctorIdStr }
          ]
        })
          .sort({ timestamp: -1 })
          .lean();

        return {
          userId: patientId.toString(),
          name: patient.name,
          email: patient.email,
          profilePic: patient.profilePic,
          lastMessage: lastMessage ? {
            message: lastMessage.message,
            timestamp: lastMessage.timestamp,
            senderId: lastMessage.senderId.toString()
          } : null,
          unreadCount: 0 // Can be enhanced later
        };
      })
    );

    // Filter out nulls and sort by last message timestamp
    const validConversations = conversations.filter(c => c !== null);
    validConversations.sort((a, b) => {
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp);
    });

    res.json({ success: true, data: validConversations });
  } catch (err) {
    console.error('getDoctorConversations error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}



