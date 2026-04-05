// config/passport.js
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.model.js";
import { sendGoogleOTP } from "../controllers/auth-controller.js";
import dotenv from "dotenv";

dotenv.config();

// Validate Google OAuth configuration
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('⚠️  Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
}

/**
 * Must match EXACTLY one "Authorized redirect URI" in Google Cloud Console.
 * Correct path for this app: .../api/auth/google/callback (routes mount under /api/auth)
 */
function resolveGoogleCallbackURL() {
  const raw = process.env.GOOGLE_CALLBACK_URL?.trim();
  if (raw) {
    // Common mistake: /auth/google/callback without /api — fix automatically
    if (/\/auth\/google\/callback$/.test(raw) && !/\/api\/auth\/google\/callback$/.test(raw)) {
      const fixed = raw.replace(/\/auth\/google\/callback$/, '/api/auth/google/callback');
      console.warn(`⚠️  GOOGLE_CALLBACK_URL had wrong path; using: ${fixed}`);
      return fixed;
    }
    return raw;
  }
  const port = process.env.PORT || 5000;
  const base = (process.env.BACKEND_URL || `http://localhost:${port}`).replace(/\/$/, '');
  return `${base}/api/auth/google/callback`;
}

const callbackURL = resolveGoogleCallbackURL();

/** Exact string that must appear under "Authorized redirect URIs" for this Web client in Google Cloud Console */
export const GOOGLE_OAUTH_CALLBACK_URL = callbackURL;

console.log(`🔐 Google OAuth callback URL: ${callbackURL}`);

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: callbackURL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        if (!profile || !profile.id || !profile.emails || !profile.emails[0]) {
          return done(new Error('Invalid Google profile data'), null);
        }

        const email = profile.emails[0].value;
        const googleId = profile.id;
        const name = profile.displayName || 'User';

        console.log(`🔍 Google OAuth - Checking user: ${email}, googleId: ${googleId}`);

        // Try to find user by googleId first
        let user = await User.findOne({ googleId });

        // If not found, try to find by email and link the account
        if (!user) {
          console.log(`🔍 User not found by googleId, checking by email: ${email}`);
          user = await User.findOne({ email });
          if (user) {
            // Link Google account to existing user (existing user, no OTP needed)
            console.log(`✅ Existing user found by email, linking Google account`);
            user.googleId = googleId;
            if (!user.name && name) user.name = name;
            await user.save();
            return done(null, user);
          } else {
            // NEW USER - Send OTP instead of creating user directly
            console.log(`🆕 NEW USER detected: ${email} - will require OTP verification`);
            return done(null, {
              isNewUser: true,
              email,
              googleId,
              name,
              role: "patient"
            });
          }
        } else {
          // Existing user - Update user info if needed
          if (profile.displayName && !user.name) {
            user.name = profile.displayName;
            await user.save();
          }
          return done(null, user);
        }
      } catch (error) {
        console.error('Passport Google Strategy error:', error);
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  // Handle special new user object
  if (user && user.isNewUser) {
    // Store the entire object for new users
    done(null, JSON.stringify(user));
  } else if (user && user.id) {
    // Normal user serialization
    done(null, user.id);
  } else {
    done(null, null);
  }
});

passport.deserializeUser(async (id, done) => {
  try {
    // Check if it's a JSON string (new user object)
    if (typeof id === 'string' && id.startsWith('{')) {
      const userObj = JSON.parse(id);
      done(null, userObj);
    } else {
      // Normal user deserialization
      const user = await User.findById(id);
      done(null, user);
    }
  } catch (err) {
    done(err, null);
  }
});

export default passport;
