import { Component, type ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  countdown: number;
  reloading: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  private timer: ReturnType<typeof setInterval> | null = null;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, countdown: 5, reloading: false };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true, countdown: 5, reloading: false };
  }

  componentDidCatch() {
    this.startAutoReload();
  }

  startAutoReload() {
    this.timer = setInterval(() => {
      this.setState(prev => {
        if (prev.countdown <= 1) {
          clearInterval(this.timer!);
          return { countdown: 0, reloading: true };
        }
        return { countdown: prev.countdown - 1 };
      });
    }, 1000);

    this.reloadTimer = setTimeout(() => {
      window.location.reload();
    }, 5000);
  }

  componentWillUnmount() {
    if (this.timer) clearInterval(this.timer);
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
  }

  handleManualReload = () => {
    if (this.timer) clearInterval(this.timer);
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background gap-5 px-6 text-center">
        {this.state.reloading ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-base font-medium text-foreground">Rechargement en cours…</p>
          </>
        ) : (
          <>
            <RefreshCw className="h-10 w-10 text-primary" />
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">Une erreur est survenue</p>
              <p className="text-sm text-muted-foreground">
                La page va se recharger automatiquement dans{" "}
                <span className="font-bold text-primary">{this.state.countdown}s</span>
              </p>
            </div>
            <Button onClick={this.handleManualReload} size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Recharger maintenant
            </Button>
          </>
        )}
      </div>
    );
  }
}
