import { Router } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { GOOGLE_OAUTH_CALLBACK_URL } from '../config/passport.js';
import { login, register, logout, verifyToken, forgotPassword, resetPassword, verifyGoogleOTP, resendGoogleOTP, sendGoogleOTP } from '../controllers/auth-controller.js';
import { authenticate } from '../middleware/auth-middleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', authenticate, logout);
router.get('/verify-token', authenticate, verifyToken);

// OTP verification routes for Google OAuth (POST from frontend)
router.post('/verify-google-otp', verifyGoogleOTP);
router.post('/resend-google-otp', resendGoogleOTP);

// Test endpoint to verify OTP email sending (for debugging)
router.post('/test-otp-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }
    console.log('🧪 TEST: Sending test OTP email to:', email);
    const otpCode = await sendGoogleOTP(email, 'test-google-id', 'Test User', 'patient');
    return res.json({ 
      success: true, 
      message: 'Test OTP email sent. Check console for OTP code.',
      otp: otpCode // Return OTP for testing
    });
  } catch (err) {
    console.error('🧪 TEST: Error sending test OTP:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Endpoint to retrieve OTP for an email (for debugging/testing)
router.get('/get-otp/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const OTP = (await import('../models/otp.model.js')).default;
    
    const otpRecord = await OTP.findOne({
      email,
      verified: false,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 }); // Get most recent
    
    if (!otpRecord) {
      return res.status(404).json({ 
        success: false, 
        message: 'No valid OTP found for this email' 
      });
    }
    
    return res.json({
      success: true,
      email: otpRecord.email,
      otp: otpRecord.otp,
      expiresAt: otpRecord.expiresAt,
      createdAt: otpRecord.createdAt
    });
  } catch (err) {
    console.error('Error retrieving OTP:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/auth/google/callback-info
 * Public: shows the exact redirect_uri your server uses — paste this into Google Cloud Console.
 */
router.get('/google/callback-info', (req, res) => {
  res.json({
    success: true,
    redirectUri: GOOGLE_OAUTH_CALLBACK_URL,
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    instructions:
      'Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs → open the client whose Client ID matches "clientId" above (type must be Web application) → Authorized redirect URIs → Add URI → paste "redirectUri" exactly (no trailing slash, http not https for localhost).',
  });
});

// Google OAuth start
router.get("/google", (req, res, next) => {
  const role = req.query.role;
  const state = role ? JSON.stringify({ role }) : undefined;
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
    state,
  })(req, res, next);
});

// Google OAuth callback
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.FRONTEND_URL}/login`,
    session: false,
  }),
  async (req, res) => {
    try {
      const user = req.user;
      console.log('🔍 OAuth callback - user object:', JSON.stringify(user, null, 2));
      
      if (!user) {
        console.error('❌ OAuth callback - No user object found');
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
      }

      // Extract role from state if available
      let roleFromState = "patient";
      try {
        const state = req.query?.state;
        if (state) {
          const parsed = JSON.parse(state);
          roleFromState = parsed?.role || "patient";
        }
      } catch (e) {
        console.warn('Could not parse state:', e);
      }

      // Check if this is a new user that needs OTP verification
      // Handle both plain objects and Mongoose documents
      const userObj = user.toObject ? user.toObject() : user;
      const isNewUser = userObj.isNewUser === true || (userObj && !userObj._id && userObj.email);
      
      console.log('🔍 Checking if new user:', {
        hasIsNewUser: userObj.isNewUser,
        hasId: !!userObj._id,
        hasEmail: !!userObj.email,
        isNewUser: isNewUser
      });
      
      if (isNewUser && userObj.email && !userObj._id) {
        console.log('✅ New user detected - sending OTP to:', userObj.email);
        try {
          // Send OTP to the new user's email
          const roleToUse = userObj.role || roleFromState || "patient";
          console.log('📧 Sending OTP with role:', roleToUse);
          
          await sendGoogleOTP(
            userObj.email,
            userObj.googleId,
            userObj.name,
            roleToUse
          );

          console.log('✅ OTP sent successfully to:', userObj.email);

          // Redirect to OTP verification page where user enters 6-digit code
          const frontend = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
          const redirectParams = new URLSearchParams({
            email: userObj.email,
            source: 'google',
          });
          return res.redirect(`${frontend}/verify-otp?${redirectParams.toString()}`);
        } catch (otpErr) {
          console.error("❌ Error sending OTP:", otpErr);
          console.error("❌ Error stack:", otpErr.stack);
          return res.redirect(`${process.env.FRONTEND_URL}/register?error=otp_send_failed`);
        }
      }

      // Existing user - proceed with normal login
      // Make sure we have a valid user with _id
      if (!user._id) {
        console.error('❌ User object missing _id, cannot create token');
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=invalid_user`);
      }

      if (user.accessStatus === 'restricted' || user.accessStatus === 'deleted') {
        const frontend = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
        const statusLabel = user.accessStatus === 'deleted' ? 'blocked' : 'restricted';
        const reason = encodeURIComponent(user.accessReason || 'No reason provided by admin.');
        return res.redirect(`${frontend}/login?error=access_denied&message=${encodeURIComponent(`You have been ${statusLabel} by admin.`)}&reason=${reason}`);
      }
      
      console.log('✅ Existing user - proceeding with login:', user.email);
      const token = jwt.sign(
        { userId: user._id.toString(), role: user.role, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      });

      let role;
      try {
        const state = req.query?.state;
        if (state) {
          const parsed = JSON.parse(state);
          role = parsed?.role;
        }
      } catch (e) {
        // ignore parse errors
      }

      role = role || user.role || "patient";

      const frontend = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
      const redirectParams = new URLSearchParams({
        token,
        role,
      });
      return res.redirect(`${frontend}/auth/success?${redirectParams.toString()}`);
    } catch (err) {
      console.error("OAuth callback error:", err);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
    }
  }
);

export default router;


