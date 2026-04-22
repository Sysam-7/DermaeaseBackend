import bcrypt from 'bcryptjs';
import User from '../models/user.model.js';
import DoctorApplication from '../models/doctor-application.model.js';

function normalizeDocumentPath(filePath = '') {
  const normalized = String(filePath).replace(/\\/g, '/');
  const lower = normalized.toLowerCase();
  const uploadsAt = lower.indexOf('/uploads/');
  if (uploadsAt >= 0) return normalized.slice(uploadsAt);
  const uploadsNoSlashAt = lower.indexOf('uploads/');
  if (uploadsNoSlashAt >= 0) return `/${normalized.slice(uploadsNoSlashAt)}`;
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

export async function applyDoctor(req, res) {
  try {
    const { name, email, password, licenseNumber, specialization } = req.body;

    if (!name || !email || !password || !licenseNumber || !specialization) {
      return res.status(400).json({ success: false, message: 'All doctor application fields are required' });
    }

    const medicalLicenseFile = req.files?.medicalLicense?.[0];
    const degreeCertificateFile = req.files?.degreeCertificate?.[0];
    const idDocumentFile = req.files?.idDocument?.[0];

    const medicalLicensePath = medicalLicenseFile?.filename
      ? `/uploads/doctor-documents/${medicalLicenseFile.filename}`
      : '';
    const degreeCertificatePath = degreeCertificateFile?.filename
      ? `/uploads/doctor-documents/${degreeCertificateFile.filename}`
      : '';
    const idDocumentPath = idDocumentFile?.filename
      ? `/uploads/doctor-documents/${idDocumentFile.filename}`
      : '';

    if (!medicalLicensePath || !degreeCertificatePath || !idDocumentPath) {
      return res.status(400).json({ success: false, message: 'Please upload all required documents' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashed,
      role: 'doctor',
      specialty: specialization,
      doctorLicenseNumber: licenseNumber,
      doctorVerificationStatus: 'pending',
      verified: false,
    });

    await DoctorApplication.create({
      userId: user._id,
      name,
      email,
      licenseNumber,
      specialization,
      medicalLicensePath,
      degreeCertificatePath,
      idDocumentPath,
      status: 'pending',
    });

    return res.status(201).json({
      success: true,
      message: 'Application submitted. Please wait for admin approval.',
      status: 'pending',
    });
  } catch (err) {
    console.error('applyDoctor error:', err);
    if (err.code === 11000 || err.name === 'MongoServerError') {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    return res.status(500).json({ success: false, message: 'Server error while applying as doctor' });
  }
}

export async function listPendingDoctorApplications(req, res) {
  try {
    const applications = await DoctorApplication.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .lean();
    const normalizedApplications = applications.map((app) => ({
      ...app,
      medicalLicensePath: normalizeDocumentPath(app.medicalLicensePath),
      degreeCertificatePath: normalizeDocumentPath(app.degreeCertificatePath),
      idDocumentPath: normalizeDocumentPath(app.idDocumentPath),
    }));
    return res.json({ success: true, data: normalizedApplications });
  } catch (err) {
    console.error('listPendingDoctorApplications error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

export async function reviewDoctorApplication(req, res) {
  try {
    const { id } = req.params;
    const { action, reviewNotes } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    const application = await DoctorApplication.findById(id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    if (application.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Application already reviewed' });
    }

    const user = await User.findById(application.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Doctor account not found' });
    }

    if (action === 'approve') {
      user.role = 'doctor';
      user.specialty = application.specialization;
      user.doctorLicenseNumber = application.licenseNumber;
      user.doctorVerificationStatus = 'approved';
      user.verified = true;
      application.status = 'approved';
    } else {
      user.doctorVerificationStatus = 'rejected';
      application.status = 'rejected';
    }

    application.reviewNotes = (reviewNotes || '').trim();
    application.reviewedAt = new Date();
    application.reviewedBy = req.admin?._id || undefined;

    await user.save();
    await application.save();

    return res.json({
      success: true,
      message: action === 'approve' ? 'Doctor approved successfully' : 'Doctor application rejected',
    });
  } catch (err) {
    console.error('reviewDoctorApplication error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
