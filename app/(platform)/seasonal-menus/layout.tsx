import { Cormorant_Garamond, Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-seasonal-title",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-seasonal-body",
  display: "swap",
});

export default function SeasonalMenusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${playfair.variable} ${cormorant.variable} min-h-0`}
      style={{
        fontFamily: "var(--font-seasonal-body), Georgia, serif",
      }}
    >
      {children}
    </div>
  );
}
