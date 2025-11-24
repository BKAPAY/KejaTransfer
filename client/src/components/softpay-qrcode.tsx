import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface SoftPayQRCodeProps {
  paymentUrl: string;
  amount: number;
  operator: string;
  status: "pending" | "success" | "failed";
  message?: string;
}

export function SoftPayQRCode({ paymentUrl, amount, operator, status, message }: SoftPayQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && paymentUrl) {
      QRCode.toCanvas(canvasRef.current, paymentUrl, {
        width: 280,
        margin: 10,
        color: {
          dark: "#228B22",
          light: "#FFFFFF",
        },
      });
    }
  }, [paymentUrl]);

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <CardTitle>Scannez pour payer</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="bg-white p-4 rounded-lg">
          <canvas ref={canvasRef} />
        </div>

        <div className="text-center space-y-2 w-full">
          <p className="text-sm text-muted-foreground">
            Montant: <span className="font-semibold">{amount.toLocaleString('fr-FR')} XOF</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Opérateur: <span className="font-semibold">{operator}</span>
          </p>
        </div>

        {status === "success" && (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-md w-full">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium">Paiement confirmé!</span>
          </div>
        )}

        {status === "failed" && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-md w-full">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{message || "Paiement échoué"}</span>
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center">
          <p>Scannez ce code avec votre téléphone pour effectuer le paiement</p>
          <p>Vous restez sur BKApay - paiement entièrement sécurisé</p>
        </div>
      </CardContent>
    </Card>
  );
}
