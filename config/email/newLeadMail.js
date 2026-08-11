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

const getVendorLeadsUrl = () => {
  const frontend = (process.env.FRONTEND_URL || "").trim().replace(/\/$/, "");
  return frontend ? `${frontend}/vendor/dashboard` : "#";
};

/**
 * Email to vendors when a new lead / prospect is available.
 * Does not include client contact details (unlocked after purchase).
 */
const newLeadMail = async ({
  name,
  referenceNo,
  serviceTitle,
  city,
  clientType,
  preferredStartDate,
}) => {
  const global = await Global.findOne().select(
    "logo platformName marketplace_name email vendor_logo",
  );
  const brandName =
    global?.platformName || global?.marketplace_name || "Ask Service";
  const supportEmail =
    global?.email || process.env.EMAIL_FROM || "contact@askservice.fr";

  const displayName = escapeHtml(name || "Prestataire");
  const refLabel = escapeHtml(referenceNo || "—");
  const serviceLabel = escapeHtml(serviceTitle || "Nouveau service");
  const cityLabel = escapeHtml(city || "—");
  const clientTypeLabel = escapeHtml(
    clientType === "Company" ? "Entreprise" : clientType === "Individual" ? "Particulier" : clientType || "—",
  );
  const dateLabel = preferredStartDate
    ? escapeHtml(
        new Date(preferredStartDate).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }),
      )
    : null;

  const leadsUrl = getVendorLeadsUrl();

  const headerLogoUrl =
    getHeaderLogoUrl() ||
    resolveLogoUrl(global?.vendor_logo) ||
    resolveLogoUrl(global?.logo);
  const headerLogo = headerLogoUrl
    ? `<img src="${headerLogoUrl}" alt="${escapeHtml(brandName)}" width="140" style="max-height:56px;max-width:160px;width:auto;height:auto;display:block;margin:0 auto;border:0;" />`
    : `<div style="color:#ffffff;font-size:22px;font-weight:700;">${escapeHtml(brandName)}</div>`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Nouveau prospect reçu</title>
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
Nouveau prospect reçu 🔔
</h1>

<p style="margin:0 0 22px 0;font-size:15px;line-height:1.7;color:#475569;">
Bonjour <strong style="color:${HEADER_ORANGE};">${displayName}</strong>,<br><br>
Un nouveau prospect correspondant à vos services est disponible sur ${escapeHtml(brandName)}. Consultez les détails et répondez rapidement pour maximiser vos chances.
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
<tr>
<td style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:18px 20px;text-align:left;">
  <p style="margin:0 0 12px;font-size:14px;color:#64748B;">
    <strong style="color:#0F172A;">Référence :</strong> ${refLabel}
  </p>
  <p style="margin:0 0 12px;font-size:14px;color:#64748B;">
    <strong style="color:#0F172A;">Service :</strong> ${serviceLabel}
  </p>
  <p style="margin:0 0 12px;font-size:14px;color:#64748B;">
    <strong style="color:#0F172A;">Ville :</strong> ${cityLabel}
  </p>
  <p style="margin:0 0 ${dateLabel ? "12px" : "0"};font-size:14px;color:#64748B;">
    <strong style="color:#0F172A;">Type de client :</strong> ${clientTypeLabel}
  </p>
  ${
    dateLabel
      ? `<p style="margin:0;font-size:14px;color:#64748B;">
    <strong style="color:#0F172A;">Date souhaitée :</strong> ${dateLabel}
  </p>`
      : ""
  }
</td>
</tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
<tr>
<td style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px 18px;text-align:left;">
  <p style="margin:0;font-size:13px;line-height:1.6;color:#64748B;">
    Les coordonnées du client sont visibles après déblocage du prospect depuis votre espace prestataire.
  </p>
</td>
</tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 12px auto;">
<tr>
<td align="center" bgcolor="${HEADER_ORANGE}" style="background-color:${HEADER_ORANGE};border-radius:10px;mso-padding-alt:14px 28px;">
<a href="${leadsUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff !important;text-decoration:none;border-radius:10px;background-color:${HEADER_ORANGE};">
Voir le prospect →
</a>
</td>
</tr>
</table>

<p style="margin:18px 0 0 0;font-size:13px;line-height:1.5;color:#94A3B8;">
Si le bouton ne fonctionne pas, ouvrez ce lien :<br>
<a href="${leadsUrl}" target="_blank" rel="noopener noreferrer" style="color:${HEADER_ORANGE};word-break:break-all;">${leadsUrl}</a>
</p>

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

export default newLeadMail;
