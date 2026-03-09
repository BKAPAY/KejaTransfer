import { useQuery, useMutation } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { COUNTRIES } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Check, X, ChevronLeft, FileText, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function KycField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || <span className="italic text-muted-foreground">—</span>}</p>
    </div>
  );
}

function DocPreview({ label, src }: { label: string; src?: string | null }) {
  if (!src) return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="aspect-video bg-muted rounded-md flex items-center justify-center border-2 border-dashed">
        <p className="text-xs text-muted-foreground">Non fourni</p>
      </div>
    </div>
  );
  const isImage = src.startsWith("data:image") || src.startsWith("http");
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {isImage ? (
        <img src={src} alt={label} className="rounded-md border w-full max-h-48 object-contain bg-muted" />
      ) : (
        <div className="rounded-md border p-4 bg-muted flex items-center gap-2">
          <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-sm">Document PDF</span>
          <a href={src} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline ml-auto">Ouvrir</a>
        </div>
      )}
    </div>
  );
}

export default function AdminBusinessKyc() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [kycDialogOpen, setKycDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/business/users"],
  });

  const kycUsers = users.filter(u => u.kycStatus === "submitted" || u.kycStatus === "pending");

  const verifyMutation = useMutation({
    mutationFn: async ({ userId, status, reason }: { userId: string; status: string; reason?: string }) => {
      await apiRequest("POST", `/api/admin/users/${userId}/kyc`, { status, rejectionReason: reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/users"] });
      setKycDialogOpen(false);
      setShowRejectInput(false);
      setRejectReason("");
      toast({ title: "Succès", description: "Statut KYC mis à jour" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const u = selectedUser as any;
  const getCountryName = (code?: string | null) => {
    if (!code) return "—";
    const c = COUNTRIES.find(c => c.code === code);
    return c ? `${c.flag} ${c.name}` : code;
  };
  const businessDocs: string[] = u?.kycBusinessDocuments ? (() => {
    try { return JSON.parse(u.kycBusinessDocuments); } catch { return []; }
  })() : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation("/dashboard/admin/business")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Vérifications KYC Entreprise</h1>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entreprise</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">Chargement...</TableCell>
              </TableRow>
            ) : kycUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Aucun dossier en attente
                </TableCell>
              </TableRow>
            ) : (
              kycUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.businessName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.kycStatus === "submitted" ? "secondary" : "outline"}>
                      {user.kycStatus === "submitted" ? "Soumis" : "En attente"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setSelectedUser(user); setKycDialogOpen(true); setShowRejectInput(false); setRejectReason(""); }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Examiner
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={kycDialogOpen} onOpenChange={setKycDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dossier KYC : {selectedUser?.businessName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Section 1: Compte */}
            <Section title="Informations du compte">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <KycField label="Prénom" value={selectedUser?.firstName} />
                <KycField label="Nom" value={selectedUser?.lastName} />
                <KycField label="Email" value={selectedUser?.email} />
                <KycField label="Nom de l'entreprise" value={selectedUser?.businessName} />
                <KycField label="Pays de l'entreprise" value={getCountryName((u as any)?.businessCountry)} />
                <KycField label="RCCM" value={(u as any)?.businessRegistrationNumber} />
                <KycField label="Tél. dirigeant" value={(u as any)?.businessPhone ? (() => {
                  const c = COUNTRIES.find(c => c.code === (u as any)?.businessCountry);
                  return c ? `${c.phoneCode} ${(u as any).businessPhone}` : (u as any).businessPhone;
                })() : null} />
                <KycField label="Tél. entreprise" value={(u as any)?.businessEnterprisePhone} />
                <KycField label="Email pro" value={(u as any)?.businessEmail} />
              </div>
            </Section>

            {/* Section 2: Legal */}
            <Section title="Informations légales">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <KycField label="N° compte entreprise" value={u?.kycBusinessAccountNumber} />
                <KycField label="N° fiscal (NIF/TIN)" value={u?.kycTaxId} />
                <KycField label="Adresse" value={u?.kycBusinessAddress} />
                <KycField label="Ville" value={u?.kycBusinessCity} />
                <KycField label="Département" value={u?.kycBusinessDepartment} />
                <div />
                <KycField label="N° pièce d'identité" value={u?.kycDirectorIdNumber} />
                <KycField label="Pays du dirigeant" value={getCountryName(u?.kycDirectorCountry)} />
                <KycField label="Date de naissance" value={u?.kycDirectorDob} />
                <KycField label="Date d'émission" value={u?.kycIdIssueDate} />
                <KycField label="Date d'expiration" value={u?.kycIdExpiryDate} />
              </div>
            </Section>

            {/* Section 3: Documents */}
            <Section title="Documents">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DocPreview label="Pièce d'identité — Recto" src={selectedUser?.kycIdFront} />
                <DocPreview label="Pièce d'identité — Verso" src={selectedUser?.kycIdBack} />
                <DocPreview label="Identification fiscale" src={u?.kycTaxDocument} />
                <DocPreview label="Justificatif d'adresse" src={u?.kycAddressDocument} />
              </div>

              {businessDocs.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-sm font-medium">Documents d'entreprise ({businessDocs.length})</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {businessDocs.map((doc, i) => (
                      <DocPreview key={i} label={`Document ${i + 1}`} src={doc} />
                    ))}
                  </div>
                </div>
              )}
            </Section>

            {/* Section 4: Description */}
            <Section title="Description de l'entreprise">
              <p className="text-sm whitespace-pre-wrap">
                {selectedUser?.kycActivityDescription || <span className="text-muted-foreground italic">Non fournie</span>}
              </p>
            </Section>

            {/* Reject input */}
            {showRejectInput && (
              <div className="space-y-2 p-4 border rounded-md bg-destructive/5">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  Motif du rejet
                </Label>
                <Input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Expliquez la raison du rejet..."
                  data-testid="input-rejection-reason"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t pt-4">
            {!showRejectInput ? (
              <>
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectInput(true)}
                  disabled={verifyMutation.isPending}
                  data-testid="button-reject-kyc"
                >
                  <X className="h-4 w-4 mr-2" /> Rejeter
                </Button>
                <Button
                  onClick={() => {
                    if (confirm(`Approuver le dossier de ${selectedUser?.businessName} ?`)) {
                      verifyMutation.mutate({ userId: selectedUser!.id, status: "verified" });
                    }
                  }}
                  disabled={verifyMutation.isPending}
                  data-testid="button-approve-kyc"
                >
                  <Check className="h-4 w-4 mr-2" /> Approuver
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setShowRejectInput(false)}>
                  Annuler
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => verifyMutation.mutate({ userId: selectedUser!.id, status: "rejected", reason: rejectReason })}
                  disabled={!rejectReason.trim() || verifyMutation.isPending}
                  data-testid="button-confirm-reject-kyc"
                >
                  <X className="h-4 w-4 mr-2" /> Confirmer le rejet
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide border-b pb-1">{title}</h3>
      <CardContent className="p-0">{children}</CardContent>
    </div>
  );
}
