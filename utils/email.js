import nodemailer from 'nodemailer';

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  FROM_EMAIL = 'no-reply@dermaease.local'
} = process.env;

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? Number(SMTP_PORT) : 587,
    secure: SMTP_PORT && Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
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
    const info = await transporter.sendMail(msg);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (err) {
    console.error('sendEmail error:', err);
    throw err;
  }
}


