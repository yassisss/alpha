import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ALPHA TEAM",
  description: "ALPHA TEAM Platform",
  icons: {
    icon: "/alphateam.png",
    shortcut: "/alphateam.png",
    apple: "/alphateam.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('alphateam-theme');
                  if (saved === 'light') {
                    document.documentElement.classList.remove('dark');
                  } else {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener('contextmenu', function(e) {
                e.preventDefault();
              });
            `,
          }}
        />
      </head>
      <body className="app-bg text-slate-900 dark:text-slate-100 min-h-screen transition-colors duration-300">
        <main>{children}</main>
      </body>
    </html>
  );
}
