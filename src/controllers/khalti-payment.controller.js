import Appointment from '../models/appointment.model.js';
import User from '../models/user.model.js';
import { sendInApp } from './notification-controller.js';
import { getIO } from '../services/socket.service.js';

function getKhaltiBaseUrl() {
  return (process.env.KHALTI_BASE_URL || 'https://dev.khalti.com/api/v2').replace(/\/$/, '');
}

function getAuthHeader() {
  const secret = process.env.KHALTI_SECRET_KEY;
  if (!secret || !String(secret).trim()) {
    throw new Error('KHALTI_SECRET_KEY is not configured');
  }
  // Docs use "Key <secret>"; cURL examples use "key <secret>" — header value is case-insensitive
  return `Key ${String(secret).trim()}`;
}

function getFrontendBase() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function getReturnUrl() {
  const explicit = process.env.KHALTI_RETURN_URL?.trim();
  if (explicit) return explicit;
  return `${getFrontendBase()}/patient/payment/khalti/return`;
}

export function getAppointmentFeePaisa() {
  const raw = process.env.APPOINTMENT_FEE_PAISA || process.env.KHALTI_AMOUNT_PAISA;
  if (raw) return parseInt(String(raw), 10);
  // Default: NPR 500 → paisa
  return 500 * 100;
}

/** GET /api/payments/fee — public, so UI can show the same amount as Khalti charge */
export async function getPublicFee(_req, res) {
  try {
    const amountPaisa = getAppointmentFeePaisa();
    return res.json({
      success: true,
      amount_paisa: amountPaisa,
      amount_npr: amountPaisa / 100,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/payments/khalti/initiate
 * Body: { appointmentId, customerInfo?: { name, email, phone } }
 */
export async function initiateKhaltiPayment(req, res) {
  try {
    const patientId = req.user.id;
    const { appointmentId, customerInfo = {} } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ success: false, message: 'appointmentId is required' });
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate('patientId', 'name email')
      .populate('doctorId', 'name specialty');

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (String(appointment.patientId._id || appointment.patientId) !== String(patientId)) {
      return res.status(403).json({ success: false, message: 'Not your appointment' });
    }

    if (appointment.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Payment is only available after the doctor has confirmed this appointment.',
      });
    }

    if (appointment.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'This appointment is already paid.' });
    }

    const amountPaisa = getAppointmentFeePaisa();
    if (!Number.isFinite(amountPaisa) || amountPaisa < 1000) {
      return res.status(500).json({
        success: false,
        message: 'Invalid APPOINTMENT_FEE_PAISA (minimum 1000 paisa = NPR 10).',
      });
    }

    const purchaseOrderId = `appt_${appointment._id}_${Date.now()}`;
    const doctorName = appointment.doctorId?.name || 'Doctor';
    const patientUser = await User.findById(patientId).lean();
    const name = customerInfo.name || patientUser?.name || appointment.patientId?.name || 'Patient';
    const email = customerInfo.email || patientUser?.email || appointment.patientId?.email || '';
    const phone = (customerInfo.phone || '9800000000').replace(/\D/g, '').slice(-10) || '9800000000';

    const payload = {
      return_url: getReturnUrl(),
      website_url: getFrontendBase(),
      amount: amountPaisa,
      purchase_order_id: purchaseOrderId,
      purchase_order_name: `DermaEase — Dr. ${doctorName}`,
      customer_info: {
        name,
        email: email || 'patient@example.com',
        phone,
      },
      merchant_extra: JSON.stringify({ appointmentId: String(appointment._id) }),
    };

    const url = `${getKhaltiBaseUrl()}/epayment/initiate/`;
    const khaltiRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await khaltiRes.json().catch(() => ({}));

    if (!khaltiRes.ok) {
      console.error('Khalti initiate error:', data);
      return res.status(400).json({
        success: false,
        message: data?.detail || data?.error_key || data?.message || 'Khalti initiate failed',
        khalti: data,
      });
    }

    const { pidx, payment_url: paymentUrl } = data;
    if (!pidx || !paymentUrl) {
      return res.status(502).json({
        success: false,
        message: 'Invalid response from Khalti (missing pidx or payment_url)',
        khalti: data,
      });
    }

    appointment.paymentStatus = 'pending';
    appointment.khaltiPidx = pidx;
    appointment.khaltiPurchaseOrderId = purchaseOrderId;
    appointment.paymentAmountPaisa = amountPaisa;
    await appointment.save();

    return res.json({
      success: true,
      data: {
        pidx,
        payment_url: paymentUrl,
        amount_paisa: amountPaisa,
        purchase_order_id: purchaseOrderId,
      },
    });
  } catch (err) {
    console.error('initiateKhaltiPayment error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Server error',
    });
  }
}

/**
 * POST /api/payments/khalti/verify
 * Body: { pidx }
 */
export async function verifyKhaltiPayment(req, res) {
  try {
    const patientId = req.user.id;
    const { pidx } = req.body;
    if (!pidx) {
      return res.status(400).json({ success: false, message: 'pidx is required' });
    }

    const appointment = await Appointment.findOne({ khaltiPidx: pidx })
      .populate('patientId', 'name email')
      .populate('doctorId', 'name specialty');

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'No appointment found for this payment.' });
    }

    if (String(appointment.patientId._id || appointment.patientId) !== String(patientId)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (appointment.paymentStatus === 'paid') {
      await appointment.populate('patientId', 'name email');
      await appointment.populate('doctorId', 'name specialty');
      return res.json({
        success: true,
        paid: true,
        message: 'Already paid.',
        data: appointment,
      });
    }

    const url = `${getKhaltiBaseUrl()}/epayment/lookup/`;
    const khaltiRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pidx }),
    });

    const lookup = await khaltiRes.json().catch(() => ({}));

    if (!khaltiRes.ok) {
      console.error('Khalti lookup error:', lookup);
      return res.status(400).json({
        success: false,
        message: lookup?.detail || lookup?.error_key || 'Khalti lookup failed',
        khalti: lookup,
      });
    }

    const status = lookup?.status;
    if (status !== 'Completed') {
      return res.json({
        success: true,
        paid: false,
        status,
        message:
          status === 'User canceled'
            ? 'Payment was canceled.'
            : status === 'Expired'
              ? 'Payment link expired.'
              : `Payment not completed (status: ${status}).`,
        lookup,
      });
    }

    appointment.paymentStatus = 'paid';
    appointment.khaltiTransactionId = lookup.transaction_id || lookup.tidx || undefined;
    appointment.paidAt = new Date();
    await appointment.save();

    await appointment.populate('patientId', 'name email');
    await appointment.populate('doctorId', 'name specialty');

    const patientName = appointment.patientId?.name || 'Patient';
    const doctorName = appointment.doctorId?.name || 'Doctor';

    try {
      const doctorUserId = appointment.doctorId?._id || appointment.doctorId;
      await sendInApp(
        doctorUserId,
        'appointment_payment_success',
        `${patientName} paid via Khalti for appointment with ${doctorName}.`,
        appointment._id,
        {
          patientName,
          doctorName,
          amount_paisa: lookup.total_amount,
          transaction_id: lookup.transaction_id,
        }
      );
    } catch (notifErr) {
      console.error('Doctor payment notification error:', notifErr);
    }

    try {
      const io = getIO();
      if (io) {
        io.to(String(appointment.patientId._id || appointment.patientId)).emit('appointment-updated', appointment);
        io.to(String(appointment.doctorId._id || appointment.doctorId)).emit('appointment-updated', appointment);
      }
    } catch (emitErr) {
      console.error('Socket emit error:', emitErr);
    }

    return res.json({
      success: true,
      paid: true,
      message: 'Payment verified.',
      data: appointment,
      lookup,
    });
  } catch (err) {
    console.error('verifyKhaltiPayment error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Server error',
    });
  }
}
