import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Background from './components/Background';
import Landing from './pages/Landing';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import DeleteAccount from './pages/DeleteAccount';
import Disclaimer from './pages/Disclaimer';
import AdminPortal from './pages/AdminPortal';

function App() {
  return (
    <BrowserRouter>
      {/* Permanent Premium Blur Orbs Backdrop */}
      <Background />
      
      {/* Dynamic SPA Routing */}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/disclaimer" element={<Disclaimer />} />
        <Route path="/delete-account" element={<DeleteAccount />} />
        <Route path="/delete_account.php" element={<DeleteAccount />} />
        <Route path="/admin" element={<AdminPortal />} />
        
        {/* Fallback to home */}
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
