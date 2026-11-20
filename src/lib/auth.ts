import "server-only";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { pool } from "./db";
import { sendEmail, signInCodeEmail } from "./email";

function baseURL(): string | undefined {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return undefined; // local dev: Better Auth uses the request's origin
}

export const auth = betterAuth({
  appName: "warbag",
  baseURL: baseURL(),
  database: pool,
  user: {
    additionalFields: {
      // Admins manage people, groups and access. Never settable by users.
      isAdmin: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 60, // 60 days
    updateAge: 60 * 60 * 24, // refresh at most once a day
  },
  rateLimit: {
    enabled: true,
    storage: "database", // memory limits don't survive serverless instances
  },
  plugins: [
    emailOTP({
      // Invite only: unknown emails get the same "code sent" reply and no email.
      disableSignUp: true,
      otpLength: 6,
      expiresIn: 60 * 10,
      allowedAttempts: 5,
      storeOTP: "hashed",
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== "sign-in") return;
        await sendEmail({ to: email, ...signInCodeEmail(otp) });
      },
    }),
    nextCookies(), // must stay last
  ],
});

export type Session = typeof auth.$Infer.Session;
