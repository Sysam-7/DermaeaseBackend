// config/passport.js
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.model.js";
import dotenv from "dotenv";

dotenv.config();

// Validate Google OAuth configuration
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('⚠️  Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
}

// Default callback URL if not set
const callbackURL = process.env.GOOGLE_CALLBACK_URL || 
  `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/google/callback`;

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

        // Try to find user by googleId first
        let user = await User.findOne({ googleId: profile.id });

        // If not found, try to find by email and link the account
        if (!user) {
          user = await User.findOne({ email: profile.emails[0].value });
          if (user) {
            // Link Google account to existing user
            user.googleId = profile.id;
            if (!user.name && profile.displayName) user.name = profile.displayName;
            await user.save();
          } else {
            // Create new user
          user = await User.create({
            googleId: profile.id,
              name: profile.displayName || 'User',
            email: profile.emails[0].value,
            role: "patient",
              password: undefined, // No password for OAuth users
            });
          }
        } else {
          // Update user info if needed
          if (profile.displayName && !user.name) {
            user.name = profile.displayName;
            await user.save();
          }
        }

        return done(null, user);
      } catch (error) {
        console.error('Passport Google Strategy error:', error);
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

export default passport;
