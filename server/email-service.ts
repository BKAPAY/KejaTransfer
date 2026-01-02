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
  type: "signup" | "password_reset"
): Promise<boolean> {
  const subject = type === "signup" 
    ? "BKApay - Code de vérification de votre compte"
    : "BKApay - Code de réinitialisation de mot de passe";
    
  const htmlContent = type === "signup"
    ? `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb; text-align: center;">BKApay</h2>
        <h3 style="text-align: center;">Vérification de votre adresse email</h3>
        <p>Bonjour,</p>
        <p>Merci de vous être inscrit sur BKApay. Voici votre code de vérification :</p>
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1f2937;">${code}</span>
        </div>
        <p>Ce code est valable pendant <strong>10 minutes</strong>.</p>
        <p>Si vous n'avez pas créé de compte, ignorez cet email.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px; text-align: center;">
          BKApay - Votre plateforme de paiement mobile money
        </p>
      </div>
    `
    : `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb; text-align: center;">BKApay</h2>
        <h3 style="text-align: center;">Réinitialisation de votre mot de passe</h3>
        <p>Bonjour,</p>
        <p>Vous avez demandé la réinitialisation de votre mot de passe. Voici votre code de vérification :</p>
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1f2937;">${code}</span>
        </div>
        <p>Ce code est valable pendant <strong>10 minutes</strong>.</p>
        <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px; text-align: center;">
          BKApay - Votre plateforme de paiement mobile money
        </p>
      </div>
    `;

  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.error("[Email] GMAIL_USER ou GMAIL_APP_PASSWORD non configuré");
      return false;
    }

    await transporter.sendMail({
      from: `"BKApay" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html: htmlContent,
    });
    
    console.log(`[Email] Code de vérification envoyé à ${to} (type: ${type})`);
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
      console.log("[Email] Test ignoré - GMAIL_USER ou GMAIL_APP_PASSWORD non configuré");
      return false;
    }
    
    await transporter.verify();
    console.log("[Email] Connexion Gmail vérifiée avec succès");
    return true;
  } catch (error) {
    console.error("[Email] Erreur de connexion Gmail:", error);
    return false;
  }
}

export function isEmailServiceConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}
