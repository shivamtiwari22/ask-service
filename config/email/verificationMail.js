const verificationMail = async (name,otp) => {
  return `
    <!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Code Verification</title>
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

<h2 style="margin-top:0;"> Verification Code</h2>

<p style="font-size:15px;color:#666;line-height:1.6;">
Hello ${name},<br>
Use the One Time Password below to complete your verification.
</p>

<!-- OTP Box -->
<div style="margin:30px 0;">
<span style="
display:inline-block;
font-size:32px;
letter-spacing:6px;
font-weight:bold;
color:#4f46e5;
background:#f5f7ff;
padding:14px 30px;
border-radius:8px;
border:1px dashed #4f46e5;
">
${otp}
</span>
</div>



<p style="font-size:13px;color:#999;margin-top:25px;">
If you did not request this verification, you can safely ignore this email.
</p>

</td>
</tr>

<!-- Footer -->
<tr>
<td style="background:#f9fafb;text-align:center;padding:20px;font-size:13px;color:#888;">
Need help? Contact us 
<br><br>

© 2026 Ask Service. All rights reserved.
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


export default verificationMail