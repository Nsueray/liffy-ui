import "./globals.css"
import { Inter } from "next/font/google"
import { LayoutClient } from "@/components/layout-client"
import { Toaster } from "react-hot-toast"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Liffy",
  description: "Liffy Admin Panel",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/favicon-180x180.png",
  },
}
 
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Toaster position="top-right" />
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>  
  )
}
