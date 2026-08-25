import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Footer, Header } from "@/components/ui";

export const metadata: Metadata = {
  title: "FreshCart | Better groceries",
  description: "A modern grocery store experience",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <a className="skip-link" href="#main-content">
            Skip to main content
          </a>
          <Header />
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
