import { createI18n } from "vue-i18n";
import en from "./locales/en.json";
import zh from "./locales/zh.json";

// Web-only strings layered over the locale files copied verbatim from the
// desktop app (kept separate so the copies stay diffable against upstream).
const webEn = {
  webAuth: {
    signInWithPassword: "Sign in with Password",
    signInWithToken: "Sign in with Token",
    passwordTitle: "Sign in with Password",
    tokenTitle: "Sign in with Token",
    usernamePlaceholder: "Student ID",
    passwordPlaceholder: "Password",
    signIn: "Sign In",
    signingIn: "Signing in…",
    tokenPlaceholder: "Paste your Yanhekt token here",
    tokenConfirm: "Verify & Sign In",
    tokenHint:
      "Drag the button below to your bookmarks bar, open yanhekt.cn and sign in, then click the bookmark to fetch your token.",
    bookmarkletLabel: "Get AutoSlides Token",
    invalidToken: "Invalid token, please try again",
    passwordDisclaimer:
      "Your credentials are only used to sign in to school SSO and are never stored.",
  },
};

const webZh = {
  webAuth: {
    signInWithPassword: "密码登录",
    signInWithToken: "Token 登录",
    passwordTitle: "密码登录",
    tokenTitle: "Token 登录",
    usernamePlaceholder: "学号",
    passwordPlaceholder: "密码",
    signIn: "登录",
    signingIn: "登录中…",
    tokenPlaceholder: "在此粘贴延河课堂 Token",
    tokenConfirm: "验证并登录",
    tokenHint: "将下方按钮拖到书签栏，打开延河课堂并登录后，点击该书签即可获取 Token。",
    bookmarkletLabel: "获取 AutoSlides Token",
    invalidToken: "Token 无效，请重试",
    passwordDisclaimer: "您的账号密码仅用于登录学校统一身份认证，不会被存储。",
  },
};

export type MessageSchema = typeof en;
export type AppLocale = "en" | "zh";

const STORAGE_KEY = "autoslides.locale";

function detectLocale(): AppLocale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "zh") return stored;
  const systemLang = navigator.language || navigator.languages?.[0] || "en";
  return systemLang.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: "en",
  messages: { en: { ...en, ...webEn }, zh: { ...zh, ...webZh } },
  globalInjection: true,
});

export function setLocale(locale: AppLocale) {
  i18n.global.locale.value = locale;
  localStorage.setItem(STORAGE_KEY, locale);
}

export function getCurrentLocale(): AppLocale {
  return i18n.global.locale.value as AppLocale;
}
