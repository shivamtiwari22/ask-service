import Global from "../../src/models/GlobalModel.js";

const HEADER_ORANGE = "#f59e0b";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const resolveLogoUrl = (logo) => {
  if (!logo) return null;
  const value = String(logo);
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const base = process.env.IMAGE_URL || process.env.BASE_URL || "";
  return `${base}${value.startsWith("/") ? value : `/${value}`}`;
};

const getHeaderLogoUrl = () => {
  const base = (process.env.BASE_URL || process.env.IMAGE_URL || "").replace(
    /\/$/,
    "",
  );
  if (!base) return null;
  return `${base}/white-logo.png`;
};

const getClientQuotesUrl = (serviceRequestId) => {
  const frontend = (process.env.FRONTEND_URL || "").trim().replace(/\/$/, "");
  if (!frontend) return "#";
  if (serviceRequestId) {
    return `${frontend}/service-requests/${serviceRequestId}`;
  }
  return `${frontend}/dashboard`;
};

const formatPrice = (amount, currency = "EUR") => {
  const num = Number(amount);
  if (!Number.isFinite(num)) return "—";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency || "EUR",
    }).format(num);
  } catch {
    return `${num} ${currency || "EUR"}`;
  }
};

const formatDateFr = (value) => {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

/**
 * Email to client when a vendor submits a quote on their service request.
 */
const newQuoteMail = async ({
  name,
  quotePrice,
  currency = "EUR",
  referenceNo,
  serviceTitle,
  serviceDescription,
  availableStartDate,
  quoteValidDays,
  serviceRequestId,
}) => {
  const global = await Global.findOne().select(
    "logo platformName marketplace_name email",
  );
  const brandName =
    global?.platformName || global?.marketplace_name || "Ask Service";
  const supportEmail = global?.email || process.env.EMAIL_FROM || "contact@askservice.fr";

  const displayName = escapeHtml(name || "Client");
  const priceLabel = escapeHtml(formatPrice(quotePrice, currency));
  const refLabel = escapeHtml(referenceNo || "—");
  const serviceLabel = escapeHtml(serviceTitle || "votre demande");
  const descLabel = escapeHtml(serviceDescription || "")
    .replace(/\n/g, "<br>")
    .slice(0, 800);
  const startLabel = escapeHtml(formatDateFr(availableStartDate));
  const validDays = Number(quoteValidDays) || 7;
  const quotesUrl = getClientQuotesUrl(serviceRequestId);

  const headerLogoUrl = getHeaderLogoUrl() || resolveLogoUrl(global?.logo);
  const headerLogo = headerLogoUrl
    ? `<img src="${headerLogoUrl}" alt="${escapeHtml(brandName)}" width="140" style="max-height:56px;max-width:160px;width:auto;height:auto;display:block;margin:0 auto;border:0;" />`
    : `<div style="color:#ffffff;font-size:22px;font-weight:700;">${escapeHtml(brandName)}</div>`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Nouveau devis reçu</title>
</head>
<body style="margin:0;padding:0;background:#FFF7ED;font-family:Arial,Helvetica,sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFF7ED;padding:36px 14px;">
<tr>
<td align="center">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(245,158,11,0.12);">

<tr>
<td align="center" style="background:${HEADER_ORANGE};padding:34px 24px;">
  ${headerLogo}
</td>
</tr>

<tr>
<td style="padding:36px 36px 16px 36px;color:#333;">

<h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.3;color:#0F172A;font-weight:700;">
Devis reçu 💰
</h1>

<p style="margin:0 0 22px 0;font-size:15px;line-height:1.7;color:#475569;">
Bonjour <strong style="color:${HEADER_ORANGE};">${displayName}</strong>,<br><br>
Vous avez reçu un nouveau devis d'un prestataire pour <strong>${serviceLabel}</strong>. Consultez-le dès maintenant et comparez vos options.
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
<tr>
<td style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:18px 20px;text-align:left;">
  <p style="margin:0 0 12px;font-size:14px;color:#64748B;">
    <strong style="color:#0F172A;">Référence :</strong> ${refLabel}
  </p>
  <p style="margin:0 0 12px;font-size:14px;color:#64748B;">
    <strong style="color:#0F172A;">Montant du devis :</strong>
    <span style="color:${HEADER_ORANGE};font-weight:700;font-size:16px;">${priceLabel}</span>
  </p>
  <p style="margin:0 0 12px;font-size:14px;color:#64748B;">
    <strong style="color:#0F172A;">Disponible à partir du :</strong> ${startLabel}
  </p>
  <p style="margin:0;font-size:14px;color:#64748B;">
    <strong style="color:#0F172A;">Validité :</strong> ${validDays} jour${validDays > 1 ? "s" : ""}
  </p>
</td>
</tr>
</table>

${
  descLabel
    ? `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
<tr>
<td style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:18px 20px;text-align:left;">
  <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#0F172A;text-transform:uppercase;letter-spacing:0.04em;">
    Description du prestataire
  </p>
  <p style="margin:0;font-size:15px;line-height:1.7;color:#334155;">
    ${descLabel}
  </p>
</td>
</tr>
</table>
`
    : ""
}

<!-- CTA -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 12px auto;">
<tr>
<td align="center" bgcolor="${HEADER_ORANGE}" style="background-color:${HEADER_ORANGE};border-radius:10px;mso-padding-alt:14px 28px;">

</td>
</tr>
</table>



</td>
</tr>

<tr>
<td style="background:#FFFBEB;text-align:center;padding:22px 28px;font-size:13px;color:#92400E;">
Besoin d'aide ? Écrivez-nous à
<a href="mailto:${escapeHtml(supportEmail)}" style="color:${HEADER_ORANGE};text-decoration:none;font-weight:600;">${escapeHtml(supportEmail)}</a>
<br><br>
<span style="color:#A8A29E;">© ${new Date().getFullYear()} ${escapeHtml(brandName)}. Tous droits réservés.</span>
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`;
};

export default newQuoteMail;
