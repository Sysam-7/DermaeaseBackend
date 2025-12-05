import express from "express";
import passport from "passport";
import jwt from "jsonwebtoken";

const router = express.Router();

// Start Google OAuth flow - accept optional ?role=patient|doctor and pass it as state
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

      // Create JWT (optional - you can also rely on httpOnly cookie)
      const token = jwt.sign(
        { userId: user._id.toString(), role: user.role, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      // Set httpOnly cookie with token
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      });

      // Try to read role from state (Google will echo state back)
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

      // fallback to user.role or 'patient'
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