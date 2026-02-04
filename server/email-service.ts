interface MailtrapConfig {
  apiToken: string | null;
  senderEmail: string | null;
  senderName: string | null;
  enableSignup: boolean;
  enablePasswordReset: boolean;
  enableLogin: boolean;
}

let cachedMailtrapConfig: MailtrapConfig | null = null;
let lastConfigFetch = 0;
const CONFIG_CACHE_TTL = 30000;

async function getMailtrapConfigFromDB(): Promise<MailtrapConfig> {
  const now = Date.now();
  if (cachedMailtrapConfig && (now - lastConfigFetch) < CONFIG_CACHE_TTL) {
    return cachedMailtrapConfig;
  }
  
  try {
    const { storage } = await import("./storage");
    const config = await storage.getProviderConfig("mailtrap");
    
    if (config && config.isActive && config.apiKey) {
      cachedMailtrapConfig = {
        apiToken: config.apiKey,
        senderEmail: config.secretKey || "noreply@bkapay.com",
        senderName: config.publicKey || "BKApay",
        enableSignup: config.masterKey === "true",
        enablePasswordReset: config.token === "true",
        enableLogin: config.ipnSecret === "true",
      };
      lastConfigFetch = now;
      console.log("[Email] Configuration Mailtrap chargee depuis la base de donnees");
      return cachedMailtrapConfig;
    }
  } catch (error) {
    console.log("[Email] Erreur lors de la lecture de la config Mailtrap depuis la BD:", error);
  }
  
  return {
    apiToken: null,
    senderEmail: null,
    senderName: null,
    enableSignup: false,
    enablePasswordReset: false,
    enableLogin: false,
  };
}

export function clearMailtrapConfigCache(): void {
  cachedMailtrapConfig = null;
  lastConfigFetch = 0;
  console.log("[Email] Cache de configuration Mailtrap vide");
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendMailtrapEmail(
  to: string,
  subject: string,
  textContent: string,
  htmlContent: string
): Promise<boolean> {
  const config = await getMailtrapConfigFromDB();
  
  if (!config.apiToken || !config.senderEmail) {
    console.error("[Email] Configuration Mailtrap non configuree - envoi impossible");
    return false;
  }
  
  try {
    console.log(`[Email] Envoi via Mailtrap a ${to}...`);
    
    const response = await fetch("https://send.api.mailtrap.io/api/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Token": config.apiToken,
      },
      body: JSON.stringify({
        from: {
          name: config.senderName || "BKApay",
          email: config.senderEmail,
        },
        to: [{ email: to }],
        subject,
        text: textContent,
        html: htmlContent,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Email] Erreur Mailtrap:", response.status, errorText);
      return false;
    }
    
    const result = await response.json();
    console.log(`[Email] Email envoye avec succes a ${to}:`, result);
    return true;
  } catch (error: any) {
    console.error("[Email] Erreur lors de l'envoi Mailtrap:", error?.message || error);
    return false;
  }
}

export async function sendVerificationEmail(
  to: string,
  code: string,
  type: "signup" | "password_reset" | "login"
): Promise<boolean> {
  const config = await getMailtrapConfigFromDB();
  
  if (type === "signup" && !config.enableSignup) {
    console.log("[Email] Envoi d'email inscription desactive");
    return false;
  }
  if (type === "password_reset" && !config.enablePasswordReset) {
    console.log("[Email] Envoi d'email mot de passe oublie desactive");
    return false;
  }
  if (type === "login" && !config.enableLogin) {
    console.log("[Email] Envoi d'email connexion desactive");
    return false;
  }
  
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

  const htmlContent = type === "signup"
    ? generateSignupHtml(code)
    : type === "login"
    ? generateLoginHtml(code)
    : generatePasswordResetHtml(code);

  console.log(`[Email] Tentative d'envoi de code ${type} a ${to}...`);
  
  const result = await sendMailtrapEmail(to, subject, textContent, htmlContent);
  
  if (result) {
    console.log(`[Email] Code de verification envoye a ${to} (type: ${type})`);
  }
  
  return result;
}

function generateSignupHtml(code: string): string {
  return `
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
                  <p style="margin: 0 0 10px; color: #9ca3af; font-family: Arial, sans-serif; font-size: 12px; text-align: center;">
                    Pour toute question, contactez notre support:<br>
                    <a href="mailto:support@bkapay.com" style="color: #2563eb; text-decoration: none;">support@bkapay.com</a>
                  </p>
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
}

function generateLoginHtml(code: string): string {
  return `
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
                  <p style="margin: 0 0 10px; color: #9ca3af; font-family: Arial, sans-serif; font-size: 12px; text-align: center;">
                    Pour toute question, contactez notre support:<br>
                    <a href="mailto:support@bkapay.com" style="color: #2563eb; text-decoration: none;">support@bkapay.com</a>
                  </p>
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
}

function generatePasswordResetHtml(code: string): string {
  return `
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
                  <p style="margin: 0 0 10px; color: #9ca3af; font-family: Arial, sans-serif; font-size: 12px; text-align: center;">
                    Pour toute question, contactez notre support:<br>
                    <a href="mailto:support@bkapay.com" style="color: #2563eb; text-decoration: none;">support@bkapay.com</a>
                  </p>
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
}

export async function testEmailConnection(): Promise<boolean> {
  const config = await getMailtrapConfigFromDB();
  
  if (!config.apiToken) {
    console.log("[Email] Test ignore - Mailtrap non configure");
    return false;
  }
  
  console.log("[Email] Configuration Mailtrap verifiee");
  return true;
}

export async function isEmailServiceConfigured(): Promise<boolean> {
  const config = await getMailtrapConfigFromDB();
  return !!(config.apiToken && config.senderEmail);
}

export async function isEmailSendingEnabled(emailType: "signup" | "password_reset" | "login"): Promise<boolean> {
  const config = await getMailtrapConfigFromDB();
  
  if (!config.apiToken || !config.senderEmail) {
    return false;
  }
  
  switch (emailType) {
    case "signup":
      return config.enableSignup;
    case "password_reset":
      return config.enablePasswordReset;
    case "login":
      return config.enableLogin;
    default:
      return false;
  }
}

export type EmailType = "signup" | "password_reset" | "login";

export function clearEmailConfigCache(): void {
  clearMailtrapConfigCache();
}

export async function sendKycSubmittedEmail(
  to: string,
  firstName: string
): Promise<boolean> {
  const subject = "BKApay - Votre verification KYC a ete soumise";

  const textContent = `BKApay - Verification KYC

Bonjour ${firstName},

Votre demande de verification KYC a ete soumise avec succes.

Nos equipes vont examiner vos documents dans les plus brefs delais. Vous recevrez un email des que la verification sera terminee.

Statut actuel: En cours de verification

--
BKApay - Votre plateforme de paiement mobile money
https://bkapay.com`;

  const htmlContent = generateKycSubmittedHtml(firstName);

  console.log(`[Email] Envoi notification KYC soumis a ${to}...`);
  return await sendMailtrapEmail(to, subject, textContent, htmlContent);
}

export async function sendKycVerifiedEmail(
  to: string,
  firstName: string
): Promise<boolean> {
  const subject = "BKApay - Votre compte a ete verifie avec succes";

  const textContent = `BKApay - Compte verifie

Bonjour ${firstName},

Felicitations! Votre verification KYC a ete approuvee.

Vous avez maintenant acces a toutes les fonctionnalites de BKApay:
- Effectuer des retraits
- Creer des liens de paiement
- Utiliser l'API BKApay

Merci de faire confiance a BKApay!

--
BKApay - Votre plateforme de paiement mobile money
https://bkapay.com`;

  const htmlContent = generateKycVerifiedHtml(firstName);

  console.log(`[Email] Envoi notification KYC verifie a ${to}...`);
  return await sendMailtrapEmail(to, subject, textContent, htmlContent);
}

export async function sendKycRejectedEmail(
  to: string,
  firstName: string,
  reason: string
): Promise<boolean> {
  const subject = "BKApay - Votre verification KYC a ete rejetee";

  const textContent = `BKApay - Verification KYC rejetee

Bonjour ${firstName},

Malheureusement, votre demande de verification KYC a ete rejetee.

Raison du rejet: ${reason}

Vous pouvez soumettre une nouvelle demande en vous assurant que vos documents sont conformes aux exigences.

Si vous avez des questions, n'hesitez pas a nous contacter.

--
BKApay - Votre plateforme de paiement mobile money
https://bkapay.com`;

  const htmlContent = generateKycRejectedHtml(firstName, reason);

  console.log(`[Email] Envoi notification KYC rejete a ${to}...`);
  return await sendMailtrapEmail(to, subject, textContent, htmlContent);
}

function generateKycSubmittedHtml(firstName: string): string {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>BKApay - KYC Soumis</title>
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
                  <h2 style="margin: 0 0 20px; color: #1f2937; font-family: Arial, sans-serif; font-size: 20px; text-align: center;">Verification KYC soumise</h2>
                  <p style="margin: 0 0 15px; color: #4b5563; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5;">Bonjour ${firstName},</p>
                  <p style="margin: 0 0 25px; color: #4b5563; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5;">Votre demande de verification KYC a ete soumise avec succes.</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 40px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="background-color: #fef3c7; padding: 20px; text-align: center; border-radius: 8px; border-left: 4px solid #f59e0b;">
                        <p style="margin: 0; color: #92400e; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold;">En cours de verification</p>
                        <p style="margin: 10px 0 0; color: #b45309; font-family: Arial, sans-serif; font-size: 14px;">Nos equipes examinent vos documents</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 25px 40px 40px;">
                  <p style="margin: 0; color: #6b7280; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">Vous recevrez un email des que la verification sera terminee.</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 40px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 10px; color: #9ca3af; font-family: Arial, sans-serif; font-size: 12px; text-align: center;">
                    Pour toute question, contactez notre support:<br>
                    <a href="mailto:support@bkapay.com" style="color: #2563eb; text-decoration: none;">support@bkapay.com</a>
                  </p>
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
}

function generateKycVerifiedHtml(firstName: string): string {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>BKApay - KYC Verifie</title>
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
                  <h2 style="margin: 0 0 20px; color: #1f2937; font-family: Arial, sans-serif; font-size: 20px; text-align: center;">Compte verifie avec succes</h2>
                  <p style="margin: 0 0 15px; color: #4b5563; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5;">Bonjour ${firstName},</p>
                  <p style="margin: 0 0 25px; color: #4b5563; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5;">Felicitations! Votre verification KYC a ete approuvee.</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 40px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="background-color: #d1fae5; padding: 20px; text-align: center; border-radius: 8px; border-left: 4px solid #10b981;">
                        <p style="margin: 0; color: #065f46; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold;">Compte verifie</p>
                        <p style="margin: 10px 0 0; color: #047857; font-family: Arial, sans-serif; font-size: 14px;">Vous avez acces a toutes les fonctionnalites</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 25px 40px;">
                  <p style="margin: 0 0 10px; color: #4b5563; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">Vous pouvez maintenant:</p>
                  <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.8;">
                    <li>Effectuer des retraits</li>
                    <li>Creer des liens de paiement</li>
                    <li>Utiliser l'API BKApay</li>
                  </ul>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 40px 40px;">
                  <p style="margin: 0; color: #6b7280; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">Merci de faire confiance a BKApay!</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 40px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 10px; color: #9ca3af; font-family: Arial, sans-serif; font-size: 12px; text-align: center;">
                    Pour toute question, contactez notre support:<br>
                    <a href="mailto:support@bkapay.com" style="color: #2563eb; text-decoration: none;">support@bkapay.com</a>
                  </p>
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
}

function generateKycRejectedHtml(firstName: string, reason: string): string {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>BKApay - KYC Rejete</title>
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
                  <h2 style="margin: 0 0 20px; color: #1f2937; font-family: Arial, sans-serif; font-size: 20px; text-align: center;">Verification KYC rejetee</h2>
                  <p style="margin: 0 0 15px; color: #4b5563; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5;">Bonjour ${firstName},</p>
                  <p style="margin: 0 0 25px; color: #4b5563; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5;">Malheureusement, votre demande de verification KYC a ete rejetee.</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 40px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="background-color: #fee2e2; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444;">
                        <p style="margin: 0 0 10px; color: #991b1b; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold;">Raison du rejet:</p>
                        <p style="margin: 0; color: #b91c1c; font-family: Arial, sans-serif; font-size: 14px;">${reason}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 25px 40px 40px;">
                  <p style="margin: 0 0 10px; color: #4b5563; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">Vous pouvez soumettre une nouvelle demande en vous assurant que vos documents sont conformes aux exigences.</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 40px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 10px; color: #9ca3af; font-family: Arial, sans-serif; font-size: 12px; text-align: center;">
                    Pour toute question, contactez notre support:<br>
                    <a href="mailto:support@bkapay.com" style="color: #2563eb; text-decoration: none;">support@bkapay.com</a>
                  </p>
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
}
