import "./globals.css"
import { Inter } from "next/font/google"
import { LayoutClient } from "@/components/layout-client"
import { Toaster } from "react-hot-toast"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Liffy UI",
  description: "Liffy Admin Panel",
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
