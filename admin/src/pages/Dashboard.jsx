import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { LogOut, Users, Key, AlertTriangle, Search, Unlock, ChevronUp, ChevronDown, Filter } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const Dashboard = ({ token, logout }) => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [error, setError] = useState('');
  
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });
  const [filters, setFilters] = useState({ role: '', status: '', accountStatus: '' });

  const api = axios.create({
    baseURL: 'http://localhost:5000/api',
    headers: { Authorization: `Bearer ${token}` }
  });

  useEffect(() => {
    fetchUsers();
    
    // Refresh the user list every 10 minutes
    const intervalId = setInterval(() => {
      fetchUsers();
    }, 10 * 60 * 1000);
    
    return () => clearInterval(intervalId);
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

  const handleUnlockAccount = async (userId) => {
    try {
      await api.put(`/admin/users/${userId}/unlock`);
      toast.success('Account successfully unlocked!');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to unlock account');
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedUsers = useMemo(() => {
    let result = users;

    // Search filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase().replace(/^#/, ''); // Allow searching by "#9" or "9"
      result = result.filter(u => 
        u.username.toLowerCase().includes(lowerSearch) || 
        u.email.toLowerCase().includes(lowerSearch) ||
        u.id.toString().includes(lowerSearch)
      );
    }

    // Column filters
    if (filters.role) {
      if (filters.role === 'admin') result = result.filter(u => u.is_admin);
      else if (filters.role === 'user') result = result.filter(u => !u.is_admin);
    }
    if (filters.status) {
      result = result.filter(u => u.status === filters.status);
    }
    if (filters.accountStatus) {
      if (filters.accountStatus === 'locked') {
        result = result.filter(u => u.locked_until && new Date(u.locked_until) > new Date());
      } else if (filters.accountStatus === 'active') {
        result = result.filter(u => !u.locked_until || new Date(u.locked_until) <= new Date());
      }
    }

    // Sorting
    result = [...result].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      // Special handling for derived columns
      if (sortConfig.key === 'accountStatus') {
        aVal = a.locked_until && new Date(a.locked_until) > new Date() ? 1 : 0;
        bVal = b.locked_until && new Date(b.locked_until) > new Date() ? 1 : 0;
      }
      if (sortConfig.key === 'role') {
        aVal = a.is_admin ? 1 : 0;
        bVal = b.is_admin ? 1 : 0;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [users, searchTerm, filters, sortConfig]);

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
        <Toaster position="top-right" />
        <div className="mb-8 flex justify-between items-center">
          <h2 className="text-3xl font-bold">Users Directory</h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search users..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 w-64"
              />
            </div>
            <div className="bg-gray-800 px-4 py-2 rounded-full border border-gray-700 text-sm">
              Total Users: <span className="font-bold text-indigo-400">{users.length}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900/50 text-gray-400 text-sm uppercase tracking-wider border-b border-gray-700">
                <th className="p-4 cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => handleSort('id')}>
                  <div className="flex items-center gap-1">ID {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => handleSort('username')}>
                  <div className="flex items-center gap-1">User {sortConfig.key === 'username' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div>
                </th>
                <th className="p-4">
                  <div className="flex flex-col gap-2">
                    <div className="cursor-pointer flex items-center gap-1" onClick={() => handleSort('role')}>
                      Role {sortConfig.key === 'role' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}
                    </div>
                    <select 
                      className="bg-gray-800 border border-gray-700 text-xs rounded p-1 text-gray-300 w-full"
                      value={filters.role}
                      onChange={e => setFilters({...filters, role: e.target.value})}
                    >
                      <option value="">All</option>
                      <option value="admin">Admin</option>
                      <option value="user">User</option>
                    </select>
                  </div>
                </th>
                <th className="p-4">
                  <div className="flex flex-col gap-2">
                    <div className="cursor-pointer flex items-center gap-1" onClick={() => handleSort('status')}>
                      Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}
                    </div>
                    <select 
                      className="bg-gray-800 border border-gray-700 text-xs rounded p-1 text-gray-300 w-full"
                      value={filters.status}
                      onChange={e => setFilters({...filters, status: e.target.value})}
                    >
                      <option value="">All</option>
                      <option value="online">Online</option>
                      <option value="offline">Offline</option>
                    </select>
                  </div>
                </th>
                <th className="p-4">
                  <div className="flex flex-col gap-2">
                    <div className="cursor-pointer flex items-center gap-1" onClick={() => handleSort('accountStatus')}>
                      Account Status {sortConfig.key === 'accountStatus' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}
                    </div>
                    <select 
                      className="bg-gray-800 border border-gray-700 text-xs rounded p-1 text-gray-300 w-full"
                      value={filters.accountStatus}
                      onChange={e => setFilters({...filters, accountStatus: e.target.value})}
                    >
                      <option value="">All</option>
                      <option value="active">Active</option>
                      <option value="locked">Locked</option>
                    </select>
                  </div>
                </th>
                <th className="p-4 align-top pt-5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredAndSortedUsers.map(user => {
                const isLocked = user.locked_until && new Date(user.locked_until) > new Date();
                return (
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
                    {isLocked ? (
                      <span className="px-3 py-1 bg-red-500/10 text-red-400 rounded-full text-xs font-medium border border-red-500/20 flex items-center gap-1 w-max">
                        <AlertTriangle size={12} /> Locked
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-xs font-medium">Active</span>
                    )}
                  </td>
                  <td className="p-4 flex gap-2">
                    <button 
                      onClick={() => setSelectedUser(user)}
                      className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                      title="Reset Password"
                    >
                      <Key size={16} />
                    </button>
                    {isLocked && (
                      <button 
                        onClick={() => handleUnlockAccount(user.id)}
                        className="flex items-center gap-2 text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20 px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                        title="Unlock Account"
                      >
                        <Unlock size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              )})}
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
