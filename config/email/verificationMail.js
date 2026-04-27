const verificationMail = async (name, otp) => {
  return `
    <!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Verification du code</title>
</head>

<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 5px 20px rgba(0,0,0,0.08);">

<!-- Header -->

<tr>
<td style="background:#4f46e5;color:#ffffff;text-align:center;padding:20px;font-size:22px;font-weight:bold;">
Ask Service
</td>
</tr>

<!-- Content -->
<tr>
<td style="padding:40px;text-align:center;color:#333;">

<h2 style="margin-top:0;">Code de verification</h2>

<p style="font-size:15px;color:#666;line-height:1.6;">
Bonjour ${name},<br>
Votre code de verification est ${otp}. Saisissez-le pour verifier votre e-mail.
</p>



</td>
</tr>

<!-- Footer -->
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

export default verificationMail;
