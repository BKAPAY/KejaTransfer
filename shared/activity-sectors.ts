export interface ActivitySubSector {
  code: string;
  label: string;
}

export interface ActivitySector {
  code: string;
  label: string;
  subSectors: ActivitySubSector[];
}

export const ACTIVITY_SECTORS: ActivitySector[] = [
  {
    code: "commerce_vente",
    label: "Commerce et Vente",
    subSectors: [
      { code: "commerce_general", label: "Commerce général" },
      { code: "boutique_physique", label: "Boutique physique" },
      { code: "commerce_detail", label: "Commerce de détail" },
      { code: "commerce_gros", label: "Commerce de gros" },
      { code: "supermarche_epicerie", label: "Supermarché / Épicerie" },
      { code: "import_export", label: "Import / Export" },
      { code: "marketplace", label: "Marketplace" },
      { code: "vente_reseaux_sociaux", label: "Vente sur réseaux sociaux" },
    ],
  },
  {
    code: "ecommerce",
    label: "E-commerce",
    subSectors: [
      { code: "boutique_en_ligne", label: "Boutique en ligne" },
      { code: "marketplace_en_ligne", label: "Marketplace en ligne" },
      { code: "vente_produits_numeriques", label: "Vente de produits numériques" },
      { code: "vente_logiciels", label: "Vente de logiciels" },
      { code: "vente_licences", label: "Vente de licences" },
      { code: "vente_formations_en_ligne", label: "Vente de formations en ligne" },
      { code: "vente_abonnements", label: "Vente d'abonnements" },
      { code: "print_on_demand", label: "Print on Demand" },
    ],
  },
  {
    code: "technologie_informatique",
    label: "Technologie et Informatique",
    subSectors: [
      { code: "developpement_logiciel", label: "Développement logiciel" },
      { code: "saas", label: "SaaS" },
      { code: "developpement_web", label: "Développement web" },
      { code: "developpement_mobile", label: "Développement mobile" },
      { code: "hebergement_web", label: "Hébergement web" },
      { code: "cybersecurite", label: "Cybersécurité" },
      { code: "intelligence_artificielle", label: "Intelligence artificielle" },
      { code: "maintenance_informatique", label: "Maintenance informatique" },
      { code: "services_informatiques", label: "Services informatiques" },
    ],
  },
  {
    code: "education_formation",
    label: "Éducation et Formation",
    subSectors: [
      { code: "centre_formation", label: "Centre de formation" },
      { code: "formation_professionnelle", label: "Formation professionnelle" },
      { code: "formation_en_ligne", label: "Formation en ligne" },
      { code: "coaching", label: "Coaching" },
      { code: "tutorat", label: "Tutorat" },
      { code: "elearning", label: "E-learning" },
    ],
  },
  {
    code: "sante_medical",
    label: "Santé et Médical",
    subSectors: [
      { code: "clinique", label: "Clinique" },
      { code: "cabinet_medical", label: "Cabinet médical" },
      { code: "cabinet_dentaire", label: "Cabinet dentaire" },
      { code: "pharmacie", label: "Pharmacie" },
      { code: "laboratoire_medical", label: "Laboratoire médical" },
      { code: "optique", label: "Optique" },
      { code: "telemedecine", label: "Télémédecine" },
    ],
  },
  {
    code: "transport_logistique",
    label: "Transport et Logistique",
    subSectors: [
      { code: "livraison", label: "Livraison" },
      { code: "logistique", label: "Logistique" },
      { code: "messagerie", label: "Messagerie" },
      { code: "transport_marchandises", label: "Transport de marchandises" },
      { code: "transport_personnes", label: "Transport de personnes" },
      { code: "taxi", label: "Taxi" },
      { code: "vtc", label: "VTC" },
      { code: "location_vehicules", label: "Location de véhicules" },
    ],
  },
  {
    code: "hotellerie_tourisme",
    label: "Hôtellerie et Tourisme",
    subSectors: [
      { code: "hotel", label: "Hôtel" },
      { code: "auberge", label: "Auberge" },
      { code: "maison_hotes", label: "Maison d'hôtes" },
      { code: "residence_hoteliere", label: "Résidence hôtelière" },
      { code: "agence_voyage", label: "Agence de voyage" },
      { code: "tour_operateur", label: "Tour opérateur" },
      { code: "location_saisonniere", label: "Location saisonnière" },
    ],
  },
  {
    code: "restauration_alimentation",
    label: "Restauration et Alimentation",
    subSectors: [
      { code: "restaurant", label: "Restaurant" },
      { code: "fast_food", label: "Fast-food" },
      { code: "cafe", label: "Café" },
      { code: "boulangerie", label: "Boulangerie" },
      { code: "patisserie", label: "Pâtisserie" },
      { code: "glacier", label: "Glacier" },
      { code: "traiteur", label: "Traiteur" },
      { code: "livraison_repas", label: "Livraison de repas" },
    ],
  },
  {
    code: "immobilier",
    label: "Immobilier",
    subSectors: [
      { code: "agence_immobiliere", label: "Agence immobilière" },
      { code: "gestion_locative", label: "Gestion locative" },
      { code: "location_immobiliere", label: "Location immobilière" },
      { code: "promotion_immobiliere", label: "Promotion immobilière" },
      { code: "services_immobiliers", label: "Services immobiliers" },
    ],
  },
  {
    code: "btp_construction",
    label: "BTP et Construction",
    subSectors: [
      { code: "construction", label: "Construction" },
      { code: "architecture", label: "Architecture" },
      { code: "genie_civil", label: "Génie civil" },
      { code: "bureau_etudes", label: "Bureau d'études" },
      { code: "electricite_batiment", label: "Électricité bâtiment" },
      { code: "plomberie", label: "Plomberie" },
      { code: "menuiserie", label: "Menuiserie" },
      { code: "peinture", label: "Peinture" },
      { code: "renovation", label: "Rénovation" },
    ],
  },
  {
    code: "industrie_fabrication",
    label: "Industrie et Fabrication",
    subSectors: [
      { code: "industrie_manufacturiere", label: "Industrie manufacturière" },
      { code: "production_industrielle", label: "Production industrielle" },
      { code: "assemblage", label: "Assemblage" },
      { code: "textile", label: "Textile" },
      { code: "confection", label: "Confection" },
      { code: "imprimerie", label: "Imprimerie" },
      { code: "fabrication_meubles", label: "Fabrication de meubles" },
      { code: "transformation_industrielle", label: "Transformation industrielle" },
    ],
  },
  {
    code: "medias_communication",
    label: "Médias et Communication",
    subSectors: [
      { code: "marketing_digital", label: "Marketing digital" },
      { code: "publicite", label: "Publicité" },
      { code: "agence_communication", label: "Agence de communication" },
      { code: "production_audiovisuelle", label: "Production audiovisuelle" },
      { code: "creation_contenu", label: "Création de contenu" },
      { code: "presse", label: "Presse" },
      { code: "radio", label: "Radio" },
      { code: "television", label: "Télévision" },
    ],
  },
  {
    code: "evenementiel_divertissement",
    label: "Événementiel et Divertissement",
    subSectors: [
      { code: "organisation_evenements", label: "Organisation d'événements" },
      { code: "concerts", label: "Concerts" },
      { code: "festivals", label: "Festivals" },
      { code: "production_musicale", label: "Production musicale" },
      { code: "cinema", label: "Cinéma" },
      { code: "theatre", label: "Théâtre" },
    ],
  },
  {
    code: "services_professionnels",
    label: "Services Professionnels",
    subSectors: [
      { code: "cabinet_juridique", label: "Cabinet juridique" },
      { code: "cabinet_comptable", label: "Cabinet comptable" },
      { code: "audit", label: "Audit" },
      { code: "conseil", label: "Conseil" },
      { code: "ressources_humaines", label: "Ressources humaines" },
      { code: "recrutement", label: "Recrutement" },
      { code: "traduction", label: "Traduction" },
      { code: "services_professionnels", label: "Services professionnels" },
    ],
  },
  {
    code: "beaute_bien_etre",
    label: "Beauté et Bien-être",
    subSectors: [
      { code: "salon_coiffure", label: "Salon de coiffure" },
      { code: "institut_beaute", label: "Institut de beauté" },
      { code: "spa", label: "Spa" },
      { code: "cosmetique", label: "Cosmétique" },
      { code: "parfumerie", label: "Parfumerie" },
      { code: "salle_sport", label: "Salle de sport" },
      { code: "fitness", label: "Fitness" },
    ],
  },
  {
    code: "mode_accessoires",
    label: "Mode et Accessoires",
    subSectors: [
      { code: "vetements", label: "Vêtements" },
      { code: "chaussures", label: "Chaussures" },
      { code: "bijoux", label: "Bijoux" },
      { code: "montres", label: "Montres" },
      { code: "accessoires_mode", label: "Accessoires de mode" },
      { code: "maroquinerie", label: "Maroquinerie" },
    ],
  },
  {
    code: "automobile",
    label: "Automobile",
    subSectors: [
      { code: "vente_vehicules", label: "Vente de véhicules" },
      { code: "garage", label: "Garage" },
      { code: "carrosserie", label: "Carrosserie" },
      { code: "pieces_detachees", label: "Pièces détachées" },
      { code: "lavage_automobile", label: "Lavage automobile" },
      { code: "location_vehicules_auto", label: "Location de véhicules" },
    ],
  },
  {
    code: "services_personne",
    label: "Services à la Personne",
    subSectors: [
      { code: "menage", label: "Ménage" },
      { code: "nettoyage", label: "Nettoyage" },
      { code: "gardiennage", label: "Gardiennage" },
      { code: "conciergerie", label: "Conciergerie" },
      { code: "assistance_personnelle", label: "Assistance personnelle" },
    ],
  },
  {
    code: "freelance_independants",
    label: "Freelance et Indépendants",
    subSectors: [
      { code: "developpeur_freelance", label: "Développeur freelance" },
      { code: "designer_freelance", label: "Designer freelance" },
      { code: "consultant_independant", label: "Consultant indépendant" },
      { code: "createur_contenu", label: "Créateur de contenu" },
      { code: "prestataire_services", label: "Prestataire de services" },
      { code: "entrepreneur_individuel", label: "Entrepreneur individuel" },
    ],
  },
  {
    code: "autre",
    label: "Autre",
    subSectors: [
      { code: "autre_activite", label: "Autre activité commerciale" },
    ],
  },
];

export function getSectorLabel(sectorCode: string): string {
  return ACTIVITY_SECTORS.find(s => s.code === sectorCode)?.label || sectorCode;
}

export function getSubSectorLabel(sectorCode: string, subSectorCode: string): string {
  const sector = ACTIVITY_SECTORS.find(s => s.code === sectorCode);
  return sector?.subSectors.find(ss => ss.code === subSectorCode)?.label || subSectorCode;
}

export function getSubSectorsForSector(sectorCode: string): ActivitySubSector[] {
  return ACTIVITY_SECTORS.find(s => s.code === sectorCode)?.subSectors || [];
}
