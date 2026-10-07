import crypto from "crypto";
import mongoose from "mongoose";
import Stripe from "stripe";
import Transaction from "../src/models/TransactionModel.js";
import VendorCreditWallet from "../src/models/VendorCreditWalletModel.js";
import CreditPackage from "../src/models/CreditPackageModel.js";

export const DEFAULT_CREDIT_PACKAGES = [
  { name: "Starter", credits: 50, bonus_credits: 0, price: 19.99, currency: "EUR", per_credit_price: 0.4, is_most_popular: false, sort_order: 1 },
  { name: "Professional", credits: 150, bonus_credits: 15, price: 49.99, currency: "EUR", per_credit_price: 0.33, is_most_popular: true, sort_order: 2 },
  { name: "Business", credits: 300, bonus_credits: 30, price: 89.99, currency: "EUR", per_credit_price: 0.3, is_most_popular: false, sort_order: 3 },
  { name: "Enterprise", credits: 500, bonus_credits: 50, price: 139.99, currency: "EUR", per_credit_price: 0.28, is_most_popular: false, sort_order: 4 },
];

export const PACKAGE_KEY_MAP = {
  starter: DEFAULT_CREDIT_PACKAGES[0],
  professional: DEFAULT_CREDIT_PACKAGES[1],
  business: DEFAULT_CREDIT_PACKAGES[2],
  enterprise: DEFAULT_CREDIT_PACKAGES[3],
};

export function generateTransactionNumber(id, date) {
  const year = new Date(date || Date.now()).getFullYear();
  const num = parseInt(id.toString().slice(-5), 16) % 100000;
  return `TXN-${year}-${String(num).padStart(5, "0")}`;
}

export const packagePriceInCents = (price) => {
  const vatRate = Number(process.env.VAT_RATE || 0);
  return Math.round((Number(price) + (Number(price) * vatRate) / 100) * 100);
};

export class CreditPurchaseError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY);

export async function retrieveCheckoutSession(sessionId) {
  try {
    return await getStripe().checkout.sessions.retrieve(sessionId);
  } catch (err) {
    if (err?.type === "StripeInvalidRequestError") return null;
    throw err;
  }
}

export async function resolveCreditPackage({ package_id, package_key } = {}) {
  let pkg = null;
  if (package_id && mongoose.isValidObjectId(package_id)) {
    pkg = await CreditPackage.findOne({
      _id: package_id,
      status: "ACTIVE",
      deletedAt: null,
    }).lean();
  }
  if (!pkg && package_key) {
    const fallback = PACKAGE_KEY_MAP[String(package_key).toLowerCase()];
    if (fallback) pkg = { ...fallback, _id: String(package_key) };
  }
  return pkg;
}

const isDuplicateSessionError = (err) =>
  err?.code === 11000 && Boolean(err?.keyPattern?._id || /index: _id_/.test(String(err?.message || "")));

async function findCreditedTransaction(sessionId) {
  return Transaction.findOne({
    stripe_session_id: sessionId,
    reference_type: "credit_purchase",
  }).lean();
}

/** Same Stripe session always maps to the same Transaction _id. */
export function transactionIdForSession(sessionId) {
  const hex = crypto.createHash("sha256").update(`stripe:${sessionId}`).digest("hex");
  return new mongoose.Types.ObjectId(hex.slice(0, 24));
}

/**
 * Credits a paid Stripe Checkout session exactly once. Used by both
 * POST /credits/purchase and the Stripe webhook; the Transaction _id is
 * derived from the session id, so the built-in unique _id index makes the
 * second caller a no-op.
 */
export async function creditCheckoutSession(
  session,
  { expectedUserId = null, packageHint = {}, paymentMethod = "Stripe" } = {},
) {
  if (!session?.id) throw new CreditPurchaseError(400, "Invalid session_id");
  if (session.payment_status !== "paid") {
    throw new CreditPurchaseError(400, "Payment not completed");
  }

  const vendorId = String(session.metadata?.user_id || "");
  if (!vendorId || (expectedUserId && vendorId !== String(expectedUserId))) {
    throw new CreditPurchaseError(403, "Payment does not belong to this vendor");
  }

  const existing = await findCreditedTransaction(session.id);
  if (existing) return { alreadyCredited: true, transaction: existing };

  const pkg = await resolveCreditPackage({
    package_id: session.metadata?.package_id || packageHint.package_id,
    package_key: session.metadata?.package_key || packageHint.package_key,
  });
  if (!pkg) {
    throw new CreditPurchaseError(400, "package_id or package_key is required");
  }

  const creditsAdded = (pkg.credits || 0) + (pkg.bonus_credits || 0);
  if (creditsAdded <= 0) throw new CreditPurchaseError(400, "Invalid package");

  const expectedCents = packagePriceInCents(pkg.price);
  const paidCents = Number(session.amount_total || 0);
  if (!Number.isFinite(expectedCents) || expectedCents <= 0 || Math.abs(paidCents - expectedCents) > 1) {
    throw new CreditPurchaseError(400, "Payment amount does not match the package");
  }

  const txId = transactionIdForSession(session.id);
  const createdAt = new Date();
  let transaction;
  let wallet;

  try {
    await mongoose.connection.transaction(async (dbSession) => {
      wallet = await VendorCreditWallet.findOneAndUpdate(
        { user_id: vendorId },
        { $inc: { amount: creditsAdded } },
        { new: true, upsert: true, session: dbSession },
      );

      [transaction] = await Transaction.create(
        [
          {
            _id: txId,
            user_id: vendorId,
            amount: creditsAdded,
            type: "credit",
            status: "completed",
            description: `Purchased ${pkg.name}`,
            balance_after: wallet.amount,
            reference_type: "credit_purchase",
            reference_id: pkg._id && typeof pkg._id === "object" ? pkg._id : undefined,
            plat_form: "stripe",
            amount_paid: paidCents / 100,
            currency: pkg.currency || "EUR",
            payment_method: paymentMethod || "Stripe",
            stripe_session_id: session.id,
            transaction_number: generateTransactionNumber(txId, createdAt),
            createdAt,
          },
        ],
        { session: dbSession },
      );
    });
  } catch (err) {
    if (!isDuplicateSessionError(err)) throw err;
    const credited = await findCreditedTransaction(session.id);
    if (!credited) throw err;
    return { alreadyCredited: true, transaction: credited };
  }

  return { alreadyCredited: false, transaction, wallet, pkg, creditsAdded };
}
