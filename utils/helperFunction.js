import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function generatePassword(length = 8) {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*()_+{}[]<>?,.";

  const allChars = upper + lower + numbers + special;

  let password = "";

  password += special[Math.floor(Math.random() * special.length)];

  for (let i = 1; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  return password
    .split("")
    .sort(() => 0.5 - Math.random())
    .join("");
}

/**
 * Normalize French phone numbers for storage.
 * - already +33... → keep
 * - 0033... → +33...
 * - 33... → +33...
 * - 0......... → drop leading 0, add +33
 * - otherwise → prefix +33
 */
export function normalizeFrenchPhone(phone) {
  if (phone === undefined || phone === null || phone === "") return phone;

  let cleaned = String(phone).trim().replace(/[\s\-().]/g, "");

  if (!cleaned) return cleaned;

  if (cleaned.startsWith("+33")) {
    return cleaned;
  }

  if (cleaned.startsWith("0033")) {
    return `+33${cleaned.slice(4)}`;
  }

  if (cleaned.startsWith("33")) {
    return `+${cleaned}`;
  }

  if (cleaned.startsWith("0")) {
    return `+33${cleaned.slice(1)}`;
  }

  return `+33${cleaned}`;
}

export async function generateQR(data) {
  try {
    const qrData = typeof data === "string" ? data : JSON.stringify(data);
    const qr = await QRCode.toDataURL(qrData);
    const base64Data = qr.split(",")[1];

    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 10)}.png`;

    const filePath = path.join(__dirname, "./../public/qr-code", fileName);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
    const relativePath = `public/qr-code/${fileName}`;

    return relativePath;
  } catch (err) {
    console.error("QR Generation Error:", err);
    return null;
  }
}

export async function generateReceiptNumber() {
  const prefix = "RCPT";
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${random}-${Date.now()}`;
}

export const roundAmount = (value) => {
  if (!value || isNaN(value)) return 0;
  return Math.round(Number(value));
};

export const sanitizeObjectId = (value) =>
  value === "" || value === "undefined" || typeof value === "undefined"
    ? null
    : value;

export const sanitizeObjectIdArray = (value) => {
  if (
    value === "" ||
    value === null ||
    value === undefined ||
    value === "undefined"
  ) {
    return [];
  }
  const list = Array.isArray(value) ? value : [value];
  return list.map(sanitizeObjectId).filter((id) => id != null);
};

export const sanitizeStringArray = (value) => {
  if (
    value === "" ||
    value === null ||
    value === undefined ||
    value === "undefined"
  ) {
    return [];
  }
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((item) =>
      typeof item === "string" ? item.trim() : String(item ?? "").trim(),
    )
    .filter(Boolean);
};

/** Normalize user.service whether populated, lean, legacy single id, or array. */
export const getServiceIds = (service) => {
  if (!service) return [];
  if (Array.isArray(service)) {
    return service
      .map((item) =>
        item && typeof item === "object" && item._id ? item._id : item,
      )
      .filter((id) => id != null && id !== "");
  }
  if (typeof service === "object" && service._id) return [service._id];
  return [service].filter((id) => id != null && id !== "");
};

export const hasServices = (service) => getServiceIds(service).length > 0;

export const vendorOwnsService = (vendorServices, categoryId) => {
  if (!categoryId) return false;
  const target = String(categoryId);
  return getServiceIds(vendorServices).some((id) => id.toString() === target);
};

export function maskVendorLeadContactDetails(contact) {
  if (!contact) return contact;
  return {
    ...contact,
    first_name: contact.first_name ? contact.first_name[0] + "***" : "***",
    last_name: contact.last_name ? contact.last_name[0] + "***" : "***",
    phone: (contact.phone || "").slice(0, 3) + " *******",
    email: (contact.email || "").replace(/(.{2})(.*)(@.*)/, "$1*******$3"),
  };
}

export function buildVendorLeadStatus(unlocked, quote) {
  if (quote) {
    switch (quote.status) {
      case "SENT":
        return {
          lead_status: "pending",
          lead_status_label: "PENDING",
          quote_id: quote._id,
        };
      case "ACCEPTED":
        return {
          lead_status: "accepted",
          lead_status_label: "ACCEPTED",
          quote_id: quote._id,
        };
      case "IGNORED":
        return {
          lead_status: "ignored",
          lead_status_label: "IGNORED",
          quote_id: quote._id,
        };
      case "WITHDRAWN":
        return {
          lead_status: "withdrawn",
          lead_status_label: "WITHDRAWN",
          quote_id: quote._id,
        };
    }
  }

  if (unlocked) {
    return {
      lead_status: "unlocked",
      lead_status_label: "UNLOCKED",
      quote_id: null,
    };
  }

  return {
    lead_status: "new",
    lead_status_label: "NEW",
    quote_id: null,
  };
}

function isPopulatedCategoryDoc(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value.title !== undefined ||
      value.credit !== undefined ||
      value.description !== undefined ||
      value.image !== undefined)
  );
}

function stripParentCategoryField(category) {
  if (!category || typeof category !== "object") return category;
  const { parent_category, ...rest } = category;
  return rest;
}

/**
 * Resolve display service_category + its real parent from ServiceCategory.parent_category.
 * Prefer child_category when present (leaf), else service_category.
 */
export function resolveLeadServiceCategories(lead) {
  const serviceCategoryField = lead?.service_category || null;
  const childCategoryField = lead?.child_category || null;

  const primary = childCategoryField || serviceCategoryField;
  if (!primary) {
    return { service_category: null, parent_service_category: null };
  }

  if (typeof primary !== "object") {
    return {
      service_category: primary,
      parent_service_category: null,
    };
  }

  // Real parent = ServiceCategory.parent_category of the displayed service_category
  let parent = isPopulatedCategoryDoc(primary.parent_category)
    ? stripParentCategoryField(primary.parent_category)
    : null;

  // Fallback when child is shown but its parent_category wasn't populated:
  // stored service_category on the lead is usually the parent.
  if (
    !parent &&
    childCategoryField &&
    isPopulatedCategoryDoc(serviceCategoryField)
  ) {
    parent = stripParentCategoryField(serviceCategoryField);
  }

  return {
    service_category: stripParentCategoryField(primary),
    parent_service_category: parent,
  };
}

const DEFAULT_STRONG_QUOTES_THRESHOLD = 5;

export function buildAvailableLeadDisplayStatus({
  unlocked,
  vendorQuote,
  quotesCount = 0,
  prosConsultedCount = 0,
  strongQuotesThreshold = DEFAULT_STRONG_QUOTES_THRESHOLD,
}) {
  const professionals_interested_count = quotesCount;
  const pros_consulted_count = prosConsultedCount;

  if (vendorQuote) {
    const quoteStatus = buildVendorLeadStatus(unlocked, vendorQuote);
    return {
      ...quoteStatus,
      status: quoteStatus.lead_status,
      status_label: quoteStatus.lead_status_label,
      lead_status_message: null,
      lead_status_alert_type: null,
      pros_consulted_count,
      professionals_interested_count,
    };
  }

  if (unlocked) {
    return {
      lead_status: "unlocked",
      lead_status_label: "UNLOCKED",
      status: "unlocked",
      status_label: "UNLOCKED",
      quote_id: null,
      lead_status_message: null,
      lead_status_alert_type: null,
      pros_consulted_count,
      professionals_interested_count,
    };
  }

  if (quotesCount >= strongQuotesThreshold) {
    return {
      lead_status: "strong",
      lead_status_label: "STRONG",
      status: "strong",
      status_label: "STRONG",
      quote_id: null,
      lead_status_message: `${quotesCount} professionals interested`,
      lead_status_alert_type: "warning",
      pros_consulted_count,
      professionals_interested_count,
    };
  }

  if (prosConsultedCount > 0) {
    return {
      lead_status: "new",
      lead_status_label: "NEW",
      status: "new",
      status_label: "NEW",
      quote_id: null,
      lead_status_message: `${prosConsultedCount} Des professionnels ont déjà été consultés`,
      lead_status_alert_type: "hot",
      pros_consulted_count,
      professionals_interested_count,
    };
  }

  return {
    lead_status: "new",
    lead_status_label: "NEW",
    status: "new",
    status_label: "NEW",
    quote_id: null,
    lead_status_message: "Aucun concurrent pour l'instant !",
    lead_status_alert_type: "hot",
    pros_consulted_count: 0,
    professionals_interested_count,
  };
}

export const cookieOptions = {
  maxAge: 60 * 1000,
  httpOnly: true,
  secure: false,
  sameSite: "lax",
};

export const documentUploadCookieOptions = {
  maxAge: 15 * 60 * 1000,
  httpOnly: true,
  secure: false,
  sameSite: "lax"
};

export const createReference = () => {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `REQ-${random}`;
};

const sendGeneratedPasswordToPhone = async ({ phone, password }) => {
  // console.log(`Generated password for ${phone}: ${password}`);
};

export const getIdentifierQuery = ({ email, phone }) => {
  if (email) return { email };
  if (phone) return { phone };
  throw new Error("Email or phone required");
};

export const isVendor = (user) => user?.role?.name === "Vendor";
