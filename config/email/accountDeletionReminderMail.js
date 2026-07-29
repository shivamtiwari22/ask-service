const accountDeletionReminderMail = async ({ name, daysLeft = 7 }) => {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Rappel de suppression de compte</title>
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

<h2 style="margin-top:0;">Votre compte sera supprimé bientôt</h2>

<p style="font-size:15px;color:#666;line-height:1.6;">
Bonjour ${name || "Utilisateur"},<br><br>
Vous avez demandé la suppression de votre compte Ask Service.
</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#fff7ed;border-radius:8px;border:1px solid #fed7aa;">
<tr>
<td style="padding:20px;text-align:left;">
<p style="margin:0;font-size:15px;color:#9a3412;line-height:1.6;">
<strong>Votre compte sera définitivement désactivé dans ${daysLeft} jours</strong> si vous ne vous reconnectez pas.
</p>
</td>
</tr>
</table>

<p style="font-size:14px;color:#666;line-height:1.6;">
Pour annuler la suppression et conserver votre compte, connectez-vous simplement avant la fin du délai.
</p>

<p style="font-size:14px;color:#666;line-height:1.6;">
Si vous ignorez cet e-mail, votre compte et vos données associées seront définitivement supprimés.
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

export default accountDeletionReminderMail;
