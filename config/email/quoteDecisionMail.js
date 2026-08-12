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

const getVendorDashboardUrl = () => {
  const frontend = (process.env.FRONTEND_URL || "").trim().replace(/\/$/, "");
  return frontend ? `${frontend}/vendor/dashboard` : "#";
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

/**
 * Email to vendor when a client accepts or rejects (ignores) a quote.
 */
const quoteDecisionMail = async ({
  name,
  accepted = true,
  quotePrice,
  currency = "EUR",
  referenceNo,
  serviceTitle,
}) => {
  const global = await Global.findOne().select(
    "logo platformName marketplace_name email vendor_logo",
  );
  const brandName =
    global?.platformName || global?.marketplace_name || "Ask Service";
  const supportEmail =
    global?.email || process.env.EMAIL_FROM || "contact@askservice.fr";

  const displayName = escapeHtml(name || "Prestataire");
  const priceLabel = escapeHtml(formatPrice(quotePrice, currency));
  const refLabel = escapeHtml(referenceNo || "—");
  const serviceLabel = escapeHtml(serviceTitle || "votre demande");
  const dashboardUrl = getVendorDashboardUrl();

  const headerLogoUrl =
    getHeaderLogoUrl() ||
    resolveLogoUrl(global?.vendor_logo) ||
    resolveLogoUrl(global?.logo);
  const headerLogo = headerLogoUrl
    ? `<img src="${headerLogoUrl}" alt="${escapeHtml(brandName)}" width="140" style="max-height:56px;max-width:160px;width:auto;height:auto;display:block;margin:0 auto;border:0;" />`
    : `<div style="color:#ffffff;font-size:22px;font-weight:700;">${escapeHtml(brandName)}</div>`;

  const title = accepted ? "Devis accepté" : "Devis refusé";
  const intro = accepted
    ? `Bonne nouvelle, <strong style="color:${HEADER_ORANGE};">${displayName}</strong> !<br><br>Un client a accepté votre devis pour <strong>${serviceLabel}</strong>. Consultez votre espace prestataire pour la suite.`
    : `Bonjour <strong style="color:${HEADER_ORANGE};">${displayName}</strong>,<br><br>Le client n'a pas retenu votre devis pour <strong>${serviceLabel}</strong>. D'autres prospects sont disponibles dans votre espace prestataire.`;
  const statusColor = accepted ? "#16a34a" : "#dc2626";
  const statusLabel = accepted ? "Accepté" : "Refusé";
  const ctaLabel = accepted
    ? "Voir mon espace prestataire"
    : "Voir les prospects";
  const boxBg = accepted ? "#ECFDF5" : "#FEF2F2";
  const boxBorder = accepted ? "#A7F3D0" : "#FECACA";

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
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
${escapeHtml(title)}
</h1>

<p style="margin:0 0 22px 0;font-size:15px;line-height:1.7;color:#475569;">
${intro}
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
<tr>
<td style="background:${boxBg};border:1px solid ${boxBorder};border-radius:12px;padding:18px 20px;text-align:left;">
  <p style="margin:0 0 12px;font-size:14px;color:#64748B;">
    <strong style="color:#0F172A;">Référence :</strong> ${refLabel}
  </p>
  <p style="margin:0 0 12px;font-size:14px;color:#64748B;">
    <strong style="color:#0F172A;">Service :</strong> ${serviceLabel}
  </p>
  <p style="margin:0 0 12px;font-size:14px;color:#64748B;">
    <strong style="color:#0F172A;">Montant du devis :</strong>
    <span style="color:${HEADER_ORANGE};font-weight:700;font-size:16px;">${priceLabel}</span>
  </p>
  <p style="margin:0;font-size:14px;color:#64748B;">
    <strong style="color:#0F172A;">Statut :</strong>
    <span style="color:${statusColor};font-weight:700;">${statusLabel}</span>
  </p>
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

export default quoteDecisionMail;
