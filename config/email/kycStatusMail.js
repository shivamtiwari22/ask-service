import Global from "../../src/models/GlobalModel.js";

const HEADER_ORANGE = "#F5A623";
const ORANGE_DARK = "#E8940F";
const NAVY = "#0F1B33";
const GREEN = "#22C55E";
const MUTED = "#64748B";

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

const iconCircle = (inner, bg = "#FFF4E5") => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 12px auto;">
  <tr>
    <td align="center" valign="middle" width="58" height="58" style="width:58px;height:58px;background:${bg};border-radius:50%;text-align:center;vertical-align:middle;font-size:24px;line-height:58px;">
      ${inner}
    </td>
  </tr>
</table>
`;

const kycStatusMail = async ({ name, status, statusLabel }) => {
  const global = await Global.findOne().select(
    "logo platformName marketplace_name email vendor_logo",
  );
  const brandName =
    global?.platformName || global?.marketplace_name || "Ask Service";
  const supportEmail = global?.email || "contact@askservice.fr";
  const displayName = name || "Prestataire";
  const dashboardUrl = getDashboardUrl();

  const headerLogoUrl =
    getVendorHeaderLogoUrl() ||
    resolveLogoUrl(global?.vendor_logo) ||
    resolveLogoUrl(global?.logo);

  const headerLogo = headerLogoUrl
    ? `<img src="${headerLogoUrl}" alt="${brandName}" width="120" style="max-height:64px;max-width:150px;width:auto;height:auto;display:block;margin:0 auto;border:0;" />`
    : `<div style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">${brandName}</div>`;

  const isActive = status === "ACTIVE";
  const isRejected = status === "REJECTED";

  const heroIcon = isActive
    ? "✓"
    : isRejected
      ? "!"
      : "…";
  const heroIconBg = isActive
    ? HEADER_ORANGE
    : isRejected
      ? "#DC2626"
      : "#F59E0B";

  const title = isActive
    ? "Félicitations !"
    : isRejected
      ? "Mise à jour concernant votre vérification"
      : "Votre dossier est en cours d'examen";

  const subtitle = isActive
    ? `Votre compte prestataire est désormais <strong style="color:${HEADER_ORANGE};">vérifié.</strong>`
    : isRejected
      ? `Bonjour <strong>${displayName}</strong>, votre vérification n'a malheureusement pas pu être validée pour le moment.`
      : `Bonjour <strong>${displayName}</strong>, votre dossier KYC est actuellement en cours d'examen.`;

  const badgeText = isActive
    ? "Prestataire vérifié"
    : statusLabel || status;
  const badgeColor = isActive ? GREEN : isRejected ? "#DC2626" : HEADER_ORANGE;
  const badgeIcon = isActive ? "✓" : isRejected ? "✕" : "•";

  const ctaLabel = isActive
    ? "Accéder à mon espace prestataire →"
    : isRejected
      ? "Mettre à jour mes documents →"
      : "Voir mon espace prestataire →";

  const featuresBlock = isActive
    ? `
<!-- Features -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
  <tr>
    <td align="center" style="padding:0 0 18px 0;font-size:15px;font-weight:700;color:${NAVY};">
      Ce que vous pouvez faire dès maintenant :
    </td>
  </tr>
  <tr>
    <td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="33%" align="center" valign="top" style="padding:0 8px;">
            ${iconCircle("👥")}
            <p style="margin:0;font-size:12px;line-height:1.45;color:${MUTED};font-weight:600;">
              Consulter les prospects disponibles
            </p>
          </td>
          <td width="33%" align="center" valign="top" style="padding:0 8px;">
            ${iconCircle("💶")}
            <p style="margin:0;font-size:12px;line-height:1.45;color:${MUTED};font-weight:600;">
              Débloquer des leads et envoyer des devis
            </p>
          </td>
          <td width="33%" align="center" valign="top" style="padding:0 8px;">
            ${iconCircle("⭐")}
            <p style="margin:0;font-size:12px;line-height:1.45;color:${MUTED};font-weight:600;">
              Développer votre réputation
            </p>
          </td>
        </tr>
      </table>
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
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F4F6;padding:28px 12px;">
<tr>
<td align="center">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 28px rgba(15,23,42,0.08);">

<!-- ========== HEADER ========== -->
<tr>
<td align="center" bgcolor="${HEADER_ORANGE}" style="background-color:${HEADER_ORANGE};background-image:radial-gradient(circle at 20% 30%, rgba(255,255,255,0.14) 0%, transparent 40%),radial-gradient(circle at 80% 70%, rgba(255,255,255,0.10) 0%, transparent 45%);padding:36px 24px 48px 24px;">
  ${headerLogo}
</td>
</tr>

<!-- Curve transition -->
<tr>
<td bgcolor="${HEADER_ORANGE}" style="background-color:${HEADER_ORANGE};padding:0;line-height:0;font-size:0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="background:#ffffff;border-radius:40px 40px 0 0;height:28px;line-height:28px;font-size:0;">&nbsp;</td>
    </tr>
  </table>
</td>
</tr>

<!-- ========== HERO ========== -->
<tr>
<td align="center" style="background:#ffffff;padding:0 32px 8px 32px;">

  <!-- Success / status icon -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:-42px auto 18px auto;">
    <tr>
      <td align="center" style="position:relative;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
          <tr>
            <td align="center" width="96" height="96" style="width:96px;height:96px;background:#FFF3E0;border-radius:50%;text-align:center;vertical-align:middle;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                <tr>
                  <td align="center" width="64" height="64" bgcolor="${heroIconBg}" style="width:64px;height:64px;background-color:${heroIconBg};border-radius:50%;text-align:center;vertical-align:middle;color:#ffffff;font-size:32px;font-weight:700;line-height:64px;">
                    ${heroIcon}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <h1 style="margin:0 0 10px 0;font-size:28px;line-height:1.25;color:${NAVY};font-weight:800;">
    ${title}
  </h1>

  <p style="margin:0 0 20px 0;font-size:15px;line-height:1.55;color:${MUTED};">
    ${subtitle}
  </p>

  <!-- Status badge -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 28px auto;">
    <tr>
      <td align="center" style="background:#FFF8F0;border-radius:14px;padding:12px 22px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" valign="middle" width="22" height="22" bgcolor="${badgeColor}" style="width:22px;height:22px;background-color:${badgeColor};border-radius:50%;color:#ffffff;font-size:12px;font-weight:700;line-height:22px;text-align:center;">
              ${badgeIcon}
            </td>
            <td width="10" style="font-size:0;line-height:0;">&nbsp;</td>
            <td valign="middle" style="font-size:14px;line-height:1.3;font-weight:700;">
              <span style="color:${NAVY};">Statut :</span>
              <span style="color:${badgeColor};"> ${badgeText}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  ${featuresBlock}

  <!-- CTA -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 28px auto;">
    <tr>
      <td align="center" bgcolor="${HEADER_ORANGE}" style="background-color:${HEADER_ORANGE};border-radius:12px;mso-padding-alt:15px 28px;">
        <a href="${dashboardUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:15px 28px;font-size:15px;font-weight:700;color:#ffffff !important;text-decoration:none;border-radius:12px;background-color:${HEADER_ORANGE};">
          ${ctaLabel}
        </a>
      </td>
    </tr>
  </table>

  <!-- Help box -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
    <tr>
      <td style="background:#F1F5F9;border-radius:12px;padding:16px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="40" valign="middle" align="center" style="padding-right:12px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" width="36" height="36" style="width:36px;height:36px;background:#FFE8C2;border-radius:50%;color:${ORANGE_DARK};font-size:18px;line-height:36px;text-align:center;">
                    ☎
                  </td>
                </tr>
              </table>
            </td>
            <td valign="middle" align="left" style="font-size:13px;line-height:1.55;color:${MUTED};">
              <strong style="color:${NAVY};">Besoin d'aide ?</strong>
              Contactez-nous à
              <a href="mailto:${supportEmail}" style="color:${HEADER_ORANGE};text-decoration:none;font-weight:700;">${supportEmail}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <p style="margin:0 0 8px 0;font-size:14px;line-height:1.5;color:${MUTED};">
    Merci de faire confiance à <strong style="color:${HEADER_ORANGE};">${brandName}.</strong>
  </p>

</td>
</tr>

<!-- ========== FOOTER ========== -->
<tr>
<td style="background:#ffffff;padding:8px 32px 28px 32px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #E2E8F0;">
    <tr>
      <td align="center" style="padding-top:20px;font-size:12px;line-height:1.5;color:#94A3B8;">
        © 2026 ${brandName}. Tous droits réservés.
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
