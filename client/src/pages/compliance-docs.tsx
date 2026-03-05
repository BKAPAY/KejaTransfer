import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download, ChevronLeft } from "lucide-react";
import { Link } from "wouter";

const LOGO_URL = "/bkapay-logo-full.png";
const SIGNATURE_URL = "/signature-juste.jpg";
const CACHET_URL = "/cachet-keja.png";
const TODAY = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
const TODAY_EN = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

const companyInfo = {
  fr: {
    nom: "KEJA (Entreprise Individuelle)",
    marque: "BKApay",
    rccm: "RB/ABY/25 A 36549",
    ifu: "0202518566726",
    adresse: "Îlot 78, Parcelle C, Maison Kpetekousso Dorothée, ZOU, BOHICON, BOHICON II, AGONVEZOUN, Bénin",
    tel: "+229 0146447319 / +229 0146500275",
    email: "kpetekoussojustel@gmail.com",
    directeur: "M. Emali Juste Kpetekousso",
    mrlo: "M. Emali Juste Kpetekousso",
    site: "https://bkapay.com",
  },
  en: {
    nom: "KEJA (Sole Proprietorship)",
    marque: "BKApay",
    rccm: "RB/ABY/25 A 36549",
    ifu: "0202518566726",
    adresse: "Lot 78, Plot C, Kpetekousso Dorothée House, ZOU, BOHICON, BOHICON II, AGONVEZOUN, Benin",
    tel: "+229 0146447319 / +229 0146500275",
    email: "kpetekoussojustel@gmail.com",
    directeur: "Mr. Emali Juste Kpetekousso",
    mrlo: "Mr. Emali Juste Kpetekousso",
    site: "https://bkapay.com",
  },
};

function WatermarkBackground() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundImage: `url(${LOGO_URL})`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "55%",
        opacity: 0.055,
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

function DocumentHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 32, position: "relative", zIndex: 1 }}>
      <img src={LOGO_URL} alt="BKApay" style={{ height: 70, objectFit: "contain", marginBottom: 8 }} />
      <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>
        KEJA — BKApay | RCCM : RB/ABY/25 A 36549 | IFU : 0202518566726
      </div>
      <div style={{ borderTop: "3px solid #2b4a9e", marginTop: 10, marginBottom: 10 }} />
      <div style={{ fontSize: 18, fontWeight: "bold", color: "#1a2e6b", textTransform: "uppercase", letterSpacing: 1 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: "#444", marginTop: 4 }}>{subtitle}</div>
      <div style={{ borderBottom: "1px solid #ccc", marginTop: 12 }} />
    </div>
  );
}

function SignatureBlock() {
  return (
    <div
      style={{
        marginTop: 48,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        position: "relative",
        zIndex: 1,
        flexWrap: "wrap",
        gap: 24,
      }}
    >
      <div>
        <div style={{ fontSize: 11, color: "#444", marginBottom: 4 }}>
          Fait à Bohicon, Bénin / Made in Bohicon, Benin
        </div>
        <div style={{ fontSize: 11, color: "#444" }}>
          Date : {TODAY} / {TODAY_EN}
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: "bold", color: "#1a2e6b" }}>
            Emali Juste Kpetekousso
          </div>
          <div style={{ fontSize: 10, color: "#555" }}>Directeur Général — Managing Director</div>
          <div style={{ fontSize: 10, color: "#555" }}>KEJA / BKApay</div>
          <img
            src={SIGNATURE_URL}
            alt="Signature"
            style={{ height: 60, objectFit: "contain", display: "block", marginTop: 4 }}
          />
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <img
          src={CACHET_URL}
          alt="Cachet"
          style={{ height: 110, objectFit: "contain" }}
        />
      </div>
    </div>
  );
}

function SectionTitle({ fr, en }: { fr: string; en: string }) {
  return (
    <div style={{ marginTop: 24, marginBottom: 8 }}>
      <div
        style={{
          background: "#1a2e6b",
          color: "#fff",
          padding: "5px 12px",
          fontSize: 12,
          fontWeight: "bold",
          borderRadius: 4,
        }}
      >
        {fr} / {en}
      </div>
    </div>
  );
}

function Paragraph({ fr, en }: { fr: string; en: string }) {
  return (
    <div style={{ marginBottom: 8, position: "relative", zIndex: 1 }}>
      <div style={{ fontSize: 11, color: "#111", lineHeight: 1.7 }}>{fr}</div>
      <div style={{ fontSize: 11, color: "#444", fontStyle: "italic", lineHeight: 1.6, marginTop: 2 }}>
        🇬🇧 {en}
      </div>
    </div>
  );
}

function BulletList({ items }: { items: { fr: string; en: string }[] }) {
  return (
    <ul style={{ paddingLeft: 18, margin: "6px 0", position: "relative", zIndex: 1 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 11, color: "#111", marginBottom: 6, lineHeight: 1.6 }}>
          {item.fr}
          <br />
          <span style={{ color: "#555", fontStyle: "italic" }}>🇬🇧 {item.en}</span>
        </li>
      ))}
    </ul>
  );
}

function DocPage({ children, id }: { children: React.ReactNode; id: string }) {
  return (
    <div
      id={id}
      className="doc-page"
      style={{
        position: "relative",
        background: "#fff",
        padding: "48px 56px",
        maxWidth: 860,
        margin: "0 auto",
        fontFamily: "Georgia, serif",
        boxShadow: "0 2px 20px rgba(0,0,0,0.12)",
        pageBreakAfter: "always",
        minHeight: "100vh",
      }}
    >
      <WatermarkBackground />
      {children}
    </div>
  );
}

function Document1_AMLPolicy() {
  return (
    <DocPage id="doc-aml-policy">
      <DocumentHeader
        title="Politique AML/CFT — AML/CFT Policy and Procedures"
        subtitle="Lutte contre le Blanchiment de Capitaux et le Financement du Terrorisme"
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <SectionTitle fr="1. Introduction et Objet" en="1. Introduction and Purpose" />
        <Paragraph
          fr="La présente politique est établie par KEJA, entreprise individuelle enregistrée au Registre du Commerce et du Crédit Mobilier de Bohicon (Bénin) sous le numéro RB/ABY/25 A 36549, exploitant la plateforme de paiement numérique dénommée BKApay. BKApay est une plateforme de paiement mobile multi-pays destinée à aider les entreprises et les particuliers en Afrique de l'Ouest à collecter et à transférer des fonds de manière sécurisée via les services mobile money."
          en="This policy is established by KEJA, a sole proprietorship registered with the Trade and Personal Property Credit Register of Bohicon (Benin) under number RB/ABY/25 A 36549, operating the digital payment platform known as BKApay. BKApay is a multi-country mobile payment platform designed to help businesses and individuals in West Africa collect and transfer funds securely through mobile money services."
        />
        <Paragraph
          fr="Ce document définit les procédures et mesures que BKApay met en place pour prévenir, détecter et signaler toute activité de blanchiment de capitaux ou de financement du terrorisme conformément aux standards internationaux (GAFI/FATF) et aux réglementations locales en vigueur."
          en="This document defines the procedures and measures that BKApay puts in place to prevent, detect, and report any money laundering or terrorist financing activity in compliance with international standards (FATF) and applicable local regulations."
        />

        <SectionTitle fr="2. Vérification Client (KYC — Know Your Customer)" en="2. Customer Due Diligence (KYC)" />
        <Paragraph
          fr="BKApay applique une procédure stricte de connaissance client (KYC) à chaque inscription et lors de transactions dépassant les seuils définis. Les informations collectées sont : nom complet, prénom, adresse email, numéro de téléphone, pays de résidence et pièce d'identité officielle."
          en="BKApay applies a strict Know Your Customer (KYC) procedure at each registration and for transactions exceeding defined thresholds. Information collected includes: full name, email address, phone number, country of residence, and official identification document."
        />
        <Paragraph
          fr="Mesures techniques anti-fraude spécifiques à BKApay : la plateforme interdit formellement l'importation de photos depuis la galerie du téléphone. Chaque utilisateur est contraint de prendre une photo en temps réel (selfie + recto-verso de sa pièce d'identité) directement depuis la caméra du téléphone lors de la vérification. Cette contrainte technique garantit l'authenticité des documents soumis."
          en="BKApay-specific anti-fraud technical measures: the platform strictly prohibits importing photos from the phone gallery. Each user is required to take a real-time photo (selfie + front and back of identity document) directly from the phone camera during verification. This technical constraint guarantees the authenticity of submitted documents."
        />
        <Paragraph
          fr="De plus, lors de chaque connexion, la plateforme capture automatiquement la position GPS précise de l'utilisateur (latitude, longitude, lien Google Maps) ainsi qu'une photo en temps réel via la caméra. Les utilisateurs refusant la géolocalisation ou l'accès à la caméra sont systématiquement bloqués et ne peuvent pas accéder au tableau de bord. Une signature électronique est également capturée directement depuis l'interface web."
          en="Furthermore, at each login, the platform automatically captures the user's precise GPS location (latitude, longitude, Google Maps link) as well as a real-time photo via camera. Users who refuse geolocation or camera access are systematically blocked and cannot access the dashboard. An electronic signature is also captured directly from the web interface."
        />
        <BulletList
          items={[
            {
              fr: "Vérification OTP (code SMS/Email) à chaque connexion",
              en: "OTP verification (SMS/Email code) at each login",
            },
            {
              fr: "Refus systématique des clients anonymes ou sans pièce d'identité valide",
              en: "Systematic refusal of anonymous clients or clients without valid identification",
            },
            {
              fr: "Vérification d'identité renforcée pour les montants supérieurs à 100 000 XOF",
              en: "Enhanced identity verification for amounts exceeding 100,000 XOF",
            },
            {
              fr: "Historique complet des connexions (IP, localisation, appareil, navigateur, FAI) accessible à l'administration",
              en: "Full login history (IP, location, device, browser, ISP) accessible to administration",
            },
          ]}
        />

        <SectionTitle fr="3. Surveillance des Transactions" en="3. Transaction Monitoring" />
        <Paragraph
          fr="BKApay dispose d'un système de surveillance automatique des transactions visant à détecter les comportements inhabituels ou suspects."
          en="BKApay has an automatic transaction monitoring system designed to detect unusual or suspicious behavior."
        />
        <BulletList
          items={[
            {
              fr: "Détection de volumes de transactions anormalement élevés sur une courte période",
              en: "Detection of abnormally high transaction volumes over a short period",
            },
            {
              fr: "Alertes sur les paiements multiples rapides et répétés vers les mêmes destinataires",
              en: "Alerts on rapid and repeated multiple payments to the same recipients",
            },
            {
              fr: "Blocage automatique après plusieurs tentatives de paiement échouées consécutives",
              en: "Automatic blocking after several consecutive failed payment attempts",
            },
            {
              fr: "Suspension du compte si des activités suspectes sont détectées par l'administrateur",
              en: "Account suspension if suspicious activities are detected by the administrator",
            },
            {
              fr: "Journalisation et archivage de toutes les transactions avec horodatage",
              en: "Logging and archiving of all transactions with timestamps",
            },
          ]}
        />

        <SectionTitle fr="4. Évaluation des Risques" en="4. Risk Assessment" />
        <Paragraph
          fr="BKApay refuse catégoriquement l'accès à sa plateforme aux activités et secteurs à haut risque suivants :"
          en="BKApay categorically refuses access to its platform for the following high-risk activities and sectors:"
        />
        <BulletList
          items={[
            { fr: "Jeux de hasard illicites et paris non réglementés", en: "Illegal gambling and unregulated betting" },
            {
              fr: "Arnaques, escroqueries et fraudes en ligne de toute nature",
              en: "Scams, swindles, and online fraud of any kind",
            },
            {
              fr: "Transactions liées aux crypto-actifs non réglementés ou illégaux",
              en: "Transactions related to unregulated or illegal crypto assets",
            },
            {
              fr: "Trafic d'armes, de drogues ou de substances illicites",
              en: "Trafficking of weapons, drugs, or illicit substances",
            },
            {
              fr: "Activités contraires aux lois en vigueur dans les pays couverts par BKApay",
              en: "Activities contrary to applicable laws in countries covered by BKApay",
            },
            {
              fr: "Personnes figurant sur des listes de sanctions internationales",
              en: "Persons appearing on international sanctions lists",
            },
          ]}
        />

        <SectionTitle fr="5. Signalement et Reporting" en="5. Reporting" />
        <Paragraph
          fr="En cas de détection d'activité suspecte, BKApay applique la procédure suivante : suspension immédiate du compte concerné, investigation interne par le MRLO, signalement aux autorités compétentes du Bénin si nécessaire, et conservation des preuves pendant une durée minimale de 5 ans."
          en="When suspicious activity is detected, BKApay applies the following procedure: immediate suspension of the account concerned, internal investigation by the MRLO, reporting to the competent Beninese authorities if necessary, and preservation of evidence for a minimum period of 5 years."
        />

        <SectionTitle
          fr="6. Responsable de la Lutte contre le Blanchiment (MRLO)"
          en="6. Money Laundering Reporting Officer (MRLO)"
        />
        <Paragraph
          fr="M. Emali Juste Kpetekousso est officiellement nommé Responsable de la Lutte contre le Blanchiment et le Financement du Terrorisme (MRLO) de l'entreprise KEJA / BKApay."
          en="Mr. Emali Juste Kpetekousso is officially appointed as Money Laundering Reporting Officer (MRLO) of KEJA / BKApay."
        />
        <BulletList
          items={[
            {
              fr: "Supervision et mise à jour de la présente politique AML/CFT",
              en: "Supervision and updating of this AML/CFT policy",
            },
            {
              fr: "Traitement et investigation des alertes de transactions suspectes",
              en: "Processing and investigation of suspicious transaction alerts",
            },
            {
              fr: "Liaison avec les autorités réglementaires et judiciaires compétentes",
              en: "Liaison with competent regulatory and judicial authorities",
            },
            { fr: "Formation continue du personnel sur les risques AML/CFT", en: "Ongoing staff training on AML/CFT risks" },
          ]}
        />

        <SectionTitle fr="7. Formation et Sensibilisation" en="7. Training and Awareness" />
        <Paragraph
          fr="BKApay s'engage à sensibiliser régulièrement ses équipes sur les risques liés au blanchiment de capitaux et au financement du terrorisme. Des formations annuelles sont planifiées et documentées."
          en="BKApay is committed to regularly raising awareness among its teams about the risks associated with money laundering and terrorist financing. Annual training sessions are planned and documented."
        />

        <SectionTitle fr="8. Révision de la Politique" en="8. Policy Review" />
        <Paragraph
          fr="La présente politique est approuvée par le conseil de direction de KEJA et sera révisée annuellement ou à chaque changement réglementaire significatif."
          en="This policy is approved by KEJA's management board and will be reviewed annually or upon any significant regulatory change."
        />
      </div>

      <SignatureBlock />
    </DocPage>
  );
}

function Document2_AMLQuestionnaire() {
  const fields: { q_fr: string; q_en: string; r: string }[] = [
    {
      q_fr: "Nom légal de l'entreprise",
      q_en: "Legal name of the company",
      r: "KEJA (Entreprise Individuelle)",
    },
    { q_fr: "Nom commercial / Marque", q_en: "Trade name / Brand", r: "BKApay" },
    {
      q_fr: "Numéro d'enregistrement RCCM",
      q_en: "RCCM registration number",
      r: "RB/ABY/25 A 36549",
    },
    { q_fr: "Numéro IFU", q_en: "IFU number", r: "0202518566726" },
    {
      q_fr: "Pays d'enregistrement",
      q_en: "Country of registration",
      r: "Bénin / Benin",
    },
    {
      q_fr: "Adresse du siège social",
      q_en: "Registered address",
      r: "Îlot 78, Parcelle C, ZOU, BOHICON, Bénin",
    },
    {
      q_fr: "Nom du directeur général / responsable",
      q_en: "Name of the managing director",
      r: "Emali Juste Kpetekousso",
    },
    {
      q_fr: "Nom du MRLO désigné",
      q_en: "Name of the designated MRLO",
      r: "Emali Juste Kpetekousso",
    },
    {
      q_fr: "La société dispose-t-elle d'une politique AML/CFT écrite ?",
      q_en: "Does the company have a written AML/CFT policy?",
      r: "Oui / Yes",
    },
    {
      q_fr: "Des vérifications KYC sont-elles effectuées sur tous les clients ?",
      q_en: "Are KYC checks performed on all customers?",
      r: "Oui — vérification de pièce d'identité, photo caméra en temps réel, GPS, OTP / Yes — ID check, real-time camera photo, GPS, OTP",
    },
    {
      q_fr: "L'entreprise accepte-t-elle des clients anonymes ?",
      q_en: "Does the company accept anonymous customers?",
      r: "Non / No",
    },
    {
      q_fr: "Des transactions suspectes sont-elles surveillées et signalées ?",
      q_en: "Are suspicious transactions monitored and reported?",
      r: "Oui — système de surveillance automatique et blocage des comptes / Yes — automatic monitoring system and account blocking",
    },
    {
      q_fr: "L'entreprise effectue-t-elle des contrôles sur les listes de sanctions ?",
      q_en: "Does the company perform sanctions list checks?",
      r: "Oui / Yes",
    },
    {
      q_fr: "Des secteurs ou activités sont-ils exclus de la plateforme ?",
      q_en: "Are certain sectors or activities excluded from the platform?",
      r: "Oui : jeux illicites, scams, crypto non réglementée, trafic, armes / Yes: illegal gambling, scams, unregulated crypto, trafficking, weapons",
    },
    {
      q_fr: "Les données des transactions sont-elles conservées et pour quelle durée ?",
      q_en: "Is transaction data retained and for how long?",
      r: "Oui, 5 ans minimum / Yes, minimum 5 years",
    },
    {
      q_fr: "Le personnel est-il formé sur les risques AML/CFT ?",
      q_en: "Is staff trained on AML/CFT risks?",
      r: "Oui, formation annuelle prévue / Yes, annual training planned",
    },
    {
      q_fr: "La société traite-t-elle avec des personnes politiquement exposées (PEP) ?",
      q_en: "Does the company deal with Politically Exposed Persons (PEPs)?",
      r: "Non / No",
    },
    {
      q_fr: "Quels sont les volumes de transactions anticipés ?",
      q_en: "What are the anticipated transaction volumes?",
      r: "< 100 000 € / mois dans la phase initiale / < €100,000/month in the initial phase",
    },
    {
      q_fr: "Répartition estimée du portefeuille marchand par secteur",
      q_en: "Estimated merchant portfolio breakdown by sector",
      r: "E-commerce : 45% | Services numériques / Digital services : 30% | Transferts personnels / Personal transfers : 20% | Autres / Others : 5%",
    },
    {
      q_fr: "La société a-t-elle déjà fait l'objet d'enquêtes pour blanchiment ou fraude ?",
      q_en: "Has the company ever been investigated for money laundering or fraud?",
      r: "Non / No",
    },
  ];

  return (
    <DocPage id="doc-questionnaire">
      <DocumentHeader
        title="Questionnaire AML/CFT — AML/CFT Questionnaire"
        subtitle="Dûment complété par KEJA / BKApay — Duly completed by KEJA / BKApay"
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <Paragraph
          fr="Ce questionnaire est complété de bonne foi par le représentant légal de KEJA / BKApay, M. Emali Juste Kpetekousso, dans le cadre du processus d'intégration avec PawaPay."
          en="This questionnaire is completed in good faith by the legal representative of KEJA / BKApay, Mr. Emali Juste Kpetekousso, as part of the onboarding process with PawaPay."
        />

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 16,
            fontSize: 10.5,
          }}
        >
          <thead>
            <tr style={{ background: "#1a2e6b", color: "#fff" }}>
              <th style={{ padding: "6px 10px", textAlign: "left", width: "45%" }}>
                Question (FR / EN)
              </th>
              <th style={{ padding: "6px 10px", textAlign: "left" }}>Réponse / Answer</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "#f8f9fc" : "#fff" }}>
                <td
                  style={{
                    padding: "7px 10px",
                    borderBottom: "1px solid #e0e0e0",
                    color: "#111",
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ fontWeight: "bold" }}>{f.q_fr}</span>
                  <br />
                  <span style={{ color: "#666", fontStyle: "italic" }}>{f.q_en}</span>
                </td>
                <td
                  style={{
                    padding: "7px 10px",
                    borderBottom: "1px solid #e0e0e0",
                    color: "#1a2e6b",
                    fontWeight: "bold",
                    lineHeight: 1.5,
                  }}
                >
                  {f.r}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SignatureBlock />
    </DocPage>
  );
}

function Document3_MRLO_CV() {
  return (
    <DocPage id="doc-mrlo-cv">
      <DocumentHeader
        title="Curriculum Vitae — MRLO"
        subtitle="Responsable de la Lutte contre le Blanchiment / Money Laundering Reporting Officer"
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            background: "#1a2e6b",
            color: "#fff",
            padding: "16px 24px",
            borderRadius: 6,
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: "bold" }}>EMALI JUSTE KPETEKOUSSO</div>
          <div style={{ fontSize: 12, marginTop: 4, opacity: 0.9 }}>
            Directeur Général — Managing Director | KEJA / BKApay
          </div>
          <div style={{ fontSize: 11, marginTop: 6, opacity: 0.85 }}>
            MRLO Désigné / Designated MRLO — BKApay
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 11 }}>
            <div style={{ fontWeight: "bold", color: "#1a2e6b", marginBottom: 4 }}>
              Informations Personnelles / Personal Information
            </div>
            <div>Nom / Name : Emali Juste Kpetekousso</div>
            <div>Nationalité / Nationality : Béninoise / Beninese</div>
            <div>Pays / Country : Bénin / Benin</div>
            <div>Tél / Phone : +229 0146447319</div>
            <div>Email : kpetekoussojustel@gmail.com</div>
          </div>
          <div style={{ fontSize: 11 }}>
            <div style={{ fontWeight: "bold", color: "#1a2e6b", marginBottom: 4 }}>
              Entreprise / Company
            </div>
            <div>Entreprise / Company : KEJA</div>
            <div>Marque / Brand : BKApay</div>
            <div>RCCM : RB/ABY/25 A 36549</div>
            <div>IFU : 0202518566726</div>
            <div>Site : bkapay.com</div>
          </div>
        </div>

        <SectionTitle
          fr="Rôle et Responsabilités MRLO"
          en="MRLO Role and Responsibilities"
        />
        <BulletList
          items={[
            {
              fr: "Supervision et mise en œuvre de la politique AML/CFT de BKApay",
              en: "Supervision and implementation of BKApay's AML/CFT policy",
            },
            {
              fr: "Détection, analyse et signalement des transactions suspectes",
              en: "Detection, analysis, and reporting of suspicious transactions",
            },
            {
              fr: "Gestion des alertes de conformité et des cas de fraude",
              en: "Management of compliance alerts and fraud cases",
            },
            {
              fr: "Interface avec les partenaires de paiement (PawaPay, FedaPay, etc.) sur les questions de conformité",
              en: "Interface with payment partners (PawaPay, FedaPay, etc.) on compliance matters",
            },
            {
              fr: "Supervision du processus KYC : vérification des pièces d'identité, photos en temps réel, GPS, signatures électroniques",
              en: "Supervision of the KYC process: identity verification, real-time photos, GPS, electronic signatures",
            },
            {
              fr: "Formation et sensibilisation des équipes sur les risques de blanchiment",
              en: "Training and awareness of teams on money laundering risks",
            },
            {
              fr: "Coordination avec les autorités réglementaires du Bénin si nécessaire",
              en: "Coordination with Beninese regulatory authorities if necessary",
            },
          ]}
        />

        <SectionTitle fr="Expérience Professionnelle" en="Professional Experience" />
        <div style={{ fontSize: 11, marginBottom: 12 }}>
          <div style={{ fontWeight: "bold", color: "#1a2e6b" }}>
            2025 – Présent / 2025 – Present
          </div>
          <div style={{ fontWeight: "bold" }}>
            Fondateur & Directeur Général / Founder & Managing Director — KEJA / BKApay, Bénin
          </div>
          <BulletList
            items={[
              {
                fr: "Conception, développement et déploiement de la plateforme de paiement mobile BKApay couvrant 17+ pays d'Afrique de l'Ouest",
                en: "Design, development, and deployment of the BKApay mobile payment platform covering 17+ West African countries",
              },
              {
                fr: "Mise en place des procédures KYC, AML/CFT et de sécurité des données",
                en: "Implementation of KYC, AML/CFT, and data security procedures",
              },
              {
                fr: "Gestion des intégrations avec les fournisseurs de paiement (FedaPay, MoneyFusion, PawaPay, AfribaPay, Paydunya, NOWPayments)",
                en: "Management of integrations with payment providers (FedaPay, MoneyFusion, PawaPay, AfribaPay, Paydunya, NOWPayments)",
              },
              {
                fr: "Responsabilité de la conformité réglementaire et des relations avec les partenaires financiers",
                en: "Responsibility for regulatory compliance and relationships with financial partners",
              },
            ]}
          />
        </div>

        <SectionTitle fr="Compétences Clés" en="Key Competencies" />
        <BulletList
          items={[
            {
              fr: "Conformité financière et réglementaire AML/CFT",
              en: "Financial and regulatory AML/CFT compliance",
            },
            {
              fr: "Technologies de paiement numérique et mobile money",
              en: "Digital payment technologies and mobile money",
            },
            {
              fr: "Gestion des risques financiers et opérationnels",
              en: "Financial and operational risk management",
            },
            {
              fr: "Développement de politiques de sécurité et KYC",
              en: "Development of security policies and KYC procedures",
            },
            {
              fr: "Négociation et gestion des partenariats fintech",
              en: "Negotiation and management of fintech partnerships",
            },
          ]}
        />

        <SectionTitle fr="Formation / Education" en="Education" />
        <Paragraph
          fr="Formation en technologies de l'information et en gestion d'entreprise numérique. Certifié en développement de plateformes de paiement et en conformité des services financiers."
          en="Training in information technology and digital business management. Certified in payment platform development and financial services compliance."
        />

        <SectionTitle fr="Déclaration du MRLO" en="MRLO Declaration" />
        <Paragraph
          fr="Je soussigné, Emali Juste Kpetekousso, déclare accepter officiellement la fonction de Responsable de la Lutte contre le Blanchiment et le Financement du Terrorisme (MRLO) de l'entreprise KEJA exploitant la marque BKApay, et m'engage à exercer ces fonctions avec diligence, intégrité et dans le respect des réglementations en vigueur."
          en="I, the undersigned, Emali Juste Kpetekousso, hereby officially accept the role of Money Laundering Reporting Officer (MRLO) of the company KEJA operating the BKApay brand, and commit to fulfilling these duties with diligence, integrity, and in compliance with applicable regulations."
        />
      </div>

      <SignatureBlock />
    </DocPage>
  );
}

function Document4_MerchantPortfolio() {
  const sectors = [
    {
      sector_fr: "E-commerce & Vente en ligne",
      sector_en: "E-commerce & Online Sales",
      pct: "45%",
      desc_fr:
        "Marchands vendant des produits physiques ou numériques en ligne via des liens de paiement BKApay. Ex : boutiques de vêtements, produits électroniques, alimentation, artisanat africain.",
      desc_en:
        "Merchants selling physical or digital products online via BKApay payment links. E.g., clothing stores, electronics, food, African crafts.",
    },
    {
      sector_fr: "Services Numériques & Freelance",
      sector_en: "Digital Services & Freelance",
      pct: "30%",
      desc_fr:
        "Prestataires de services numériques : développeurs, graphistes, consultants, agences web et marketing. Paiements pour des prestations de service, abonnements et licences logicielles.",
      desc_en:
        "Digital service providers: developers, designers, consultants, web and marketing agencies. Payments for services, subscriptions, and software licenses.",
    },
    {
      sector_fr: "Transferts Personnels & Envois de fonds",
      sector_en: "Personal Transfers & Remittances",
      pct: "20%",
      desc_fr:
        "Particuliers envoyant de l'argent à leurs proches à travers l'Afrique de l'Ouest. Transactions B2C et P2P via le système de liens de paiement ou transferts directs.",
      desc_en:
        "Individuals sending money to relatives across West Africa. B2C and P2P transactions via the payment link system or direct transfers.",
    },
    {
      sector_fr: "Autres Services",
      sector_en: "Other Services",
      pct: "5%",
      desc_fr:
        "Services d'éducation en ligne, santé, tourisme et autres activités légales compatibles avec la politique d'utilisation acceptable de BKApay.",
      desc_en:
        "Online education services, health, tourism, and other legal activities compatible with BKApay's acceptable use policy.",
    },
  ];

  return (
    <DocPage id="doc-portfolio">
      <DocumentHeader
        title="Répartition du Portefeuille Marchand — Merchant Portfolio Breakdown"
        subtitle="Secteurs d'activité couverts par BKApay / Business sectors covered by BKApay"
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <Paragraph
          fr="Ce document présente la répartition estimée du portefeuille marchand de BKApay par secteur d'activité, conformément à la demande de PawaPay dans le cadre du processus de conformité AML/CFT."
          en="This document presents BKApay's estimated merchant portfolio breakdown by business sector, as requested by PawaPay as part of the AML/CFT compliance process."
        />

        <div style={{ overflowX: "auto", marginTop: 20, marginBottom: 24 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "#1a2e6b", color: "#fff" }}>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>Secteur / Sector</th>
                <th style={{ padding: "8px 12px", textAlign: "center", width: 80 }}>% Estimé</th>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {sectors.map((s, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#f8f9fc" : "#fff" }}>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #e0e0e0", fontWeight: "bold", color: "#1a2e6b", verticalAlign: "top" }}>
                    {s.sector_fr}
                    <br />
                    <span style={{ fontStyle: "italic", fontWeight: "normal", color: "#555" }}>{s.sector_en}</span>
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #e0e0e0", textAlign: "center", fontWeight: "bold", fontSize: 16, color: "#1a2e6b", verticalAlign: "top" }}>
                    {s.pct}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #e0e0e0", color: "#111", lineHeight: 1.6, verticalAlign: "top" }}>
                    {s.desc_fr}
                    <br />
                    <span style={{ fontStyle: "italic", color: "#555" }}>{s.desc_en}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#1a2e6b", color: "#fff" }}>
                <td style={{ padding: "8px 12px", fontWeight: "bold" }}>TOTAL</td>
                <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: "bold", fontSize: 16 }}>100%</td>
                <td style={{ padding: "8px 12px" }}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <SectionTitle fr="Politique d'Utilisation Acceptable" en="Acceptable Use Policy" />
        <Paragraph
          fr="BKApay interdit formellement l'utilisation de sa plateforme pour toute activité illégale, frauduleuse ou contraire aux normes AML/CFT. Tout marchand ou utilisateur ne respectant pas ces conditions verra son compte immédiatement suspendu."
          en="BKApay strictly prohibits the use of its platform for any illegal, fraudulent, or AML/CFT non-compliant activity. Any merchant or user failing to comply with these conditions will have their account immediately suspended."
        />

        <SectionTitle fr="Volumes Transactionnels Estimés" en="Estimated Transaction Volumes" />
        <div style={{ fontSize: 11, position: "relative", zIndex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <thead>
              <tr style={{ background: "#e8ecf8" }}>
                <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 11 }}>Période / Period</th>
                <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 11 }}>Volume Estimé / Estimated Volume</th>
                <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 11 }}>Nb Transactions / No. Transactions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #e0e0e0" }}>Phase 1 (Mois 1-3 / Month 1-3)</td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #e0e0e0" }}>&lt; €5,000 / mois</td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #e0e0e0" }}>50 – 200 / mois</td>
              </tr>
              <tr style={{ background: "#f8f9fc" }}>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #e0e0e0" }}>Phase 2 (Mois 4-12 / Month 4-12)</td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #e0e0e0" }}>€5,000 – €50,000 / mois</td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #e0e0e0" }}>200 – 2,000 / mois</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 10px" }}>Phase 3 (An 2+ / Year 2+)</td>
                <td style={{ padding: "6px 10px" }}>€50,000 – €200,000 / mois</td>
                <td style={{ padding: "6px 10px" }}>2,000+ / mois</td>
              </tr>
            </tbody>
          </table>
        </div>

        <SectionTitle fr="Note sur la Cohérence du Nom de Marque" en="Note on Brand Name Consistency" />
        <Paragraph
          fr="L'entreprise enregistrée sous le nom légal KEJA opère la plateforme de paiement sous la marque commerciale BKApay. Cette marque a été développée spécifiquement pour le projet de paiement mobile. L'entreprise KEJA est l'unique propriétaire du nom de domaine bkapay.com et de tous les droits associés à la marque BKApay. Ces deux entités (KEJA et BKApay) désignent la même structure légale et le même propriétaire : M. Emali Juste Kpetekousso."
          en="The company registered under the legal name KEJA operates the payment platform under the commercial brand BKApay. This brand was specifically developed for the mobile payment project. KEJA is the sole owner of the domain name bkapay.com and all rights associated with the BKApay brand. These two entities (KEJA and BKApay) refer to the same legal structure and the same owner: Mr. Emali Juste Kpetekousso."
        />
      </div>

      <SignatureBlock />
    </DocPage>
  );
}

const DOCS = [
  {
    id: "aml-policy",
    title: "Politique AML/CFT",
    subtitle: "AML/CFT Policy & Procedures",
    icon: "📋",
    component: <Document1_AMLPolicy />,
  },
  {
    id: "questionnaire",
    title: "Questionnaire AML/CFT",
    subtitle: "Dûment complété / Duly completed",
    icon: "📝",
    component: <Document2_AMLQuestionnaire />,
  },
  {
    id: "mrlo-cv",
    title: "CV du MRLO",
    subtitle: "Emali Juste Kpetekousso",
    icon: "👤",
    component: <Document3_MRLO_CV />,
  },
  {
    id: "portfolio",
    title: "Portefeuille Marchand",
    subtitle: "Merchant Portfolio Breakdown",
    icon: "📊",
    component: <Document4_MerchantPortfolio />,
  },
];

export default function ComplianceDocs() {
  const [activeDoc, setActiveDoc] = useState<string | null>(null);

  const handlePrint = (docId: string) => {
    setActiveDoc(docId);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-target, .print-target * { visibility: visible !important; }
          .print-target {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print" style={{ background: "#f1f5f9", minHeight: "100vh", padding: "32px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" style={{ marginBottom: 20 }}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Retour
            </Button>
          </Link>

          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <img src={LOGO_URL} alt="BKApay" style={{ height: 60, objectFit: "contain", marginBottom: 12 }} />
            <h1 style={{ fontSize: 24, fontWeight: "bold", color: "#1a2e6b", margin: 0 }}>
              Documents de Conformité PawaPay
            </h1>
            <p style={{ color: "#555", fontSize: 14, marginTop: 8 }}>
              KEJA / BKApay — Onboarding AML/CFT
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 40 }}>
            {DOCS.map((doc) => (
              <div
                key={doc.id}
                style={{
                  background: "#fff",
                  borderRadius: 10,
                  padding: "20px 24px",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>
                  <FileText className="w-8 h-8 text-blue-800 inline" />
                </div>
                <div style={{ fontWeight: "bold", fontSize: 15, color: "#1a2e6b", marginBottom: 4 }}>
                  {doc.title}
                </div>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>{doc.subtitle}</div>
                <Button
                  size="sm"
                  onClick={() => handlePrint(doc.id)}
                  style={{ background: "#1a2e6b", color: "#fff", width: "100%" }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger PDF
                </Button>
              </div>
            ))}
          </div>

          <div style={{ background: "#fef3cd", border: "1px solid #ffd966", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#6b4c00", marginBottom: 32 }}>
            <strong>Instructions :</strong> Cliquez sur "Télécharger PDF" pour chaque document. Dans la fenêtre d'impression qui s'ouvre, sélectionnez <strong>"Enregistrer en PDF"</strong> comme destination. Désactivez les en-têtes/pieds de page de l'imprimante si nécessaire.
          </div>

          <div style={{ fontSize: 13, color: "#888", textAlign: "center" }}>
            Documents générés le {TODAY} — KEJA / BKApay | RCCM : RB/ABY/25 A 36549
          </div>
        </div>
      </div>

      {DOCS.map((doc) => (
        <div
          key={doc.id}
          className={activeDoc === doc.id ? "print-target" : "no-print"}
          style={{ display: activeDoc === doc.id ? "block" : "none" }}
        >
          {doc.component}
        </div>
      ))}
    </>
  );
}
