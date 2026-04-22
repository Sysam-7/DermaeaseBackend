export function requireApprovedDoctor(req, res, next) {
  const role = req.user?.role;
  if (role !== 'doctor') {
    return res.status(403).json({ success: false, message: 'Doctor access required' });
  }

  const status = req.user?.doctorVerificationStatus || 'approved';
  if (status !== 'approved') {
    return res.status(403).json({
      success: false,
      message:
        status === 'rejected'
          ? 'Your doctor application was rejected by admin.'
          : 'Your doctor account is pending admin approval.',
    });
  }
  return next();
}

