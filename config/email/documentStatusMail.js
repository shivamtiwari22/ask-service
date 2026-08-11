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

const getBrandContext = async () => {
  const global = await Global.findOne().select(
    "logo platformName marketplace_name email vendor_logo",
  );
  const brandName =
    global?.platformName || global?.marketplace_name || "Ask Service";
  const supportEmail = global?.email || "contact@askservice.fr";
  const headerLogoUrl =
    getVendorHeaderLogoUrl() ||
    resolveLogoUrl(global?.vendor_logo) ||
    resolveLogoUrl(global?.logo);
  const headerLogo = headerLogoUrl
    ? `<img src="${headerLogoUrl}" alt="${escapeHtml(brandName)}" width="140" style="max-height:56px;max-width:160px;width:auto;height:auto;display:block;margin:0 auto;border:0;" />`
    : `<div style="color:#ffffff;font-size:22px;font-weight:700;">${escapeHtml(brandName)}</div>`;

  return { brandName, supportEmail, headerLogo, dashboardUrl: getDashboardUrl() };
};

const wrapMail = ({
  brandName,
  supportEmail,
  headerLogo,
  dashboardUrl,
  title,
  introHtml,
  detailsHtml,
  ctaLabel,
}) => `
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

<h1 style="margin:0 0 18px 0;font-size:24px;line-height:1.3;color:#0F172A;font-weight:700;">
${escapeHtml(title)}
</h1>

<p style="margin:0 0 22px 0;font-size:15px;line-height:1.7;color:#475569;">
${introHtml}
</p>

${detailsHtml || ""}

<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 12px auto;">
<tr>
<td align="center" bgcolor="${HEADER_ORANGE}" style="background-color:${HEADER_ORANGE};border-radius:10px;mso-padding-alt:14px 28px;">
<a href="${dashboardUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff !important;text-decoration:none;border-radius:10px;background-color:${HEADER_ORANGE};">
${escapeHtml(ctaLabel)}
</a>
</td>
</tr>
</table>

<p style="margin:18px 0 0 0;font-size:13px;line-height:1.5;color:#94A3B8;">
Si le bouton ne fonctionne pas, ouvrez ce lien :<br>
<a href="${dashboardUrl}" target="_blank" rel="noopener noreferrer" style="color:${HEADER_ORANGE};word-break:break-all;">${dashboardUrl}</a>
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

/**
 * Sent once when every required document has been verified.
 */
export const documentsAllVerifiedMail = async ({ name }) => {
  const ctx = await getBrandContext();
  const displayName = escapeHtml(name || "Prestataire");

  return wrapMail({
    ...ctx,
    title: "Documents validés",
    introHtml: `Bonjour <strong style="color:${HEADER_ORANGE};">${displayName}</strong>,<br><br>
Tous vos documents requis ont été vérifiés avec succès. Votre dossier est désormais complet — vous pouvez accéder à votre espace prestataire et poursuivre vos démarches.`,
    detailsHtml: `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px 0;">
<tr>
<td style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:12px;padding:18px 20px;text-align:left;">
<p style="margin:0;font-size:14px;line-height:1.6;color:#065F46;">
Tous les documents obligatoires de votre dossier ont été validés.
</p>
</td>
</tr>
</table>
`,
    ctaLabel: "Accéder à mon espace prestataire",
  });
};

/**
 * Sent once on rejection — lists each incorrect document and its issue.
 * @param {{ name: string, rejectedDocuments: Array<{ name: string, reason?: string }> }}
 */
export const documentsRejectedMail = async ({ name, rejectedDocuments = [] }) => {
  const ctx = await getBrandContext();
  const displayName = escapeHtml(name || "Prestataire");

  const rows = (rejectedDocuments.length
    ? rejectedDocuments
    : [{ name: "Document", reason: "Document non conforme" }]
  )
    .map((item) => {
      const docName = escapeHtml(item.name || "Document");
      const reason = escapeHtml(
        item.reason || "Document non conforme — merci de le corriger et de le renvoyer.",
      );
      return `
<tr>
<td style="padding:14px 0;border-bottom:1px solid #FDE68A;">
  <p style="margin:0 0 6px;font-size:14px;color:#0F172A;font-weight:700;">
    ${docName}
  </p>
  <p style="margin:0;font-size:14px;line-height:1.6;color:#64748B;">
    <strong style="color:#0F172A;">Problème :</strong> ${reason}
  </p>
</td>
</tr>`;
    })
    .join("");

  return wrapMail({
    ...ctx,
    title: "Documents à corriger",
    introHtml: `Bonjour <strong style="color:${HEADER_ORANGE};">${displayName}</strong>,<br><br>
Certains de vos documents n'ont pas pu être validés. Voici le détail des documents concernés et du problème constaté. Merci de les corriger et de les renvoyer.`,
    detailsHtml: `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px 0;">
<tr>
<td style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:8px 20px 4px 20px;text-align:left;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${rows}
</table>
</td>
</tr>
</table>
`,
    ctaLabel: "Mettre à jour mes documents",
  });
};

/** @deprecated Prefer documentsAllVerifiedMail / documentsRejectedMail */
const documentStatusMail = async ({
  name,
  documentName,
  status,
  statusLabel,
  rejectedDocuments,
}) => {
  if (status === "Rejected") {
    return documentsRejectedMail({
      name,
      rejectedDocuments: rejectedDocuments?.length
        ? rejectedDocuments
        : [{ name: documentName, reason: statusLabel }],
    });
  }
  return documentsAllVerifiedMail({ name });
};

export default documentStatusMail;
