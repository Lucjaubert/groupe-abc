export {};

declare global {
  interface Window {
    Weglot?: {
      initialized?: boolean;
      refresh?: () => void;
      switchTo?: (code: string) => void;
      getCurrentLanguage?: () => string;
      on?: (event: string, cb: (...args: any[]) => void) => void;
    };
  }
}
