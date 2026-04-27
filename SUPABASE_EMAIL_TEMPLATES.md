# FixRight — Supabase Email Templates

Go to: Supabase Dashboard → Authentication → Email Templates
Replace each template with the HTML below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 1. CONFIRM SIGNUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Subject line:
  Confirm your FixRight account

HTML Body:
---
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Confirm your FixRight account</title>
</head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:40px 20px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

      <!-- HEADER -->
      <tr><td style="background:#1c2b3a;border-radius:12px 12px 0 0;padding:28px 36px;text-align:center;">
        <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr>
            <td style="width:28px;height:28px;background:#b5451b;clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);border-radius:2px;"></td>
            <td style="padding-left:10px;font-family:Georgia,serif;font-size:22px;color:#f5f0e8;font-weight:700;letter-spacing:0.02em;">FixRight</td>
          </tr>
        </table>
      </td></tr>

      <!-- BODY -->
      <tr><td style="background:#faf7f0;padding:40px 36px 32px;border-left:1px solid #d8cebf;border-right:1px solid #d8cebf;">
        <h1 style="font-family:Georgia,serif;font-size:26px;color:#1c2b3a;margin:0 0 12px;font-weight:700;">Confirm your account</h1>
        <p style="font-size:15px;color:#7a8a95;line-height:1.7;margin:0 0 28px;">You're one step away from getting instant AI-powered home repair estimates. Click below to confirm your email and get started.</p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
          <tr><td style="background:#b5451b;border-radius:10px;">
            <a href="{{ .ConfirmationURL }}" style="display:block;padding:14px 32px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;font-family:Georgia,serif;">Confirm my account →</a>
          </td></tr>
        </table>
        <p style="font-size:13px;color:#7a8a95;line-height:1.6;margin:0;">If you didn't create a FixRight account, you can safely ignore this email. This link expires in 24 hours.</p>
      </td></tr>

      <!-- WHAT YOU GET -->
      <tr><td style="background:#ede6d6;padding:24px 36px;border-left:1px solid #d8cebf;border-right:1px solid #d8cebf;">
        <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#b5451b;margin:0 0 14px;">What you can do with FixRight</p>
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="font-size:13px;color:#3a4a56;padding:5px 0;">🔧&nbsp; Get instant cost estimates with a full materials list</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#3a4a56;padding:5px 0;">📷&nbsp; Upload a photo for AI-powered analysis</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#3a4a56;padding:5px 0;">✨&nbsp; Visualize your renovation before you build it</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#3a4a56;padding:5px 0;">💾&nbsp; Save and sync estimates across all your devices</td>
          </tr>
        </table>
      </td></tr>

      <!-- FOOTER -->
      <tr><td style="background:#1c2b3a;border-radius:0 0 12px 12px;padding:20px 36px;text-align:center;">
        <p style="font-size:12px;color:rgba(255,255,255,0.4);margin:0;line-height:1.6;">
          FixRight Inc. · Wilmington, DE, United States<br>
          <a href="https://fixright.app/legal.html" style="color:rgba(255,255,255,0.4);text-decoration:underline;">Privacy Policy</a> &nbsp;·&nbsp;
          <a href="https://fixright.app/legal.html" style="color:rgba(255,255,255,0.4);text-decoration:underline;">Terms</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 2. MAGIC LINK / INVITE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Subject line:
  Your FixRight sign-in link

HTML Body:
---
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:40px 20px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
      <tr><td style="background:#1c2b3a;border-radius:12px 12px 0 0;padding:28px 36px;text-align:center;">
        <table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
          <td style="width:28px;height:28px;background:#b5451b;border-radius:2px;"></td>
          <td style="padding-left:10px;font-family:Georgia,serif;font-size:22px;color:#f5f0e8;font-weight:700;">FixRight</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#faf7f0;padding:40px 36px 32px;border-left:1px solid #d8cebf;border-right:1px solid #d8cebf;">
        <h1 style="font-family:Georgia,serif;font-size:24px;color:#1c2b3a;margin:0 0 12px;">Your sign-in link</h1>
        <p style="font-size:15px;color:#7a8a95;line-height:1.7;margin:0 0 28px;">Click the button below to sign in to your FixRight account. This link expires in 1 hour.</p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
          <tr><td style="background:#b5451b;border-radius:10px;">
            <a href="{{ .ConfirmationURL }}" style="display:block;padding:14px 32px;font-size:16px;font-weight:700;color:#fff;text-decoration:none;font-family:Georgia,serif;">Sign in to FixRight →</a>
          </td></tr>
        </table>
        <p style="font-size:13px;color:#7a8a95;">If you didn't request this, you can safely ignore it.</p>
      </td></tr>
      <tr><td style="background:#1c2b3a;border-radius:0 0 12px 12px;padding:20px 36px;text-align:center;">
        <p style="font-size:12px;color:rgba(255,255,255,0.4);margin:0;">FixRight Inc. · <a href="https://fixright.app/legal.html" style="color:rgba(255,255,255,0.4);">Privacy</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 3. PASSWORD RESET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Subject line:
  Reset your FixRight password

HTML Body:
---
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:40px 20px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
      <tr><td style="background:#1c2b3a;border-radius:12px 12px 0 0;padding:28px 36px;text-align:center;">
        <table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
          <td style="width:28px;height:28px;background:#b5451b;border-radius:2px;"></td>
          <td style="padding-left:10px;font-family:Georgia,serif;font-size:22px;color:#f5f0e8;font-weight:700;">FixRight</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#faf7f0;padding:40px 36px 32px;border-left:1px solid #d8cebf;border-right:1px solid #d8cebf;">
        <h1 style="font-family:Georgia,serif;font-size:24px;color:#1c2b3a;margin:0 0 12px;">Reset your password</h1>
        <p style="font-size:15px;color:#7a8a95;line-height:1.7;margin:0 0 28px;">We received a request to reset your FixRight password. Click below to choose a new one. This link expires in 1 hour.</p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
          <tr><td style="background:#b5451b;border-radius:10px;">
            <a href="{{ .ConfirmationURL }}" style="display:block;padding:14px 32px;font-size:16px;font-weight:700;color:#fff;text-decoration:none;font-family:Georgia,serif;">Reset my password →</a>
          </td></tr>
        </table>
        <p style="font-size:13px;color:#7a8a95;">If you didn't request a password reset, your account is safe — you can ignore this email.</p>
      </td></tr>
      <tr><td style="background:#1c2b3a;border-radius:0 0 12px 12px;padding:20px 36px;text-align:center;">
        <p style="font-size:12px;color:rgba(255,255,255,0.4);margin:0;">FixRight Inc. · <a href="https://fixright.app/legal.html" style="color:rgba(255,255,255,0.4);">Privacy</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ALSO SET THESE IN SUPABASE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Authentication → Settings:
  Site URL:          https://fixright.app  (or your current URL)
  Sender name:       FixRight
  Sender email:      noreply@fixright.app  (or your verified domain)

Authentication → Providers → Google:
  1. Go to console.cloud.google.com
  2. Create a project → APIs & Services → Credentials → OAuth 2.0 Client ID
  3. Authorised redirect URI: https://zciyiltkaunbozoedfcr.supabase.co/auth/v1/callback
  4. Copy Client ID + Secret into Supabase → Google provider
  5. Enable the provider

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
