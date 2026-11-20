// Dev helper: prints the SQL Better Auth needs for the options in src/lib/auth.ts.
// Keep the options below in sync with that file, then save the output as a new
// file in db/migrations. Usage: DATABASE_URL=... node scripts/print-auth-sql.mjs
import pg from "pg";
import { getMigrations } from "better-auth/db/migration";
import { emailOTP } from "better-auth/plugins";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const { compileMigrations } = await getMigrations({
  database: pool,
  user: {
    additionalFields: {
      isAdmin: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  rateLimit: { enabled: true, storage: "database" },
  plugins: [emailOTP({ sendVerificationOTP: async () => {} })],
});
console.log(await compileMigrations());
await pool.end();
