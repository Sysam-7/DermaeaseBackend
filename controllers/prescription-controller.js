import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import Prescription from '../models/prescription.model.js';
import User from '../models/user.model.js';

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

export async function listPrescriptions(req, res) {
  const userId = req.user.id;
  const role = req.user.role;
  const filter = role === 'doctor' ? { doctorId: userId } : role === 'patient' ? { patientId: userId } : {};
  const items = await Prescription.find(filter).sort({ createdAt: -1 });
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
  doc.text('Medicines:');
  (content.medicines || []).forEach((m, i) => {
    doc.text(`${i + 1}. ${m.name} - ${m.dosage} ${m.notes ? '(' + m.notes + ')' : ''}`);
  });
  if (content.notes) {
    doc.moveDown();
    doc.text(`Notes: ${content.notes}`);
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



