import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Ensure dotenv is loaded
dotenv.config();

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  FROM_EMAIL = 'no-reply@dermaease.local'
} = process.env;

// Log SMTP configuration status
console.log('📧 SMTP Configuration Check:', {
  SMTP_HOST: SMTP_HOST ? '✅ Set' : '❌ Missing',
  SMTP_PORT: SMTP_PORT || 'Using default 587',
  SMTP_USER: SMTP_USER ? '✅ Set' : '❌ Missing',
  SMTP_PASS: SMTP_PASS ? '✅ Set (hidden)' : '❌ Missing',
  FROM_EMAIL: FROM_EMAIL
});

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  try {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT ? Number(SMTP_PORT) : 587,
      secure: SMTP_PORT && Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
    console.log('✅ SMTP transporter initialized successfully');
  } catch (err) {
    console.error('❌ Failed to initialize SMTP transporter:', err);
  }
} else {
  console.warn('⚠️  SMTP not fully configured. Missing:', {
    SMTP_HOST: !SMTP_HOST,
    SMTP_USER: !SMTP_USER,
    SMTP_PASS: !SMTP_PASS
  });
}

/**
 * Send email. If SMTP not configured, prints link to console (useful for local dev).
 * @param {string} to
 * @param {string} subject
 * @param {string} html
 */
export async function sendEmail(to, subject, html) {
  if (!transporter) {
    // SMTP not configured: log and return
    console.log('SMTP not configured — email would be sent to:', to);
    console.log('Subject:', subject);
    console.log('HTML:', html);
    return Promise.resolve();
  }

  const msg = {
    from: FROM_EMAIL,
    to,
    subject,
    html,
  };

  try {
    console.log('📤 Sending email via SMTP:', {
      from: msg.from,
      to: msg.to,
      subject: msg.subject,
      host: transporter.options.host,
      port: transporter.options.port,
      user: transporter.options.auth?.user
    });
    
    const info = await transporter.sendMail(msg);
    
    // Log detailed response
    console.log('✅ Email sent successfully:', {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
      envelope: info.envelope,
      pending: info.pending
    });
    
    // Check if email was actually accepted
    if (info.rejected && info.rejected.length > 0) {
      console.error('⚠️  Email was REJECTED by server:', info.rejected);
    }
    if (info.accepted && info.accepted.length === 0) {
      console.error('⚠️  Email was not accepted by server');
    }
    
    return info;
  } catch (err) {
    console.error('❌ sendEmail error:', err);
    console.error('❌ Error details:', {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response,
      responseCode: err.responseCode
    });
    throw err;
  }
}


