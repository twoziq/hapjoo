import "./globals.css";

export const metadata = {
  title: "합주",
  description: "기타 코드 악보 & 튜너",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
