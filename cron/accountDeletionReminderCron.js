import moment from "moment";
import cron from "node-cron";
import User from "../src/models/UserModel.js";
import { sendEmail } from "../config/emailConfig.js";
import accountDeletionReminderMail from "../config/email/accountDeletionReminderMail.js";
import {
  ACCOUNT_DELETION_REMINDER_DAYS,
  ACCOUNT_DELETION_GRACE_DAYS,
} from "../utils/accountDeletion.js";

/**
 * Soft-deleted for 7 days → send reminder: 7 days left before permanent deletion.
 * Runs daily at 00:30 so it doesn't collide with the midnight permanent-delete cron.
 */
cron.schedule("30 0 * * *", async () => {
  try {
    console.log("Running Account Deletion Reminder Cron...");

    const now = new Date();
    const reminderCutoff = moment(now)
      .subtract(ACCOUNT_DELETION_REMINDER_DAYS, "days")
      .toDate();

    const accounts = await User.find({
      deletedAt: { $ne: null, $lte: reminderCutoff },
      deletion_scheduled_at: { $gt: now },
      deletion_reminder_sent_at: null,
      email: { $ne: null },
    }).select("_id first_name last_name email deletedAt deletion_scheduled_at");

    if (!accounts.length) {
      console.log("No soft-deleted accounts due for reminder.");
      return;
    }

    let sentCount = 0;
    for (const account of accounts) {
      try {
        const daysLeft = Math.max(
          1,
          moment(account.deletion_scheduled_at).diff(moment(now), "days"),
        );
        const name =
          `${account.first_name || ""} ${account.last_name || ""}`.trim() ||
          "Utilisateur";

        await sendEmail({
          to: account.email,
          subject: `Ask Service - Votre compte sera désactivé dans ${daysLeft} jours`,
          html: await accountDeletionReminderMail({ name, daysLeft }),
        });

        await User.updateOne(
          { _id: account._id },
          { $set: { deletion_reminder_sent_at: now } },
        );
        sentCount += 1;
      } catch (mailError) {
        console.error(
          `Deletion reminder email failed for ${account.email}:`,
          mailError,
        );
      }
    }

    console.log(
      `Sent ${sentCount}/${accounts.length} account deletion reminder email(s) (grace ${ACCOUNT_DELETION_GRACE_DAYS} days, reminder after ${ACCOUNT_DELETION_REMINDER_DAYS} days)`,
    );
  } catch (error) {
    console.error("Account Deletion Reminder Cron Error:", error);
  }
});
