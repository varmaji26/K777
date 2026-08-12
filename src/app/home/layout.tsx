
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 bg-background">
        {children}
      </main>
      <Footer />
    </div>
  );
}
