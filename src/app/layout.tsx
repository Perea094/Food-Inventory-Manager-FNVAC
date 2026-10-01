import type { Metadata } from 'next';
import './globals.css';
import Navbar from '../components/Navbar.tsx';

export const metadata: Metadata = {
  title: 'Fundación Nutrición y Vida A.C. | CEDIS Celaya - Inventario FEFO y Rutas',
  description:
    'Plataforma integral de control de inventario con semáforo FEFO estricto y ruteo logístico para el Banco de Alimentos de Celaya, Guanajuato.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased selection:bg-fnvac-blue-100 selection:text-fnvac-blue-900">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </main>
        <footer className="mt-auto border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 no-print">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>
              &copy; {new Date().getFullYear()} Fundación Nutrición y Vida A.C. &bull; Banco de Alimentos Celaya
            </p>
            <p className="text-slate-400">
              Sistema de Trazabilidad FEFO, Control de Caducidades y Optimización Logística
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
