import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "@/components/theme-provider";

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    // Check for updates periodically when tab is visible
    if (!registration) return;
    setInterval(
      () => {
        void registration.update();
      },
      60 * 60 * 1000
    );
  },
});

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
    <App />
  </ThemeProvider>
);
