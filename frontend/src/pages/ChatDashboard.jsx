import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import Feed from '../components/Feed';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import toast, { Toaster } from 'react-hot-toast';

const ChatDashboard = () => {
  const [currentChat, setCurrentChat] = useState(null);
  const [view, setView] = useState('chat');
  const [unreadCounts, setUnreadCounts] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const { token } = useAuth();
  const socket = useSocket(token);

  const handleGroupDeleted = (chatId) => {
    if (currentChat?.id === chatId) setCurrentChat(null);
  };

  const handleGroupUpdated = (chatId, data) => {
    if (currentChat?.id === chatId) {
      setCurrentChat(prev => ({ ...prev, ...data }));
    }
  };

  useEffect(() => {
    if (!socket) return;

    socket.on('new_friend_request', (data) => {
      toast(`New friend request from ${data.sender.username}`, { icon: '👋', duration: 4000 });
      setNotifications(prev => [{ id: Date.now(), type: 'friend_request', text: `Friend request from ${data.sender.username}`, time: new Date() }, ...prev]);
    });

    socket.on('friend_request_accepted', (data) => {
      toast(`${data.receiver.username} accepted your request!`, { icon: '✅', duration: 4000 });
      setNotifications(prev => [{ id: Date.now(), type: 'friend_accept', text: `${data.receiver.username} accepted your request`, time: new Date() }, ...prev]);
    });

    socket.on('new_post_notification', (data) => {
      toast(`${data.sender} just shared a new post!`, { icon: '✨', duration: 4000 });
      setNotifications(prev => [{ id: Date.now(), type: 'new_post', text: `${data.sender} shared a new post`, time: new Date() }, ...prev]);
    });

    socket.on('post_like', (data) => {
      toast(`${data.likerName} liked your post!`, { icon: '❤️', duration: 4000 });
      setNotifications(prev => [{ id: Date.now(), type: 'post_like', text: `${data.likerName} liked your post`, time: new Date() }, ...prev]);
    });

    socket.on('post_comment', (data) => {
      toast(`${data.commenterName} commented on your post!`, { icon: '💬', duration: 4000 });
      setNotifications(prev => [{ id: Date.now(), type: 'post_comment', text: `${data.commenterName} commented on your post`, time: new Date() }, ...prev]);
    });

    return () => {
      socket.off('new_friend_request');
      socket.off('friend_request_accepted');
      socket.off('new_post_notification');
    };
  }, [socket]);

  useEffect(() => {
    if (socket) {
      socket.on('receive_message', (message) => {
        if (currentChat?.id !== message.chat_id) {
          setUnreadCounts(prev => ({
            ...prev,
            [message.chat_id]: (prev[message.chat_id] || 0) + 1
          }));
        }
      });
    }
    return () => {
      if (socket) socket.off('receive_message');
    };
  }, [socket, currentChat]);

  useEffect(() => {
    if (currentChat) {
      setUnreadCounts(prev => ({ ...prev, [currentChat.id]: 0 }));
    }
  }, [currentChat]);

  return (
    <div className="app-container">
      <Toaster position="top-right" reverseOrder={false} />
      <Sidebar 
        currentChat={currentChat} 
        setCurrentChat={(chat) => { setCurrentChat(chat); setView('chat'); }} 
        unreadCounts={unreadCounts}
        socket={socket}
        setView={setView}
        currentView={view}
        notificationsCount={notifications.length}
        onBellClick={() => setShowNotifications(!showNotifications)}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', height: '100%' }}>
        {showNotifications && (
          <div className="notifications-dropdown glass-panel">
            <div className="dropdown-header">
              <h4>Notifications</h4>
              <button onClick={() => setNotifications([])} className="text-btn">Clear All</button>
            </div>
            <div className="notifications-list">
              {notifications.length === 0 ? (
                <div className="empty-state">No new notifications</div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className="notification-item">
                    <p>{n.text}</p>
                    <span>{new Date(n.time).toLocaleTimeString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {view === 'feed' ? (
          <Feed socket={socket} />
        ) : currentChat ? (
          <ChatWindow 
            chat={currentChat} 
            socket={socket} 
            onGroupDeleted={handleGroupDeleted}
            onGroupUpdated={handleGroupUpdated}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(15, 23, 42, 0.4)' }}>
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <h3>Select a chat to start messaging</h3>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatDashboard;
