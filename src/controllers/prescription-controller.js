import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import Prescription from '../models/prescription.model.js';
import User from '../models/user.model.js';
import { sendInApp } from './notification-controller.js';
import { getIO } from '../services/socket.service.js';

export async function createPrescription(req, res) {
  const doctorId = req.user.id;
  const { patientId, content } = req.body;
  const doctor = await User.findById(doctorId);
  if (doctor.role !== 'doctor') return res.status(403).json({ success: false, message: 'Forbidden' });
  const prescription = await Prescription.create({ doctorId, patientId, content });
  const pdfLink = await generatePdf(prescription._id, doctorId, patientId, content);
  prescription.pdfLink = pdfLink;
  await prescription.save();
  res.json({ success: true, message: 'Prescription created', data: prescription });
}

export async function sendPrescriptionToPatient(req, res) {
  try {
    const doctorId = req.user.id;
    const { prescriptionId } = req.body;
    
    const doctor = await User.findById(doctorId);
    if (doctor.role !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const prescription = await Prescription.findById(prescriptionId)
      .populate('doctorId', 'name')
      .populate('patientId', 'name email');
    
    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }

    if (prescription.doctorId._id.toString() !== doctorId.toString()) {
      return res.status(403).json({ success: false, message: 'You can only send your own prescriptions' });
    }

    // Create notification for patient
    const doctorName = doctor.name || 'Dr. Smith';
    const notificationMessage = `New prescription has been sent to you by ${doctorName}`;
    
    await sendInApp(
      prescription.patientId._id,
      'prescription_sent',
      notificationMessage,
      null,
      {
        prescriptionId: prescription._id.toString(),
        doctorId: doctorId.toString(),
        doctorName: doctorName,
        disease: prescription.content?.disease || 'Skin condition'
      }
    );

    // Emit real-time notification via socket
    try {
      const io = getIO();
      if (io) {
        io.to(String(prescription.patientId._id)).emit('new-prescription', {
          prescriptionId: prescription._id.toString(),
          doctorName: doctorName,
          timestamp: new Date()
        });
      }
    } catch (socketErr) {
      console.error('Socket emit error:', socketErr);
    }

    res.json({ 
      success: true, 
      message: 'Prescription sent to patient successfully',
      data: prescription 
    });
  } catch (err) {
    console.error('Send prescription error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

export async function listPrescriptions(req, res) {
  const userId = req.user.id;
  const role = req.user.role;
  const filter = role === 'doctor' ? { doctorId: userId } : role === 'patient' ? { patientId: userId } : {};
  const items = await Prescription.find(filter)
    .sort({ createdAt: -1 })
    .populate('doctorId', 'name specialty')
    .populate('patientId', 'name email')
    .lean();
  res.json({ success: true, message: 'Prescriptions', data: items });
}

async function generatePdf(id, doctorId, patientId, content) {
  const outDir = path.join(process.cwd(), 'storage');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const filePath = path.join(outDir, `prescription-${id}.pdf`);
  const doc = new PDFDocument();
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);
  doc.fontSize(20).text('Derma Ease Prescription', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Doctor: ${doctorId}`);
  doc.text(`Patient: ${patientId}`);
  doc.moveDown();
  if (content.disease) {
    doc.fontSize(14).text(`Diagnosis: ${content.disease}`);
    doc.moveDown();
  }
  doc.fontSize(12).text('Medicines:');
  (content.medicines || []).forEach((m, i) => {
    let medText = `${i + 1}. ${m.name}`;
    if (m.dosage) medText += ` - ${m.dosage}`;
    if (m.frequency) medText += ` (${m.frequency})`;
    if (m.duration) medText += ` for ${m.duration}`;
    if (m.notes) medText += ` - ${m.notes}`;
    doc.text(medText);
  });
  if (content.notes) {
    doc.moveDown();
    doc.text(`Additional Notes: ${content.notes}`);
  }
  doc.end();
  await new Promise((resolve) => stream.on('finish', resolve));
  return `/api/prescriptions/files/prescription-${id}.pdf`;
}

export async function servePdf(req, res) {
  const { filename } = req.params;
  const outDir = path.join(process.cwd(), 'storage');
  const filePath = path.join(outDir, filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
  res.sendFile(filePath);
}



