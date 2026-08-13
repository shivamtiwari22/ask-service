import Global from "../../src/models/GlobalModel.js";

const HEADER_ORANGE = "#F5A623";
const NAVY = "#0F1B33";
const GREEN = "#22C55E";
const MUTED = "#64748B";

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

const getVendorHeaderLogoUrl = () => {
  const base = (process.env.BASE_URL || process.env.IMAGE_URL || "").replace(
    /\/$/,
    "",
  );
  if (!base) return null;
  return `${base}/white-logo.png`;
};

const getDashboardUrl = () => {
  const frontend = (process.env.FRONTEND_URL || "").trim().replace(/\/$/, "");
  return frontend ? `${frontend}/vendor/dashboard` : "#";
};

const kycStatusMail = async ({ name, status, statusLabel }) => {
  const global = await Global.findOne().select(
    "logo platformName marketplace_name email vendor_logo",
  );
  const brandName =
    global?.platformName || global?.marketplace_name || "Ask Service";
  const supportEmail = global?.email || "contact@askservice.fr";
  const displayName = escapeHtml(name || "Prestataire");
  const dashboardUrl = getDashboardUrl();

  const headerLogoUrl =
    getVendorHeaderLogoUrl() ||
    resolveLogoUrl(global?.vendor_logo) ||
    resolveLogoUrl(global?.logo);

  const headerLogo = headerLogoUrl
    ? `<img src="${headerLogoUrl}" alt="${escapeHtml(brandName)}" width="120" style="max-height:64px;max-width:150px;width:auto;height:auto;display:block;margin:0 auto;border:0;" />`
    : `<div style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">${escapeHtml(brandName)}</div>`;

  const isActive = status === "ACTIVE";
  const isRejected = status === "REJECTED";

  const title = isActive
    ? "Félicitations !"
    : isRejected
      ? "Mise à jour concernant votre vérification"
      : "Votre dossier est en cours d'examen";

  const subtitle = isActive
    ? `Bonjour <strong>${displayName}</strong>,<br><br>Tous vos documents ont été vérifiés avec succès. Votre compte prestataire est désormais <strong style="color:${HEADER_ORANGE};">vérifié</strong> et pleinement activé.`
    : isRejected
      ? `Bonjour <strong>${displayName}</strong>, votre vérification n'a malheureusement pas pu être validée pour le moment.`
      : `Bonjour <strong>${displayName}</strong>, votre dossier KYC est actuellement en cours d'examen.`;

  const badgeText = escapeHtml(
    isActive ? "Prestataire vérifié" : statusLabel || status,
  );
  const badgeColor = isActive ? GREEN : isRejected ? "#DC2626" : HEADER_ORANGE;

  const ctaLabel = isActive
    ? "Accéder à mon espace prestataire"
    : isRejected
      ? "Mettre à jour mes documents"
      : "Voir mon espace prestataire";

  const documentsVerifiedBlock = isActive
    ? `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
  <tr>
    <td style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:12px;padding:16px 18px;text-align:left;">
      <p style="margin:0 0 8px 0;font-size:14px;font-weight:700;color:#065F46;">
        Documents validés
      </p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#047857;">
        Tous vos documents requis ont été examinés et approuvés. Vous pouvez maintenant consulter les prospects, débloquer des leads et envoyer des devis.
      </p>
    </td>
  </tr>
</table>
`
    : "";

  const featuresBlock = isActive
    ? `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
  <tr>
    <td align="left" style="padding:0 0 12px 0;font-size:15px;font-weight:700;color:${NAVY};">
      Ce que vous pouvez faire dès maintenant :
    </td>
  </tr>
  <tr>
    <td style="font-size:14px;line-height:1.7;color:${MUTED};">
      <p style="margin:0 0 8px 0;">Consulter les prospects disponibles</p>
      <p style="margin:0 0 8px 0;">Débloquer des leads et envoyer des devis</p>
      <p style="margin:0;">Développer votre réputation</p>
    </td>
  </tr>
</table>
`
    : `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
  <tr>
    <td align="left" style="font-size:14px;line-height:1.7;color:${MUTED};">
      ${
        isRejected
          ? "Pas d'inquiétude : vérifiez vos documents et soumettez-les à nouveau — nous serons ravis de les revoir rapidement."
          : "Nous vous préviendrons dès qu'une décision sera prise. Merci pour votre patience !"
      }
    </td>
  </tr>
</table>
`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F4F6;padding:28px 12px;">
<tr>
<td align="center">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 28px rgba(15,23,42,0.08);">

<tr>
<td align="center" bgcolor="${HEADER_ORANGE}" style="background-color:${HEADER_ORANGE};padding:36px 24px;">
  ${headerLogo}
</td>
</tr>

<tr>
<td align="center" style="background:#ffffff;padding:32px 32px 8px 32px;">

  <h1 style="margin:0 0 10px 0;font-size:28px;line-height:1.25;color:${NAVY};font-weight:800;">
    ${escapeHtml(title)}
  </h1>

  <p style="margin:0 0 20px 0;font-size:15px;line-height:1.55;color:${MUTED};">
    ${subtitle}
  </p>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 28px auto;">
    <tr>
      <td align="center" style="background:#FFF8F0;border-radius:14px;padding:12px 22px;">
        <span style="color:${NAVY};font-size:14px;font-weight:700;">Statut :</span>
        <span style="color:${badgeColor};font-size:14px;font-weight:700;"> ${badgeText}</span>
      </td>
    </tr>
  </table>

  ${documentsVerifiedBlock}

  ${featuresBlock}

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 28px auto;">
    <tr>
      <td align="center" bgcolor="${HEADER_ORANGE}" style="background-color:${HEADER_ORANGE};border-radius:12px;mso-padding-alt:15px 28px;">
        <a href="${dashboardUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:15px 28px;font-size:15px;font-weight:700;color:#ffffff !important;text-decoration:none;border-radius:12px;background-color:${HEADER_ORANGE};">
          ${escapeHtml(ctaLabel)}
        </a>
      </td>
    </tr>
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
    <tr>
      <td style="background:#F1F5F9;border-radius:12px;padding:16px 18px;font-size:13px;line-height:1.55;color:${MUTED};text-align:left;">
        <strong style="color:${NAVY};">Besoin d'aide ?</strong>
        Contactez-nous à
        <a href="mailto:${escapeHtml(supportEmail)}" style="color:${HEADER_ORANGE};text-decoration:none;font-weight:700;">${escapeHtml(supportEmail)}</a>
      </td>
    </tr>
  </table>

  <p style="margin:0 0 8px 0;font-size:14px;line-height:1.5;color:${MUTED};">
    Merci de faire confiance à <strong style="color:${HEADER_ORANGE};">${escapeHtml(brandName)}.</strong>
  </p>

</td>
</tr>

<tr>
<td style="background:#ffffff;padding:8px 32px 28px 32px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #E2E8F0;">
    <tr>
      <td align="center" style="padding-top:20px;font-size:12px;line-height:1.5;color:#94A3B8;">
        © ${new Date().getFullYear()} ${escapeHtml(brandName)}. Tous droits réservés.
      </td>
    </tr>
  </table>
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

export default kycStatusMail;
