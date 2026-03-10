import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";

/**
 * AutoDarkMode
 * - Checks every 60s if the local time (in America/Sao_Paulo) is >= 18:30.
 * - Shows a dismissible popup once per session suggesting the user to switch to dark mode.
 * - The user can accept (switch) or dismiss.
 */
export function AutoDarkMode() {
    const { theme, setTheme } = useTheme();
    const [showPopup, setShowPopup] = useState(false);
    const dismissedRef = useRef(false);

    useEffect(() => {
        // Don't bother if already in dark mode
        if (theme === "dark") return;

        const checkTime = () => {
            // Already suggested this session
            if (dismissedRef.current) return;

            // Get current time in Brasilia (America/Sao_Paulo, UTC-3)
            const now = new Date();
            const brasiliaTime = new Date(
                now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
            );
            const hours = brasiliaTime.getHours();
            const minutes = brasiliaTime.getMinutes();

            // If it's past 18:30, show popup
            if (hours > 18 || (hours === 18 && minutes >= 30)) {
                setShowPopup(true);
            }
        };

        // Check immediately on mount
        checkTime();

        // Then check every 60 seconds
        const interval = setInterval(checkTime, 60_000);

        return () => clearInterval(interval);
    }, [theme]);

    const handleAccept = () => {
        setTheme("dark");
        setShowPopup(false);
        dismissedRef.current = true;
    };

    const handleDismiss = () => {
        setShowPopup(false);
        dismissedRef.current = true;
    };

    return (
        <AnimatePresence>
            {showPopup && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.9 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="fixed bottom-24 lg:bottom-8 right-4 z-[300] max-w-xs"
                >
                    <div className="bg-card border border-border rounded-2xl shadow-2xl p-5 space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                                <Moon className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-sm text-foreground">Modo Escuro</p>
                                <p className="text-xs text-muted-foreground">Já são 18:30! Deseja ativar?</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-xs"
                                onClick={handleDismiss}
                            >
                                Agora não
                            </Button>
                            <Button
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={handleAccept}
                            >
                                Ativar
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
