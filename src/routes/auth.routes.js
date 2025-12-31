import { Router } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { login, register, logout, verifyToken, forgotPassword, resetPassword } from '../controllers/auth-controller.js';
import { authenticate } from '../middleware/auth-middleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', authenticate, logout);
router.get('/verify-token', authenticate, verifyToken);

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
      if (!user) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
      }

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


