import nodemailer from "nodemailer";

function createTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return null;
  }
  
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendVerificationEmail(
  to: string,
  code: string,
  type: "signup" | "password_reset" | "login"
): Promise<boolean> {
  const subject = type === "signup" 
    ? "BKApay - Code de verification de votre compte"
    : type === "login"
    ? "BKApay - Code de connexion a votre compte"
    : "BKApay - Code de reinitialisation de mot de passe";

  const textContent = type === "signup"
    ? `BKApay - Verification de votre adresse email

Bonjour,

Merci de vous etre inscrit sur BKApay. Voici votre code de verification :

${code}

Ce code est valable pendant 10 minutes.

Si vous n'avez pas cree de compte, ignorez cet email.

--
BKApay - Votre plateforme de paiement mobile money
https://bkapay.com`
    : type === "login"
    ? `BKApay - Code de connexion

Bonjour,

Une tentative de connexion a ete detectee sur votre compte BKApay. Voici votre code de connexion :

${code}

Ce code est valable pendant 10 minutes.

Si vous n'etes pas a l'origine de cette demande, ignorez cet email et securisez votre compte.

--
BKApay - Votre plateforme de paiement mobile money
https://bkapay.com`
    : `BKApay - Reinitialisation de votre mot de passe

Bonjour,

Vous avez demande la reinitialisation de votre mot de passe. Voici votre code de verification :

${code}

Ce code est valable pendant 10 minutes.

Si vous n'avez pas demande cette reinitialisation, ignorez cet email.

--
BKApay - Votre plateforme de paiement mobile money
https://bkapay.com`;
    
  const loginHtml = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>BKApay - Code de connexion</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f9fafb;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center;">
                    <h1 style="margin: 0; color: #2563eb; font-family: Arial, sans-serif; font-size: 28px; font-weight: bold;">BKApay</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px;">
                    <h2 style="margin: 0 0 20px; color: #1f2937; font-family: Arial, sans-serif; font-size: 20px; text-align: center;">Code de connexion</h2>
                    <p style="margin: 0 0 15px; color: #4b5563; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5;">Bonjour,</p>
                    <p style="margin: 0 0 25px; color: #4b5563; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5;">Une tentative de connexion a ete detectee sur votre compte BKApay. Voici votre code de connexion :</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="background-color: #f3f4f6; padding: 25px; text-align: center; border-radius: 8px;">
                          <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${code}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 25px 40px 40px;">
                    <p style="margin: 0 0 10px; color: #4b5563; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">Ce code est valable pendant <strong>10 minutes</strong>.</p>
                    <p style="margin: 0; color: #6b7280; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">Si vous n'etes pas a l'origine de cette demande, ignorez cet email et securisez votre compte.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #9ca3af; font-family: Arial, sans-serif; font-size: 12px; text-align: center;">
                      BKApay - Votre plateforme de paiement mobile money<br>
                      <a href="https://bkapay.com" style="color: #2563eb; text-decoration: none;">bkapay.com</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

  const htmlContent = type === "signup"
    ? `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>BKApay - Verification</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f9fafb;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center;">
                    <h1 style="margin: 0; color: #2563eb; font-family: Arial, sans-serif; font-size: 28px; font-weight: bold;">BKApay</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px;">
                    <h2 style="margin: 0 0 20px; color: #1f2937; font-family: Arial, sans-serif; font-size: 20px; text-align: center;">Verification de votre adresse email</h2>
                    <p style="margin: 0 0 15px; color: #4b5563; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5;">Bonjour,</p>
                    <p style="margin: 0 0 25px; color: #4b5563; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5;">Merci de vous etre inscrit sur BKApay. Voici votre code de verification :</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="background-color: #f3f4f6; padding: 25px; text-align: center; border-radius: 8px;">
                          <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${code}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 25px 40px 40px;">
                    <p style="margin: 0 0 10px; color: #4b5563; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">Ce code est valable pendant <strong>10 minutes</strong>.</p>
                    <p style="margin: 0; color: #6b7280; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">Si vous n'avez pas cree de compte, ignorez cet email.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #9ca3af; font-family: Arial, sans-serif; font-size: 12px; text-align: center;">
                      BKApay - Votre plateforme de paiement mobile money<br>
                      <a href="https://bkapay.com" style="color: #2563eb; text-decoration: none;">bkapay.com</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
    : type === "login"
    ? loginHtml
    : `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>BKApay - Reinitialisation</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f9fafb;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center;">
                    <h1 style="margin: 0; color: #2563eb; font-family: Arial, sans-serif; font-size: 28px; font-weight: bold;">BKApay</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px;">
                    <h2 style="margin: 0 0 20px; color: #1f2937; font-family: Arial, sans-serif; font-size: 20px; text-align: center;">Reinitialisation de votre mot de passe</h2>
                    <p style="margin: 0 0 15px; color: #4b5563; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5;">Bonjour,</p>
                    <p style="margin: 0 0 25px; color: #4b5563; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5;">Vous avez demande la reinitialisation de votre mot de passe. Voici votre code de verification :</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="background-color: #f3f4f6; padding: 25px; text-align: center; border-radius: 8px;">
                          <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${code}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 25px 40px 40px;">
                    <p style="margin: 0 0 10px; color: #4b5563; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">Ce code est valable pendant <strong>10 minutes</strong>.</p>
                    <p style="margin: 0; color: #6b7280; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">Si vous n'avez pas demande cette reinitialisation, ignorez cet email.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #9ca3af; font-family: Arial, sans-serif; font-size: 12px; text-align: center;">
                      BKApay - Votre plateforme de paiement mobile money<br>
                      <a href="https://bkapay.com" style="color: #2563eb; text-decoration: none;">bkapay.com</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.error("[Email] GMAIL_USER ou GMAIL_APP_PASSWORD non configure");
      return false;
    }

    await transporter.sendMail({
      from: {
        name: "BKApay",
        address: process.env.GMAIL_USER!,
      },
      replyTo: process.env.GMAIL_USER,
      to,
      subject,
      text: textContent,
      html: htmlContent,
      headers: {
        "X-Priority": "1",
        "X-Mailer": "BKApay Mailer",
        "List-Unsubscribe": `<mailto:${process.env.GMAIL_USER}?subject=unsubscribe>`,
      },
    });
    
    console.log(`[Email] Code de verification envoye a ${to} (type: ${type})`);
    return true;
  } catch (error) {
    console.error("[Email] Erreur lors de l'envoi:", error);
    return false;
  }
}

export async function testEmailConnection(): Promise<boolean> {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log("[Email] Test ignore - GMAIL_USER ou GMAIL_APP_PASSWORD non configure");
      return false;
    }
    
    await transporter.verify();
    console.log("[Email] Connexion Gmail verifiee avec succes");
    return true;
  } catch (error) {
    console.error("[Email] Erreur de connexion Gmail:", error);
    return false;
  }
}

export function isEmailServiceConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}
