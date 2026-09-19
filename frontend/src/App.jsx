import { Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ProductDetails from './pages/ProductDetails';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="text-lg font-semibold text-gray-900 hover:text-blue-600">
            INE Price Tracker
          </Link>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/product/:id" element={<ProductDetails />} />
        </Routes>
      </main>
    </div>
  );
}
