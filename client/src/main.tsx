import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

const loader = document.getElementById("app-loading");
if (loader) {
  loader.style.opacity = "0";
  setTimeout(() => loader.remove(), 350);
}
