import Notification from '../models/notification.model.js';
import SmsLog from '../models/sms-log.model.js';
import { sendEmail } from '../utils/email.js';

export async function listMyNotifications(req, res) {
  const items = await Notification.find({ userId: req.user.id })
    .populate('appointmentId', 'date time status patientId doctorId')
    .populate('appointmentId.patientId', 'name email')
    .populate('appointmentId.doctorId', 'name specialty')
    .sort({ createdAt: -1 });
  res.json({ success: true, message: 'Notifications', data: items });
}

export async function markRead(req, res) {
  const { id } = req.params;
  await Notification.findOneAndUpdate({ _id: id, userId: req.user.id }, { read: true });
  res.json({ success: true, message: 'Marked as read' });
}

export async function markAllAsRead(req, res) {
  await Notification.updateMany({ userId: req.user.id, read: false }, { read: true });
  res.json({ success: true, message: 'All notifications marked as read' });
}

export async function sendInApp(userId, type, message, appointmentId = null, relatedData = null) {
  return Notification.create({ userId, type, message, appointmentId, relatedData });
}

export async function sendEmailNotification(to, subject, text) {
  return sendEmail(to, subject, text);
}

export async function sendDummySms(to, message) {
  return SmsLog.create({ to, message });
}

export async function listSmsLogs(_req, res) {
  const logs = await SmsLog.find({}).sort({ createdAt: -1 });
  res.json({ success: true, message: 'SMS logs', data: logs });
}



