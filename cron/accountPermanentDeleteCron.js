import cron from "node-cron";
import User from "../src/models/UserModel.js";
import VendorDocument from "../src/models/VendorDocumentModel.js";
import VendorCreditWallet from "../src/models/VendorCreditWalletModel.js";
import VendorLeadUnlock from "../src/models/VendorLeadUnlockModel.js";
import VendorQuote from "../src/models/VendorQuoteModel.js";
import VendorReview from "../src/models/VendorReviewModel.js";
import VendorNotification from "../src/models/vendorNotificationModel.js";
import UserNotification from "../src/models/userNotificationModel.js";
import BusinessInformation from "../src/models/BusinessInformationModel.js";
import Transaction from "../src/models/TransactionModel.js";
import ServiceRequest from "../src/models/ServiceRequestModel.js";
import Chat from "../src/models/ChatModel.js";
import Message from "../src/models/MessageModel.js";
import Notification from "../src/models/NotificationModel.js";
import Report from "../src/models/ReportModel.js";

/**
 * Permanently delete soft-deleted accounts after 15-day grace period,
 * including related documents, chats, requests, and KYC files.
 */
if (process.env.CRON_ENABLED === "true") cron.schedule("0 0 * * *", async () => {
  try {
    console.log("Running Account Permanent Delete Cron...");

    const now = new Date();
    const expiredAccounts = await User.find({
      deletedAt: { $ne: null },
      deletion_scheduled_at: { $lte: now },
    }).select("_id");

    if (!expiredAccounts.length) {
      console.log("No expired soft-deleted accounts found.");
      return;
    }

    let deletedCount = 0;
    for (const account of expiredAccounts) {
      const userId = account._id;
      const chats = await Chat.find({ users: userId }).select("_id").lean();
      const chatIds = chats.map((c) => c._id);

      await Promise.all([
        VendorDocument.deleteMany({ user_id: userId }),
        VendorCreditWallet.deleteMany({ user_id: userId }),
        VendorLeadUnlock.deleteMany({ vendor_id: userId }),
        VendorQuote.deleteMany({ vendor_id: userId }),
        VendorReview.deleteMany({ $or: [{ vendor: userId }, { user: userId }] }),
        VendorNotification.deleteMany({ user_id: userId }),
        UserNotification.deleteMany({ user_id: userId }),
        BusinessInformation.deleteMany({ user_id: userId }),
        Transaction.deleteMany({ user_id: userId }),
        ServiceRequest.deleteMany({ user: userId }),
        Notification.deleteMany({ user_id: userId }),
        Report.deleteMany({
          $or: [{ reporter: userId }, { reported_user: userId }],
        }),
        chatIds.length
          ? Message.deleteMany({ chat: { $in: chatIds } })
          : Promise.resolve(),
        Chat.deleteMany({ users: userId }),
      ]);

      await User.findByIdAndDelete(userId);
      deletedCount += 1;
    }

    console.log(
      `Permanently deleted ${deletedCount} soft-deleted account(s) successfully`,
    );
  } catch (error) {
    console.error("Account Permanent Delete Cron Error:", error);
  }
});
