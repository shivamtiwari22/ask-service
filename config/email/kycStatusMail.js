const kycStatusMail = async ({ name, status, statusLabel }) => {
  const statusColor =
    status === "ACTIVE"
      ? "#16a34a"
      : status === "REJECTED"
        ? "#dc2626"
        : "#ca8a04";

  const extraMessage =
    status === "ACTIVE"
      ? "Votre compte est maintenant vérifié. Vous pouvez accéder aux prospects et envoyer des devis."
      : status === "REJECTED"
        ? "Votre vérification a été refusée. Veuillez vérifier vos documents et les soumettre à nouveau si nécessaire."
        : "Votre dossier est en cours d'examen. Nous vous informerons dès qu'une décision sera prise.";

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Mise à jour du statut KYC</title>
</head>

<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 5px 20px rgba(0,0,0,0.08);">

<tr>
<td style="background:#4f46e5;color:#ffffff;text-align:center;padding:20px;font-size:22px;font-weight:bold;">
Ask Service
</td>
</tr>

<tr>
<td style="padding:40px;text-align:center;color:#333;">

<h2 style="margin-top:0;">Mise à jour de votre statut de vérification</h2>

<p style="font-size:15px;color:#666;line-height:1.6;">
Bonjour ${name || "Prestataire"},<br><br>
Le statut KYC de votre compte prestataire a été mis à jour par notre équipe.
</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#f9fafb;border-radius:8px;">
<tr>
<td style="padding:20px;text-align:left;">
<p style="margin:0;font-size:14px;color:#666;">
<strong>Nouveau statut :</strong>
<span style="color:${statusColor};font-weight:bold;">${statusLabel}</span>
</p>
</td>
</tr>
</table>

<p style="font-size:14px;color:#666;line-height:1.6;">
${extraMessage}
</p>

<p style="font-size:14px;color:#666;line-height:1.6;">
Connectez-vous à votre espace prestataire pour plus de détails.
</p>

</td>
</tr>

<tr>
<td style="background:#f9fafb;text-align:center;padding:20px;font-size:13px;color:#888;">
Besoin d'aide ? Contactez-nous
<br><br>
© 2026 Ask Service. Tous droits reserves.
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
