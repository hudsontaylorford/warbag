import "server-only";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, magicLink } from "better-auth/plugins";
import { pool } from "./db";
import { sendEmail, signInCodeEmail, signInLinkEmail } from "./email";

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
    // Tests sign in many times a minute; production always limits.
    enabled: process.env.NODE_ENV === "production" || process.env.AUTH_RATE_LIMIT !== "off",
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
        // Made-up sample people can't sign in.
        if (email.toLowerCase().endsWith("@sample.invalid")) return;
        await sendEmail({ to: email, ...signInCodeEmail(otp) });
      },
    }),
    magicLink({
      // One-tap sign-in links, sent only by "This is me" on a family link.
      // Existing accounts only; each link works once, for an hour.
      disableSignUp: true,
      expiresIn: 60 * 60,
      storeToken: "hashed",
      async sendMagicLink({ email, url, metadata }) {
        if (email.toLowerCase().endsWith("@sample.invalid")) return;
        const group = typeof metadata?.group === "string" ? metadata.group : "";
        await sendEmail({ to: email, ...signInLinkEmail(url, group) });
      },
    }),
    nextCookies(), // must stay last
  ],
});

export type Session = typeof auth.$Infer.Session;
