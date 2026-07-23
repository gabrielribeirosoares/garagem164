import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const THEME_KEY = "gm.theme_mode";

export function getThemePreference(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem(THEME_KEY) as Theme) || "system";
}

export function setThemePreference(theme: Theme) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, theme);
  window.dispatchEvent(new Event("gm-theme-change"));
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => getThemePreference());

  useEffect(() => {
    const handleThemeChange = () => {
      setTheme(getThemePreference());
    };
    window.addEventListener("gm-theme-change", handleThemeChange);
    window.addEventListener("storage", handleThemeChange);
    return () => {
      window.removeEventListener("gm-theme-change", handleThemeChange);
      window.removeEventListener("storage", handleThemeChange);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (t: Theme) => {
      if (t === "system") {
        const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (systemDark) {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      } else if (t === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    applyTheme(theme);

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => applyTheme("system");
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  return { theme, setTheme: setThemePreference };
}
