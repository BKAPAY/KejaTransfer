import maintenanceImage from "@assets/maintenance-site-web_1773811871713.webp";
import { useLocation } from "wouter";

export default function MaintenancePage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <img
          src={maintenanceImage}
          alt="Maintenance en cours"
          className="w-full max-w-xs mx-auto"
          data-testid="img-maintenance"
        />
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-maintenance-title">
            Maintenance en cours
          </h1>
          <p className="text-muted-foreground text-base" data-testid="text-maintenance-message">
            Nous serons{" "}
            <span
              onClick={() => setLocation("/login")}
              style={{ cursor: "default", userSelect: "none" }}
              data-testid="span-maintenance-secret"
            >
              bientôt
            </span>{" "}
            de retour.
          </p>
        </div>
      </div>
    </div>
  );
}
