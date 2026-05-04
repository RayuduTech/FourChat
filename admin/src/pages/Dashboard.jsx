import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LogOut, Users, Key, AlertTriangle } from 'lucide-react';

const Dashboard = ({ token, logout }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [error, setError] = useState('');

  const api = axios.create({
    baseURL: 'http://localhost:5000/api',
    headers: { Authorization: `Bearer ${token}` }
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch (err) {
      if (err.response?.status === 403) {
        logout(); // Not an admin
      }
      console.error(err);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetMessage('');
    setError('');
    
    try {
      await api.post('/admin/reset-password', {
        userId: selectedUser.id,
        newPassword
      });
      setResetMessage(`Password successfully updated for ${selectedUser.username}`);
      setNewPassword('');
      setTimeout(() => setSelectedUser(null), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 p-6 flex flex-col">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">FourChat Admin</h1>
        </div>
        
        <nav className="flex-1 space-y-2">
          <button className="w-full flex items-center gap-3 bg-indigo-600/20 text-indigo-400 px-4 py-3 rounded-lg font-medium transition-colors border border-indigo-500/30">
            <Users size={20} />
            User Management
          </button>
        </nav>

        <button 
          onClick={logout}
          className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors mt-auto px-4 py-2"
        >
          <LogOut size={20} />
          Sign Out
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-10 overflow-y-auto">
        <div className="mb-8 flex justify-between items-center">
          <h2 className="text-3xl font-bold">Users Directory</h2>
          <div className="bg-gray-800 px-4 py-2 rounded-full border border-gray-700 text-sm">
            Total Users: <span className="font-bold text-indigo-400">{users.length}</span>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900/50 text-gray-400 text-sm uppercase tracking-wider border-b border-gray-700">
                <th className="p-4">ID</th>
                <th className="p-4">User</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-750 transition-colors">
                  <td className="p-4 text-gray-400">#{user.id}</td>
                  <td className="p-4">
                    <div className="font-medium text-white">{user.username}</div>
                    <div className="text-sm text-gray-400">{user.email}</div>
                  </td>
                  <td className="p-4">
                    {user.is_admin ? (
                      <span className="px-3 py-1 bg-purple-500/10 text-purple-400 rounded-full text-xs font-medium border border-purple-500/20">Admin</span>
                    ) : (
                      <span className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-xs font-medium">User</span>
                    )}
                  </td>
                  <td className="p-4">
                    {user.status === 'online' ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-green-400 text-sm">Online</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                        <span className="text-gray-400 text-sm">Offline</span>
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <button 
                      onClick={() => setSelectedUser(user)}
                      className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                    >
                      <Key size={16} />
                      Reset Password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Password Reset Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-2xl w-full max-w-md p-6 border border-gray-700 shadow-2xl">
            <h3 className="text-xl font-bold mb-1">Reset Password</h3>
            <p className="text-gray-400 text-sm mb-6">For user: <span className="text-white font-medium">{selectedUser.username}</span></p>
            
            {resetMessage && <div className="bg-green-500/10 text-green-400 p-3 rounded-lg mb-4 text-sm border border-green-500/20">{resetMessage}</div>}
            {error && <div className="bg-red-500/10 text-red-500 p-3 rounded-lg mb-4 text-sm border border-red-500/20">{error}</div>}

            <form onSubmit={handleResetPassword}>
              <div className="mb-6">
                <label className="text-sm font-medium text-gray-400 block mb-2">New Password</label>
                <input 
                  type="text" 
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter temporary password"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => { setSelectedUser(null); setResetMessage(''); setError(''); setNewPassword(''); }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg transition-colors shadow-lg shadow-indigo-600/30"
                >
                  Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
