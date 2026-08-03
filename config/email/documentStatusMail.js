import Global from "../../src/models/GlobalModel.js";

const HEADER_ORANGE = "#f59e0b";

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

const documentStatusMail = async ({
  name,
  documentName,
  status,
  statusLabel,
}) => {
  const global = await Global.findOne().select(
    "logo platformName marketplace_name email vendor_logo",
  );
  const brandName =
    global?.platformName || global?.marketplace_name || "Ask Service";
  const supportEmail = global?.email || "contact@askservice.fr";
  const displayName = name || "Prestataire";
  const docName = documentName || "votre document";
  const dashboardUrl = getDashboardUrl();

  const headerLogoUrl =
    getVendorHeaderLogoUrl() ||
    resolveLogoUrl(global?.vendor_logo) ||
    resolveLogoUrl(global?.logo);

  const headerLogo = headerLogoUrl
    ? `<img src="${headerLogoUrl}" alt="${brandName}" width="140" style="max-height:56px;max-width:160px;width:auto;height:auto;display:block;margin:0 auto;border:0;" />`
    : `<div style="color:#ffffff;font-size:22px;font-weight:700;">${brandName}</div>`;

  const statusColor =
    status === "Verified"
      ? "#16a34a"
      : status === "Rejected"
        ? "#dc2626"
        : HEADER_ORANGE;

  const title =
    status === "Verified"
      ? "Bonne nouvelle concernant votre document ! 🎉"
      : status === "Rejected"
        ? "Mise à jour sur l'un de vos documents"
        : "Nous avons bien reçu votre document";

  const intro =
    status === "Verified"
      ? `Super nouvelle, <strong style="color:${HEADER_ORANGE};">${displayName}</strong> !<br><br>Votre document <strong>${docName}</strong> a été vérifié avec succès. Vous êtes un pas plus près d'activer pleinement votre compte prestataire.`
      : status === "Rejected"
        ? `Bonjour <strong style="color:${HEADER_ORANGE};">${displayName}</strong>,<br><br>Votre document <strong>${docName}</strong> n'a malheureusement pas pu être validé. Pas de souci — jetez-y un œil, corrigez ce qu'il faut, et renvoyez-le-nous. On s'occupe du reste !`
        : `Bonjour <strong style="color:${HEADER_ORANGE};">${displayName}</strong>,<br><br>Merci ! Votre document <strong>${docName}</strong> est bien en cours d'examen. Nous vous tiendrons informé dès qu'il y aura du nouveau.`;

  const ctaLabel =
    status === "Verified"
      ? "Accéder à mon tableau de bord"
      : status === "Rejected"
        ? "Mettre à jour mes documents"
        : "Voir mes documents";

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Mise à jour du document</title>
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
<td align="center" style="padding:36px 36px 16px 36px;color:#333;">

<h1 style="margin:0 0 18px 0;font-size:24px;line-height:1.3;color:#0F172A;font-weight:700;">
${title}
</h1>

<p style="margin:0 0 22px 0;font-size:15px;line-height:1.7;color:#475569;text-align:left;">
${intro}
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px 0;">
<tr>
<td style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:18px 20px;text-align:left;">
<p style="margin:0 0 10px;font-size:14px;color:#64748B;">
<strong style="color:#0F172A;">Document :</strong> ${docName}
</p>
<p style="margin:0;font-size:14px;color:#64748B;">
<strong style="color:#0F172A;">Nouveau statut :</strong>
<span style="color:${statusColor};font-weight:700;">${statusLabel || status}</span>
</p>
</td>
</tr>
</table>

<!-- CTA -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 12px auto;">
<tr>
<td align="center" bgcolor="${HEADER_ORANGE}" style="background-color:${HEADER_ORANGE};border-radius:10px;mso-padding-alt:14px 28px;">
<a href="${dashboardUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff !important;text-decoration:none;border-radius:10px;background-color:${HEADER_ORANGE};">
${ctaLabel}
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
<a href="mailto:${supportEmail}" style="color:${HEADER_ORANGE};text-decoration:none;font-weight:600;">${supportEmail}</a>
<br><br>
<span style="color:#A8A29E;">© 2026 ${brandName}. Tous droits réservés.</span>
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

export default documentStatusMail;
