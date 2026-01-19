import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import LoginPage from './pages/LoginPage';
import NotFound from './pages/NotFound';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Orders from './pages/Orders';
import CustomerDetails from './pages/CustomerDetails';
import OrderDetails from './pages/OrderDetails';
import Registers from './pages/Registers';

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<NotFound />} />
          <Route index path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage/>} />
          <Route path="/dashboard" element={<Dashboard/>} />
          <Route path="/clientes" element={<Customers/>} />
          <Route path="/cliente/:id" element={<CustomerDetails/>} />
          <Route path="/pedidos" element={<Orders/>} />
          <Route path="/pedido/:id" element={<OrderDetails/>} />
          <Route path="/caixa" element={<Registers/>} />
          
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App
