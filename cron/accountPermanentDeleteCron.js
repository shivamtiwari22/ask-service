import cron from "node-cron";
import User from "../src/models/UserModel.js";

/**
 * Permanently delete soft-deleted accounts after 15-day grace period.
 * Same action as the previous hard deleteAccount: User.findByIdAndDelete
 */
cron.schedule("0 0 * * *", async () => {
  try {
    console.log("Running Account Permanent Delete Cron...");

    const now = new Date();
    const expiredAccounts = await User.find({
      deletedAt: { $ne: null },
      deletion_scheduled_at: { $lte: now },
    }).select("_id email");

    if (!expiredAccounts.length) {
      console.log("No expired soft-deleted accounts found.");
      return;
    }

    let deletedCount = 0;
    for (const account of expiredAccounts) {
      await User.findByIdAndDelete(account._id);
      deletedCount += 1;
    }

    console.log(
      `Permanently deleted ${deletedCount} soft-deleted account(s) successfully`,
    );
  } catch (error) {
    console.error("Account Permanent Delete Cron Error:", error);
  }
});
