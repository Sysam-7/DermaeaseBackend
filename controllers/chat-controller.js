import ChatMessage from '../models/chat-message.model.js';

export async function sendMessage(req, res) {
  const { to, message } = req.body;
  const msg = await ChatMessage.create({ senderId: req.user.id, receiverId: to, message });
  res.json({ success: true, message: 'Message sent', data: msg });
}

export async function getHistory(req, res) {
  const { withUserId, page = 1, limit = 20 } = req.query;
  const p = Number(page);
  const l = Number(limit);
  const filter = {
    $or: [
      { senderId: req.user.id, receiverId: withUserId },
      { senderId: withUserId, receiverId: req.user.id }
    ]
  };
  const messages = await ChatMessage.find(filter)
    .sort({ timestamp: -1 })
    .skip((p - 1) * l)
    .limit(l);
  res.json({ success: true, message: 'History', data: messages.reverse() });
}



