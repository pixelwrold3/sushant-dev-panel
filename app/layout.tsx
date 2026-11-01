import './globals.css';
import Navbar from '@/components/navigation/Navbar';
import CommandPalette from '@/components/palette/CommandPalette';
import GlobalChatWidget from '@/components/chat/GlobalChatWidget';

export const metadata = {
  title: 'DevPanel - Unified Developer & Server Management Panel',
  description: 'Production self-hosted Developer and Server Management Panel for Ubuntu Linux servers',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090d16] text-gray-100 antialiased selection:bg-blue-600 selection:text-white">
        <Navbar />
        <CommandPalette />
        <main className="flex-1 min-h-[calc(100vh-3.5rem)]">{children}</main>
        <GlobalChatWidget />
      </body>
    </html>
  );
}
