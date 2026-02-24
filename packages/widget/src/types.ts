export type DocsAIMode = "modal" | "bubble" | "both";
export type DocsAITheme = "light" | "dark" | "auto";

export interface DocsAIInitConfig {
  projectId: string;
  apiBaseUrl?: string;
  apiKey?: string;
  mode?: DocsAIMode;
  theme?: DocsAITheme;
  target?: HTMLElement;
}

export interface DocsAIInstance {
  open: () => void;
  close: () => void;
  destroy: () => void;
}
