import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
// Le splash screen est retiré par AppSplashController dans App.tsx
// quand auth + maintenance sont tous les deux résolus.
