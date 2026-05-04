import React, { useState, useEffect } from 'react';
import AdminLogin from './pages/AdminLogin';
import Dashboard from './pages/Dashboard';

function App() {
  const [token, setToken] = useState(localStorage.getItem('admin_token'));

  const logout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
  };

  if (!token) {
    return <AdminLogin setToken={setToken} />;
  }

  return <Dashboard token={token} logout={logout} />;
}

export default App;
