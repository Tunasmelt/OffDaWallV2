import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";

const geistSansGoogle = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMonoGoogle = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const geistSansLocal = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  display: "swap",
  weight: "100 900",
});

const geistMonoLocal = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "100 900",
});

const explicitLocal = process.env.USE_LOCAL_FONTS === "1";
const explicitGoogle = process.env.USE_LOCAL_FONTS === "0";
const useLocalFonts =
  explicitLocal || (!explicitGoogle && process.env.NODE_ENV === "production");

export const appFonts = {
  sans: useLocalFonts ? geistSansLocal : geistSansGoogle,
  mono: useLocalFonts ? geistMonoLocal : geistMonoGoogle,
};
