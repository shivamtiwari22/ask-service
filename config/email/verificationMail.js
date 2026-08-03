import Global from "../../src/models/GlobalModel.js";

const resolveLogoUrl = (logo) => {
  if (!logo) return null;
  const value = String(logo);
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const base = process.env.IMAGE_URL || process.env.BASE_URL || "";
  return `${base}${value.startsWith("/") ? value : `/${value}`}`;
};

/** White logo for blue (#1B4FFF) email headers — served from public/white-logo.png */
const getClientHeaderLogoUrl = () => {
  const base = (process.env.BASE_URL || process.env.IMAGE_URL || "").replace(
    /\/$/,
    "",
  );
  if (!base) return null;
  return `${base}/white-logo.png`;
};

const verificationMail = async (name, otp) => {
  const global = await Global.findOne().select(
    "logo platformName marketplace_name email",
  );
  const brandName =
    global?.platformName || global?.marketplace_name || "Ask Service";
  const supportEmail = global?.email || "contact@askservice.fr";
  const displayName = name || "Utilisateur";

  const headerLogoUrl = getClientHeaderLogoUrl() || resolveLogoUrl(global?.logo);
  const footerLogoUrl = resolveLogoUrl(global?.logo) || getClientHeaderLogoUrl();

  const headerLogo = headerLogoUrl
    ? `<img src="${headerLogoUrl}" alt="${brandName}" width="140" style="max-height:64px;max-width:160px;width:auto;height:auto;display:block;margin:0 auto;border:0;outline:none;text-decoration:none;" />`
    : `<div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">${brandName}</div>`;

  const footerLogo = footerLogoUrl
    ? `<img src="${footerLogoUrl}" alt="${brandName}" width="100" style="max-height:32px;max-width:120px;width:auto;height:auto;display:inline-block;border:0;outline:none;text-decoration:none;vertical-align:middle;" />`
    : `<span style="color:#1B4FFF;font-size:14px;font-weight:700;vertical-align:middle;">${brandName}</span>`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Code de vérification</title>
</head>
<body style="margin:0;padding:0;background:#E8EEF8;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<!-- Preheader (hidden) -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
Votre code de vérification ${brandName} : ${otp}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#E8EEF8;padding:40px 16px;">
<tr>
<td align="center">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(27,79,255,0.12);">

<!-- ========== HEADER ========== -->
<tr>
<td align="center" style="background:#1B4FFF;padding:40px 28px 32px 28px;">
  ${headerLogo}
</td>
</tr>

<!-- Soft curve under header -->
<tr>
<td style="background:#1B4FFF;line-height:0;font-size:0;height:18px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="background:#ffffff;border-radius:22px 22px 0 0;height:18px;line-height:18px;font-size:0;">&nbsp;</td>
    </tr>
  </table>
</td>
</tr>

<!-- ========== ICON (clearly inside white body, not stuck to header) ========== -->
<tr>
<td align="center" style="background:#ffffff;padding:8px 28px 0 28px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
    <tr>
      <td align="center" width="72" height="72" style="width:72px;height:72px;background:#F0F5FF;border:2px solid #1B4FFF;border-radius:50%;text-align:center;vertical-align:middle;">
        <span style="display:inline-block;font-size:28px;line-height:72px;color:#1B4FFF;">✉️</span>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- ========== BODY ========== -->
<tr>
<td align="center" style="background:#ffffff;padding:20px 40px 12px 40px;">

  <h1 style="margin:0 0 10px 0;font-size:26px;line-height:1.25;color:#0B1B3D;font-weight:700;">
    Code de vérification
  </h1>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 28px auto;">
    <tr>
      <td style="width:56px;height:4px;background:#1B4FFF;border-radius:4px;font-size:0;line-height:0;">&nbsp;</td>
    </tr>
  </table>

  <p style="margin:0 0 6px 0;font-size:17px;line-height:1.5;color:#334155;">
    Bonjour <span style="color:#1B4FFF;font-weight:700;">${displayName}</span>,
  </p>

  <p style="margin:0 0 22px 0;font-size:15px;line-height:1.6;color:#64748B;">
    Votre code de vérification est :
  </p>

  <!-- OTP BOX -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
    <tr>
      <td align="center" style="background:#F0F5FF;border:1px solid #D6E2FF;border-radius:14px;padding:26px 18px;">
        <span style="display:inline-block;font-size:40px;letter-spacing:12px;font-weight:700;color:#1B4FFF;line-height:1;font-family:Arial,Helvetica,sans-serif;">
          ${otp}
        </span>
      </td>
    </tr>
  </table>

  <p style="margin:0 0 28px 0;font-size:15px;line-height:1.65;color:#475569;max-width:460px;">
    Saisissez-le pour vérifier votre e-mail et accéder à votre compte
    <span style="color:#1B4FFF;font-weight:700;">${brandName}</span>.
  </p>

  <!-- SECURITY NOTICE -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px 0;">
    <tr>
      <td style="background:#F7F9FC;border:1px solid #E8EEF8;border-radius:14px;padding:18px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="40" valign="top" style="padding-right:14px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" width="36" height="36" style="width:36px;height:36px;background:#EEF3FF;border-radius:50%;text-align:center;vertical-align:middle;font-size:16px;line-height:36px;">
                    🔒
                  </td>
                </tr>
              </table>
            </td>
            <td valign="middle" style="font-size:13px;line-height:1.6;color:#64748B;text-align:left;">
              <strong style="color:#0B1B3D;display:block;margin-bottom:2px;">Ce code est valable pendant 15 minutes.</strong>
              Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

</td>
</tr>

<!-- ========== FOOTER ========== -->
<tr>
<td style="background:#ffffff;padding:8px 40px 36px 40px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #E8EEF8;">
    <tr>
      <td style="padding-top:28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="left" valign="middle" width="38%" style="padding-right:14px;">
              ${footerLogo}
            </td>
            <td width="2%" align="center" valign="middle" style="border-left:1px solid #D0D7E5;font-size:0;line-height:0;">&nbsp;</td>
            <td align="left" valign="middle" width="60%" style="padding-left:16px;font-size:13px;line-height:1.55;color:#64748B;">
              <strong style="color:#0B1B3D;">Besoin d'aide ?</strong><br />
              Contactez-nous à
              <a href="mailto:${supportEmail}" style="color:#1B4FFF;text-decoration:none;font-weight:600;">${supportEmail}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-top:24px;font-size:12px;line-height:1.4;color:#94A3B8;">
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

export default verificationMail;
