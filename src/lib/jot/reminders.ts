import "server-only";
import { pool } from "../db";
import { audit, canUseApp } from "../access";
import { sendEmail } from "../email";
import { siteUrl } from "../site";
import { firstLine } from "../notes";

/**
 * Sends Jot reminders that are due. Run every few minutes by the scheduler
 * (`/api/jot/reminders`). Each reminder goes out once: it's marked sent
 * before the email, and unmarked if the email fails so the next run tries
 * again. Reminders more than a day late are marked sent without an email
 * (a scheduler outage shouldn't bring a flood of stale ones). Nothing goes
 * out for a note in the Trash, or to someone whose Jot access was removed.
 * Only `remind_by = 'email'` is sent today; texting is for later.
 */

const LATE_LIMIT_HOURS = 24;
const BATCH = 100;

type Due = { id: string; owner_id: string; body: string; email: string; is_admin: boolean; stale: boolean };

export function reminderEmail(body: string, noteUrl: string): { subject: string; text: string } {
  const line = firstLine(body) || "A note in Jot";
  const subject = `Reminder: ${line.length > 70 ? `${line.slice(0, 69)}…` : line}`;
  return { subject, text: `${body.trim() || "(empty note)"}\n\nOpen it in Jot: ${noteUrl}\n\nYou set this reminder in Jot.` };
}

export async function sendDueReminders(now = new Date()): Promise<{ sent: number; skipped: number; failed: number }> {
  const client = await pool.connect();
  let due: Due[];
  try {
    await client.query("begin");
    // Claim due reminders, so two runs at once can't both send one.
    const { rows } = await client.query<Due>(
      `update jot_notes n set reminded_at = $1
       from "user" u
       where n.id in (
         select id from jot_notes
         where reminded_at is null and trashed_at is null and remind_at <= $1
         order by remind_at limit ${BATCH} for update skip locked
       ) and u.id = n.owner_id
       returning n.id, n.owner_id, n.body, u.email, coalesce(u."isAdmin", false) as is_admin,
         (n.remind_at < $1::timestamptz - make_interval(hours => ${LATE_LIMIT_HOURS}) or n.remind_by <> 'email') as stale`,
      [now],
    );
    await client.query("commit");
    due = rows;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const d of due) {
    if (d.stale || !(await canUseApp({ id: d.owner_id, isAdmin: d.is_admin }, "jot"))) {
      skipped++;
      continue;
    }
    try {
      await sendEmail({ to: d.email, ...reminderEmail(d.body, `${siteUrl()}/jot/${d.id}`) });
      await audit(pool, null, "jot.reminder.email", `jot/note/${d.id}`);
      sent++;
    } catch (e) {
      console.error("jot reminder email failed", d.id, e);
      await pool.query("update jot_notes set reminded_at = null where id = $1 and reminded_at = $2", [d.id, now]);
      failed++;
    }
  }
  return { sent, skipped, failed };
}
