import nodemailer from "nodemailer";

interface GmailCredentials {
  gmailUser: string | null;
  gmailPassword: string | null;
}

export type GmailType = "signup" | "password" | "2fa";

const cachedGmailConfigs: Record<GmailType, GmailCredentials | null> = {
  signup: null,
  password: null,
  "2fa": null,
};
const lastConfigFetches: Record<GmailType, number> = {
  signup: 0,
  password: 0,
  "2fa": 0,
};
const CONFIG_CACHE_TTL = 30000;

function getProviderNameForType(type: GmailType): string {
  switch (type) {
    case "signup": return "gmail_signup";
    case "password": return "gmail_password";
    case "2fa": return "gmail_2fa";
  }
}

async function getGmailCredentialsFromDB(gmailType: GmailType): Promise<GmailCredentials> {
  const now = Date.now();
  if (cachedGmailConfigs[gmailType] && (now - lastConfigFetches[gmailType]) < CONFIG_CACHE_TTL) {
    return cachedGmailConfigs[gmailType]!;
  }
  
  const providerName = getProviderNameForType(gmailType);
  
  try {
    const { storage } = await import("./storage");
    const config = await storage.getProviderConfig(providerName);
    
    if (config && config.isActive && config.apiKey && config.secretKey) {
      cachedGmailConfigs[gmailType] = {
        gmailUser: config.apiKey,
        gmailPassword: config.secretKey,
      };
      lastConfigFetches[gmailType] = now;
      console.log(`[Email] Configuration ${providerName} chargée depuis la base de données`);
      return cachedGmailConfigs[gmailType]!;
    }
  } catch (error) {
    console.log(`[Email] Erreur lors de la lecture de la config ${providerName} depuis la BD:`, error);
  }
  
  const fallback = {
    gmailUser: process.env.GMAIL_USER || null,
    gmailPassword: process.env.GMAIL_APP_PASSWORD || null,
  };
  
  if (fallback.gmailUser && fallback.gmailPassword) {
    console.log(`[Email] Configuration ${providerName} utilise le fallback variables d'environnement`);
  }
  
  return fallback;
}

export function clearGmailConfigCache(gmailType?: GmailType): void {
  if (gmailType) {
    cachedGmailConfigs[gmailType] = null;
    lastConfigFetches[gmailType] = 0;
    console.log(`[Email] Cache de configuration ${getProviderNameForType(gmailType)} vidé`);
  } else {
    cachedGmailConfigs.signup = null;
    cachedGmailConfigs.password = null;
    cachedGmailConfigs["2fa"] = null;
    lastConfigFetches.signup = 0;
    lastConfigFetches.password = 0;
    lastConfigFetches["2fa"] = 0;
    console.log("[Email] Cache de configuration Gmail (tous types) vidé");
  }
}

async function createTransporter(gmailType: GmailType): Promise<{ transporter: nodemailer.Transporter | null; gmailUser: string | null }> {
  const { gmailUser, gmailPassword } = await getGmailCredentialsFromDB(gmailType);
  const providerName = getProviderNameForType(gmailType);
  
  if (!gmailUser || !gmailPassword) {
    console.log(`[Email] Configuration ${providerName} manquante - GMAIL_USER:`, !!gmailUser, "GMAIL_APP_PASSWORD:", !!gmailPassword);
    return { transporter: null, gmailUser: null };
  }
  
  console.log(`[Email] Création du transporteur ${providerName} pour:`, gmailUser);
  
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailPassword,
    },
    debug: true,
    logger: false,
  });
  
  return { transporter, gmailUser };
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
    console.log(`[Email] Tentative d'envoi de code ${type} à ${to}...`);
    
    const gmailType: GmailType = type === "signup" ? "signup" : type === "password_reset" ? "password" : "2fa";
    const { transporter, gmailUser } = await createTransporter(gmailType);
    
    if (!transporter || !gmailUser) {
      console.error(`[Email] Configuration ${getProviderNameForType(gmailType)} non configuree - envoi impossible`);
      return false;
    }

    console.log(`[Email] Transporteur créé, envoi en cours...`);
    
    const result = await transporter.sendMail({
      from: {
        name: "BKApay",
        address: gmailUser,
      },
      replyTo: gmailUser,
      to,
      subject,
      text: textContent,
      html: htmlContent,
      headers: {
        "X-Priority": "1",
        "X-Mailer": "BKApay Mailer",
        "List-Unsubscribe": `<mailto:${gmailUser}?subject=unsubscribe>`,
      },
    });
    
    console.log(`[Email] ✅ Code de verification envoye a ${to} (type: ${type}) - MessageId: ${result.messageId}`);
    return true;
  } catch (error: any) {
    console.error("[Email] ❌ Erreur lors de l'envoi:", error?.message || error);
    console.error("[Email] Détails de l'erreur:", JSON.stringify({
      code: error?.code,
      command: error?.command,
      responseCode: error?.responseCode,
    }));
    return false;
  }
}

export async function testEmailConnection(gmailType: GmailType = "signup"): Promise<boolean> {
  try {
    const { transporter } = await createTransporter(gmailType);
    const providerName = getProviderNameForType(gmailType);
    
    if (!transporter) {
      console.log(`[Email] Test ignore - ${providerName} non configure`);
      return false;
    }
    
    await transporter.verify();
    console.log(`[Email] Connexion ${providerName} verifiee avec succes`);
    return true;
  } catch (error) {
    console.error(`[Email] Erreur de connexion ${getProviderNameForType(gmailType)}:`, error);
    return false;
  }
}

export async function isEmailServiceConfigured(gmailType?: GmailType): Promise<boolean> {
  if (gmailType) {
    const { gmailUser, gmailPassword } = await getGmailCredentialsFromDB(gmailType);
    return !!(gmailUser && gmailPassword);
  }
  const signupConfig = await getGmailCredentialsFromDB("signup");
  const passwordConfig = await getGmailCredentialsFromDB("password");
  const tfaConfig = await getGmailCredentialsFromDB("2fa");
  return !!(signupConfig.gmailUser && signupConfig.gmailPassword) ||
         !!(passwordConfig.gmailUser && passwordConfig.gmailPassword) ||
         !!(tfaConfig.gmailUser && tfaConfig.gmailPassword);
}

export async function isEmailSendingEnabled(gmailType: GmailType): Promise<boolean> {
  const providerName = getProviderNameForType(gmailType);
  
  try {
    const { storage } = await import("./storage");
    const config = await storage.getProviderConfig(providerName);
    
    if (config && config.isActive && config.apiKey && config.secretKey) {
      return true;
    }
    return false;
  } catch (error) {
    console.log(`[Email] Erreur lors de la vérification si ${providerName} est activé:`, error);
    return false;
  }
}
