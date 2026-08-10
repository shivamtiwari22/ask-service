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

const contactUsMail = async ({ name, email, message, submittedAt }) => {
  const global = await Global.findOne().select(
    "logo platformName marketplace_name email",
  );
  const brandName =
    global?.platformName || global?.marketplace_name || "Ask Service";
  const supportEmail = global?.email || process.env.EMAIL_FROM || "";

  const safeName = escapeHtml(name || "—");
  const safeEmail = escapeHtml(email || "—");
  const safeMessage = escapeHtml(message || "—").replace(/\n/g, "<br>");
  const safeSubmittedAt = escapeHtml(submittedAt || new Date().toLocaleString());

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
<title>Nouveau message Contact Us</title>
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

<h1 style="margin:0 0 10px 0;font-size:24px;line-height:1.3;color:#0F172A;font-weight:700;">
Nouveau message Contact Us
</h1>

<p style="margin:0 0 24px 0;font-size:15px;line-height:1.7;color:#475569;">
Un utilisateur a soumis le formulaire de contact sur ${escapeHtml(brandName)}.
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
<tr>
<td style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:18px 20px;text-align:left;">
  <p style="margin:0 0 12px;font-size:14px;color:#64748B;">
    <strong style="color:#0F172A;">Nom :</strong> ${safeName}
  </p>
  <p style="margin:0 0 12px;font-size:14px;color:#64748B;">
    <strong style="color:#0F172A;">Email :</strong>
    <a href="mailto:${safeEmail}" style="color:${HEADER_ORANGE};text-decoration:none;font-weight:600;">${safeEmail}</a>
  </p>
  <p style="margin:0;font-size:14px;color:#64748B;">
    <strong style="color:#0F172A;">Date :</strong> ${safeSubmittedAt}
  </p>
</td>
</tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0;">
<tr>
<td style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:18px 20px;text-align:left;">
  <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#0F172A;text-transform:uppercase;letter-spacing:0.04em;">
    Message
  </p>
  <p style="margin:0;font-size:15px;line-height:1.7;color:#334155;">
    ${safeMessage}
  </p>
</td>
</tr>
</table>

<p style="margin:18px 0 0 0;font-size:13px;line-height:1.5;color:#94A3B8;">
Vous pouvez répondre directement à cet e-mail pour contacter l'utilisateur.
</p>

</td>
</tr>

<tr>
<td style="background:#FFFBEB;text-align:center;padding:22px 28px;font-size:13px;color:#92400E;">
Contact plateforme :
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

export default contactUsMail;
