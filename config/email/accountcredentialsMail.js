const accountCredentialsMail = async (name, email, password) => {
  return `
      <!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Vos identifiants de compte</title>
</head>

<body style="margin:0;padding:0;background:#f2f4f7;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellspacing="0" cellpadding="0" style="padding:40px 0;background:#f2f4f7;">
<tr>
<td align="center">

<table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,0.08);">

<!-- Logo / Header -->
<tr>
<td style="padding:25px 30px;text-align:center;border-bottom:1px solid #f0f0f0;">
<h2 style="margin:0;color:#4f46e5;font-weight:700;">Ask Service</h2>
</td>
</tr>

<!-- Hero Section -->
<tr>
<td style="padding:35px 40px;text-align:center;">
<h2 style="margin:0;color:#111;font-size:24px;">Bienvenue, ${name} 👋</h2>
<p style="color:#666;font-size:15px;margin-top:10px;">
Votre compte a ete cree avec succes. Voici vos identifiants de connexion.
</p>
</td>
</tr>

<!-- Credentials Box -->
<tr>
<td style="padding:0 40px 10px 40px;">

<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;">

<tr style="background:#fafafa;">
<td style="padding:14px 16px;font-weight:600;color:#333;width:140px;">Email</td>
<td style="padding:14px 16px;color:#555;">${email}</td>
</tr>

<tr>
<td style="padding:14px 16px;font-weight:600;color:#333;">Mot de passe</td>
<td style="padding:14px 16px;color:#555;">${password}</td>
</tr>



</table>

</td>
</tr>

<!-- Button -->
<tr>
<td style="text-align:center;padding:35px 40px;">
<a href="https://ask-service.vercel.app/"
style="background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:600;font-size:15px;display:inline-block;">
Se connecter a votre compte
</a>
</td>
</tr>

<!-- Security Note -->
<tr>
<td style="padding:0 40px 30px 40px;color:#666;font-size:14px;line-height:1.6;text-align:center;">
Pour des raisons de securite, nous vous recommandons de changer votre mot de passe apres votre premiere connexion.
Si vous n'avez pas demande ce compte, veuillez contacter notre equipe support.
</td>
</tr>

<!-- Divider -->
<tr>
<td style="border-top:1px solid #f0f0f0;"></td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:25px 40px;text-align:center;font-size:13px;color:#888;line-height:1.6;">



<p style="margin-top:15px;">© Ask Service. Tous droits reserves.</p>

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

export default accountCredentialsMail;
