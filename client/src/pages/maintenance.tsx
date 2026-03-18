import maintenanceImage from "@assets/maintenance-site-web_1773811871713.webp";

export default function MaintenancePage() {
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
            Notre plateforme est en cours de maintenance pour vous offrir une meilleure experience.
            Nous serons bientot de retour.
          </p>
          <p className="text-sm text-muted-foreground">
            Merci pour votre patience et votre comprehension.
          </p>
        </div>
      </div>
    </div>
  );
}
