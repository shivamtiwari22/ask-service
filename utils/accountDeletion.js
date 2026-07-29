import moment from "moment";
import User from "../src/models/UserModel.js";

export const ACCOUNT_DELETION_GRACE_DAYS = 15;
export const ACCOUNT_DELETION_REMINDER_DAYS = 7;

export function getAccountDeletionScheduleDate(fromDate = new Date()) {
  return moment(fromDate).add(ACCOUNT_DELETION_GRACE_DAYS, "days").toDate();
}

export function isAccountWithinDeletionGracePeriod(user, now = new Date()) {
  if (!user?.deletedAt) return false;
  if (user.deletion_scheduled_at) {
    return new Date(user.deletion_scheduled_at) > now;
  }
  return (
    moment(user.deletedAt).add(ACCOUNT_DELETION_GRACE_DAYS, "days").toDate() >
    now
  );
}

export function buildSoftDeletePayload(reason) {
  const deletedAt = new Date();
  return {
    deletedAt,
    deletion_reason: String(reason).trim(),
    deletion_scheduled_at: getAccountDeletionScheduleDate(deletedAt),
    deletion_reminder_sent_at: null,
    show_welcome_msg: false,
  };
}

/**
 * Clears soft-delete flags if account is still within 15-day grace period.
 * Does not change status.
 */
export async function restoreSoftDeletedAccount(user) {
  if (!user?.deletedAt) {
    return { restored: false, user };
  }

  if (!isAccountWithinDeletionGracePeriod(user)) {
    return { restored: false, user, expired: true };
  }

  if (typeof user.save === "function") {
    user.deletedAt = null;
    user.deletion_reason = null;
    user.deletion_scheduled_at = null;
    user.deletion_reminder_sent_at = null;
    user.show_welcome_msg = true;
    await user.save();
    return { restored: true, user };
  }

  const updated = await User.findByIdAndUpdate(
    user._id,
    {
      $set: {
        deletedAt: null,
        deletion_reason: null,
        deletion_scheduled_at: null,
        deletion_reminder_sent_at: null,
        show_welcome_msg: true,
      },
    },
    { new: true },
  );

  return { restored: true, user: updated };
}

/**
 * Read show_welcome_msg once, then clear it so later profile calls return false.
 */
export async function consumeShowWelcomeMsg(userId) {
  const user = await User.findById(userId).select("show_welcome_msg");
  if (!user) return false;

  const showWelcome = Boolean(user.show_welcome_msg);
  if (showWelcome) {
    user.show_welcome_msg = false;
    await user.save();
  }
  return showWelcome;
}

/**
 * Call on successful authentication.
 * - No soft delete → ok
 * - Soft deleted + within 15 days → restore
 * - Soft deleted + past 15 days → reject (cron will hard-delete)
 */
export async function handleSoftDeletedAccountOnAuth(user) {
  if (!user?.deletedAt) {
    return { ok: true, restored: false, user };
  }

  if (!isAccountWithinDeletionGracePeriod(user)) {
    return { ok: false, expired: true, user };
  }

  const result = await restoreSoftDeletedAccount(user);
  return { ok: true, restored: true, user: result.user };
}
