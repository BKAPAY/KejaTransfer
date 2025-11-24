import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Phone, ChevronDown } from "lucide-react";
import { useState } from "react";

const faqs = [
  {
    question: "Comment créer un lien de paiement?",
    answer: "Allez à la section 'Lien de paiement' dans votre tableau de bord, cliquez sur 'Nouveau lien', remplissez les informations (montant, description) et générez votre lien. Vous pouvez ensuite partager ce lien avec vos clients."
  },
  {
    question: "Quels sont les opérateurs mobiles supportés?",
    answer: "BKApay supporte les principaux opérateurs mobiles de l'Afrique de l'Ouest : Orange Money, MTN, Moov, Wave, Free Money, T-Money, Wizall et Expresso. La disponibilité dépend du pays du client."
  },
  {
    question: "Combien de temps prend le traitement d'un paiement?",
    answer: "La plupart des paiements sont traités instantanément. Cependant, certaines transactions peuvent prendre jusqu'à 24 heures selon l'opérateur mobile et votre réseau."
  },
  {
    question: "Comment générer des clés API?",
    answer: "Accédez à la section 'API' de votre tableau de bord et cliquez sur 'Générer une clé'. Vous recevrez une clé publique et une clé privée à conserver en sécurité."
  },
  {
    question: "Quels sont les frais appliqués?",
    answer: "Les frais varient selon le pays : 3% au Bénin et 6% dans les autres pays supportés. Ces frais s'appliquent à tous les paiements entrants et transferts sortants."
  },
  {
    question: "Comment effectuer un retrait (transfert)?",
    answer: "Allez à la section 'Transfert' de votre tableau de bord, sélectionnez votre opérateur mobile et le pays de destination, entrez le montant et le numéro de destinataire, puis validez la transaction."
  },
  {
    question: "Mes fonds sont-ils sécurisés?",
    answer: "Oui, tous les fonds sont stockés en toute sécurité sur notre plateforme. Nous utilisons le protocole de paiement Paydunya qui garantit la sécurité de chaque transaction."
  },
  {
    question: "Comment modifier mon profil?",
    answer: "Cliquez sur 'Profil' dans le menu de gauche, modifiez vos informations personnelles et cliquez sur 'Enregistrer' pour appliquer les changements."
  }
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
        data-testid={`faq-question-${question}`}
      >
        <span className="text-sm font-medium text-left">{question}</span>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 ml-2 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="px-4 py-3 border-t bg-muted/30">
          <p className="text-sm text-muted-foreground">{answer}</p>
        </div>
      )}
    </div>
  );
}

export default function Support() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Support</h1>
        <p className="text-sm text-muted-foreground">Nous sommes là pour vous aider</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="hover-elevate">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-primary" />
              </div>
              <CardTitle className="text-sm">Email</CardTitle>
            </div>
            <CardDescription className="text-xs">Contactez-nous</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <p className="text-muted-foreground">Réponse en 24h</p>
            <Button variant="outline" size="sm" className="w-full" data-testid="button-email-support">
              <Mail className="w-3 h-3 mr-1" />
              support@bkapay.com
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Phone className="w-4 h-4 text-primary" />
              </div>
              <CardTitle className="text-sm">Téléphone</CardTitle>
            </div>
            <CardDescription className="text-xs">Appelez-nous</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <p className="text-muted-foreground">Lun-Ven 9h-18h</p>
            <Button variant="outline" size="sm" className="w-full" data-testid="button-phone">
              <Phone className="w-3 h-3 mr-1" />
              +2290146447319
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Questions Fréquentes</CardTitle>
          <CardDescription>Trouvez les réponses à vos questions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {faqs.map((faq, index) => (
              <FAQItem key={index} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
