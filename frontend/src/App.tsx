import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import "./App.css";
import AdminPage from "./pages/AdminPage";
import BankPage from "./pages/BankPage";
import CustomerDetails from "./pages/CustomerDetails";
import Customers from "./pages/Customers";
import Dashboard from "./pages/Dashboard";
import DashboardLayout from "./pages/DashboardLayout";
import LoginPage from "./pages/LoginPage";
import NewCustomer from "./pages/NewCustomer";
import NewSalePage from "./pages/NewSalePage";
import NotFound from "./pages/NotFound";
import OrderDetails from "./pages/OrderDetails";
import Orders from "./pages/Orders";
import PayablesPage from "./pages/PayablesPage";
import ReceivablesPage from "./pages/ReceivablesPage";
import Registers from "./pages/Registers";
import SaleDetailsPage from "./pages/SaleDetailsPage";
import SalesPage from "./pages/SalesPage";
import StoragePage from "./pages/StoragePage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<NotFound />} />
        <Route index path="/" element={<Navigate to="/login" replace />} />
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/home" element={<Dashboard />} />
            <Route path="/clientes" element={<Customers />} />
            <Route path="/cliente/:id" element={<CustomerDetails />} />
            <Route path="/pedidos" element={<Navigate to="/producao" replace />} />
            <Route path="/producao" element={<Orders />} />
            <Route path="/pedido/:id" element={<OrderDetails />} />
            <Route path="/caixa" element={<Registers />} />
            <Route path="/vendas" element={<SalesPage />} />
            <Route path="/nova-venda" element={<NewSalePage />} />
            <Route path="/novo-cliente" element={<NewCustomer />} />
            <Route path="/venda/:id" element={<SaleDetailsPage />} />
            <Route path="/banco" element={<BankPage />} />
            <Route path="/a-receber" element={<ReceivablesPage />} />
            <Route path="/a-pagar" element={<PayablesPage />} />
            <Route path="/estoque" element={<StoragePage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
