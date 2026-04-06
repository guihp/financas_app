import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Pages
import Auth from "./pages/Auth";
import AdminSupremoFinancas from "./pages/AdminSupremoFinancas";
import NotFound from "./pages/NotFound";
import DashPage from "./pages/DashPage";
import TransactionsPage from "./pages/TransactionsPage";
import ExtratosPage from "./pages/ExtratosPage";
import StatsPage from "./pages/StatsPage";
import AgendaPage from "./pages/AgendaPage";
import CategoriasPage from "./pages/CategoriasPage";
import AlterarSenhaPage from "./pages/AlterarSenhaPage";
import PagamentoPendente from "./pages/PagamentoPendente";
import Assinatura from "./pages/Assinatura";
import SharingPage from "./pages/SharingPage";
import CartoesPage from "./pages/CartoesPage";
import FaturasPage from "./pages/FaturasPage";
import ListaComprasPage from "./pages/ListaComprasPage";
import ApiDocsPage from "./pages/ApiDocsPage";
import ResetPassword from "./pages/ResetPassword";
import CaixinhasPage from "./pages/CaixinhasPage";
import OrcamentosPage from "./pages/OrcamentosPage";

// Components
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Rotas públicas */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/cadastro" element={<Auth defaultTab="signup" />} />
          <Route path="/pagamento-pendente" element={<PagamentoPendente />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/api-docs" element={<ApiDocsPage />} />

          {/* Rotas protegidas com layout compartilhado */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dash" element={<DashPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/extratos" element={<ExtratosPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/categorias" element={<CategoriasPage />} />
            {/* <Route path="/caixinha" element={<CaixinhasPage />} />
            <Route path="/orcamentos" element={<OrcamentosPage />} /> */}
            <Route path="/sharing" element={<SharingPage />} />
            <Route path="/cartoes" element={<CartoesPage />} />
            <Route path="/faturas" element={<FaturasPage />} />
            {/* <Route path="/lista-compras" element={<ListaComprasPage />} /> */}
            <Route path="/alterar-senha" element={<AlterarSenhaPage />} />
            <Route path="/assinatura" element={<Assinatura />} />
            <Route path="/admin/supremo/iafe/financas" element={<AdminSupremoFinancas />} />
          </Route>

          {/* Redirecionar raiz para dashboard */}
          <Route path="/" element={<Navigate to="/dash" replace />} />

          {/* Rota 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
