import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { LogOut, Search, MessageSquare, UserPlus, Check, X, Bell, User, LayoutGrid, Users } from 'lucide-react';
import ProfileModal from './ProfileModal';

const Sidebar = ({ currentChat, setCurrentChat, unreadCounts, socket, setView, currentView, notificationsCount, onBellClick }) => {
  const { user, logout } = useAuth();
  const [chats, setChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [activeTab, setActiveTab] = useState('chats'); // 'chats', 'requests', 'friends' or 'feed'
  const [profileModal, setProfileModal] = useState({ isOpen: false, userId: null, isOwn: false });

  useEffect(() => {
    fetchChats();
    fetchPendingRequests();
    fetchFriends();
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    socket.on('new_friend_request', (data) => {
      fetchPendingRequests();
      // Optional: notification
    });

    socket.on('friend_request_accepted', (data) => {
      fetchChats();
      fetchPendingRequests();
    });

    socket.on('friend_request_rejected', (data) => {
      fetchPendingRequests();
      // Optionally refresh search if active
      if (searchQuery) handleSearch({ target: { value: searchQuery } });
    });

    return () => {
      socket.off('new_friend_request');
      socket.off('friend_request_accepted');
      socket.off('friend_request_rejected');
    };
  }, [socket]);

  const fetchPendingRequests = async () => {
    try {
      const res = await api.get('/friends/pending');
      setPendingRequests(res.data);
    } catch (err) {
      console.error('Error fetching pending requests', err);
    }
  };

  const fetchChats = async () => {
    try {
      const res = await api.get('/chats');
      setChats(res.data);
      if (socket) {
        res.data.forEach(chat => socket.emit('join_room', chat.id));
      }
    } catch (err) {
      console.error('Error fetching chats', err);
    }
  };

  const fetchFriends = async () => {
    try {
      const res = await api.get('/friends/list');
      setFriends(res.data);
    } catch (err) {
      console.error('Error fetching friends', err);
    }
  };

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (!query) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/auth/search?q=${query}`);
      setSearchResults(res.data);
    } catch (err) {
      console.error('Search error', err);
    }
  };

  const startChat = async (otherUserId) => {
    try {
      const res = await api.post('/chats', { otherUserId });
      if (socket) socket.emit('join_room', res.data.id);
      fetchChats();
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      console.error('Error starting chat', err);
    }
  };

  const sendInvite = async (receiverId) => {
    try {
      await api.post('/friends/invite', { receiverId });
      if (socket) {
        socket.emit('send_friend_request', { receiverId, sender: user });
      }
      handleSearch({ target: { value: searchQuery } }); // Refresh search
    } catch (err) {
      console.error('Error sending invite', err);
    }
  };

  const respondToRequest = async (requestId, action, senderId) => {
    try {
      await api.post('/friends/respond', { requestId, action });
      if (socket) {
        if (action === 'accepted') {
          socket.emit('accept_friend_request', { senderId, receiver: user });
        } else if (action === 'rejected') {
          socket.emit('reject_friend_request', { senderId, receiver: user });
        }
      }
      fetchPendingRequests();
      fetchChats();
    } catch (err) {
      console.error('Error responding to request', err);
    }
  };

  return (
    <div className="sidebar glass-panel">
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="avatar clickable" onClick={() => setProfileModal({ isOpen: true, userId: user.id, isOwn: true })}>
            {user?.username?.[0]?.toUpperCase()}
            <div className="status-dot online"></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '1rem', margin: 0 }}>{user?.username}</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="icon-btn" onClick={onBellClick} style={{ position: 'relative' }}>
            <Bell size={20} />
            {notificationsCount > 0 && <span className="notification-badge">{notificationsCount}</span>}
          </button>
          <button onClick={logout} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div style={{ padding: '0 1rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', top: '1.8rem', left: '1rem', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search users..." 
            value={searchQuery}
            onChange={handleSearch}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
      </div>

      <div className="chat-list">
        {searchResults.length > 0 && (
          <div className="search-results">
            <h4 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '1rem 0 0.5rem 1rem', textTransform: 'uppercase' }}>Users</h4>
            {searchResults.map(u => (
              <div key={u.id} className="chat-item">
                <div className="avatar" style={{ background: 'var(--bg-input)', fontSize: '1rem' }}>
                  {u.username[0].toUpperCase()}
                </div>
                <div className="chat-info">
                  <div className="chat-name">{u.username}</div>
                  <div className="chat-preview">{u.friendship_status || 'Not connected'}</div>
                </div>
                <div className="chat-actions">
                  {!u.friendship_status && (
                    <button onClick={() => sendInvite(u.id)} className="icon-btn" title="Invite">
                      <UserPlus size={18} />
                    </button>
                  )}
                  {u.friendship_status === 'pending' && u.sender_id === user.id && (
                    <span className="badge">Sent</span>
                  )}
                  {u.friendship_status === 'pending' && u.sender_id !== user.id && (
                    <span className="badge highlight">Pending</span>
                  )}
                  {u.friendship_status === 'accepted' && (
                    <button onClick={() => startChat(u.id)} className="icon-btn" title="Chat">
                      <MessageSquare size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="sidebar-tabs">
          <button 
            className={`tab ${activeTab === 'chats' ? 'active' : ''}`} 
            onClick={() => { setActiveTab('chats'); setView('chat'); }}
          >
            Chats
          </button>
          <button 
            className={`tab ${activeTab === 'requests' ? 'active' : ''}`} 
            onClick={() => { setActiveTab('requests'); setView('chat'); }}
          >
            Requests {pendingRequests.length > 0 && <span className="tab-badge">{pendingRequests.length}</span>}
          </button>
          <button 
            className={`tab ${activeTab === 'friends' ? 'active' : ''}`} 
            onClick={() => { setActiveTab('friends'); setView('chat'); }}
          >
            Friends
          </button>
          <button 
            className={`tab ${activeTab === 'feed' ? 'active' : ''}`} 
            onClick={() => { setActiveTab('feed'); setView('feed'); }}
          >
            Feed
          </button>
        </div>

        {activeTab === 'requests' && !searchQuery && (
          <div className="requests-list">
            {pendingRequests.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>
                <Bell size={32} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                <p>No pending requests</p>
              </div>
            ) : (
              pendingRequests.map(req => (
                <div key={req.id} className="chat-item">
                  <div className="avatar">
                    {req.sender_username[0].toUpperCase()}
                  </div>
                  <div className="chat-info">
                    <div className="chat-name">{req.sender_username}</div>
                    <div className="chat-preview">wants to connect</div>
                  </div>
                  <div className="chat-actions">
                    <button onClick={() => respondToRequest(req.id, 'accepted', req.sender_id)} className="icon-btn success">
                      <Check size={18} />
                    </button>
                    <button onClick={() => respondToRequest(req.id, 'rejected', req.sender_id)} className="icon-btn danger">
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'friends' && !searchQuery && (
          <div className="friends-list">
            {friends.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>
                <Users size={32} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                <p>No friends yet</p>
              </div>
            ) : (
              friends.map(friend => (
                <div key={friend.id} className="chat-item" onClick={() => startChat(friend.id)}>
                  <div className="avatar">
                    {friend.username[0].toUpperCase()}
                    <div className={`status-dot ${friend.status === 'online' ? 'online' : 'offline'}`}></div>
                  </div>
                  <div className="chat-info">
                    <div className="chat-name">{friend.username}</div>
                    <div className="chat-preview">{friend.status === 'online' ? 'Online' : 'Offline'}</div>
                  </div>
                  <div className="chat-actions">
                    <button className="icon-btn" title="Message">
                      <MessageSquare size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'chats' && !searchQuery && (
          <>
            {chats.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>
                <MessageSquare size={32} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                <p>No chats yet</p>
              </div>
            ) : (
              chats.map(chat => (
                <div 
                  key={chat.id} 
                  className={`chat-item ${currentChat?.id === chat.id ? 'active' : ''}`}
                  onClick={() => setCurrentChat(chat)}
                >
                  <div className="avatar">
                    {chat.is_group ? 'G' : chat.other_username?.[0]?.toUpperCase()}
                    {!chat.is_group && (
                      <div className={`status-dot ${chat.other_status === 'online' ? 'online' : 'offline'}`}></div>
                    )}
                  </div>
                  <div className="chat-info">
                    <div className="chat-name">{chat.is_group ? chat.group_name : chat.other_username}</div>
                    <div className="chat-preview">Open chat</div>
                  </div>
                  {unreadCounts && unreadCounts[chat.id] > 0 && (
                    <div style={{ background: 'var(--primary)', color: 'white', borderRadius: '50%', padding: '0.1rem 0.4rem', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: 'auto' }}>
                      {unreadCounts[chat.id]}
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}
      </div>
      
      <ProfileModal 
        isOpen={profileModal.isOpen} 
        onClose={() => setProfileModal({ ...profileModal, isOpen: false })}
        userId={profileModal.userId}
        isOwnProfile={profileModal.isOwn}
      />
    </div>
  );
};

export default Sidebar;
