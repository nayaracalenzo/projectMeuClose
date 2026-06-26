import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import LoginPage from './pages/LoginPage';
import NotFound from './pages/NotFound';
import Customers from './pages/Customers';
import Orders from './pages/Orders';
import CustomerDetails from './pages/CustomerDetails';
import OrderDetails from './pages/OrderDetails';
import Registers from './pages/Registers';
import DashboardLayout from './pages/DashboardLayout';
import Dashboard from './pages/Dashboard';
import BankPage from './pages/BankPage';
import SalesPage from './pages/SalesPage';
import SaleDetailsPage from './pages/SaleDetailsPage';
import AdminPage from './pages/AdminPage';
import StoragePage from './pages/StoragePage';
import NewSalePage from './pages/NewSalePage';
import NewCustomer from './pages/NewCustomer';
import ReceivablesPage from './pages/ReceivablesPage';
import PayablesPage from './pages/PayablesPage';

function App() {
  return (
    <>
      <BrowserRouter>
      <Routes>
          <Route path="*" element={<NotFound />} />
          <Route index path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<DashboardLayout />}>
            <Route path='/admin' element={<AdminPage />} />
            <Route path='/home' element={<Dashboard />} />
            <Route path="/clientes" element={<Customers />} />
            <Route path="/cliente/:id" element={<CustomerDetails />} />
            <Route path="/pedidos" element={<Orders />} />
            <Route path="/pedido/:id" element={<OrderDetails />} />
            <Route path="/caixa" element={<Registers />} />
            <Route path="/vendas" element={<SalesPage />} />
            <Route path="/nova-venda" element={<NewSalePage />} />
            <Route path="/novo-cliente" element={<NewCustomer />} />
            <Route path="/venda/:id" element={<SaleDetailsPage/>} />
            <Route path="/banco" element={<BankPage />} />
            <Route path="/a-receber" element={<ReceivablesPage />} />
            <Route path="/a-pagar" element={<PayablesPage />} />
            <Route path="/estoque" element={<StoragePage/>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App
