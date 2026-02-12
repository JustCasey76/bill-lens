import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SessionWrapper } from "@/components/SessionWrapper";
import { FirebaseAnalytics } from "@/components/FirebaseAnalytics";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "BillLens | Automated Legislation Tracker & Fact Checker",
    description: "Track US Congress bills, read AI summaries with citations, and verify viral claims.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `try{if(localStorage.theme==='dark'||(!localStorage.theme&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`,
                    }}
                />
            </head>
            <body className={`${inter.className} min-h-screen flex flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased`} suppressHydrationWarning>
                <SessionWrapper>
                    <ThemeProvider>
                        <FirebaseAnalytics />
                        <Navbar />
                        <main className="flex-grow">
                            {children}
                        </main>
                        <Footer />
                    </ThemeProvider>
                </SessionWrapper>
            </body>
        </html>
    );
}
