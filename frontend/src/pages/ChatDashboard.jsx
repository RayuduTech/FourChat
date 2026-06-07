import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import Feed from '../components/Feed';
import ProfileModal from '../components/ProfileModal';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import toast, { Toaster } from 'react-hot-toast';
import api from '../services/api';
import { Bell, LogOut } from 'lucide-react';

const ChatDashboard = () => {
  const [currentChat, setCurrentChat] = useState(null);
  const [view, setView] = useState(localStorage.getItem('dashboard_view') || 'chat');

  useEffect(() => {
    localStorage.setItem('dashboard_view', view);
  }, [view]);
  const [sidebarTab, setSidebarTab] = useState(localStorage.getItem('sidebar_active_tab') || 'chats');

  useEffect(() => {
    localStorage.setItem('sidebar_active_tab', sidebarTab);
  }, [sidebarTab]);

  const [unreadCounts, setUnreadCounts] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        if (!event.target.closest('.bell-btn')) {
          setShowNotifications(false);
        }
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [profileModal, setProfileModal] = useState({ isOpen: false, userId: null, isOwn: false });
  const { token, user } = useAuth();
  const socket = useSocket(token);

  const handleNotificationClick = async (n) => {
    // 1. Navigation Logic
    if (n.type === 'friend_request' || n.type === 'friend_accept') {
      setSidebarTab(n.type === 'friend_request' ? 'requests' : 'friends');
      setView('chat'); // Ensure we are in the sidebar/chat view
    } else if (n.post_id || n.type === 'new_post' || n.type === 'post_like' || n.type === 'post_comment' || n.type === 'comment_reply' || n.type === 'comment_like') {
      setSelectedPostId(n.post_id);
      setView('feed');
    }

    setShowNotifications(false);

    // 2. Mark as read in DB
    try {
      await api.put(`/notifications/${n.id}/read`);
      fetchNotifications();
    } catch (err) {
      console.error('Error marking notification as read', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error('Error fetching notifications', err);
    }
  };

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user]);

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

    const handleFriendRequest = (data) => {
      toast(`New friend request from ${data.sender.username}`, { icon: '👋', duration: 4000 });
      fetchNotifications();
    };

    const handleFriendAccepted = (data) => {
      toast(`${data.receiver.username} accepted your request!`, { icon: '✅', duration: 4000 });
      fetchNotifications();
    };

    const handleNewPost = (data) => {
      toast(`${data.sender} just shared a new post!`, { icon: '✨', duration: 4000 });
      fetchNotifications();
    };

    const handlePostLike = (data) => {
      toast(`${data.likerName} liked your post!`, { icon: '❤️', duration: 4000 });
      fetchNotifications();
    };

    const handlePostComment = (data) => {
      toast(`${data.commenterName} commented on your post!`, { icon: '💬', duration: 4000 });
      fetchNotifications();
    };

    const handleCommentReply = (data) => {
      toast(`${data.commenterName} replied to your comment!`, { icon: '↪️', duration: 4000 });
      fetchNotifications();
    };

    socket.on('new_friend_request', handleFriendRequest);
    socket.on('friend_request_accepted', handleFriendAccepted);
    socket.on('new_post_notification', handleNewPost);
    socket.on('post_like', handlePostLike);
    socket.on('post_comment', handlePostComment);
    socket.on('comment_reply', handleCommentReply);

    return () => {
      socket.off('new_friend_request', handleFriendRequest);
      socket.off('friend_request_accepted', handleFriendAccepted);
      socket.off('new_post_notification', handleNewPost);
      socket.off('post_like', handlePostLike);
      socket.off('post_comment', handlePostComment);
      socket.off('comment_reply', handleCommentReply);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const handleUnreadMessage = (message) => {
      // Only track unread for chats NOT currently open
      setCurrentChat(prev => {
        if (!prev || prev.id !== message.chat_id) {
          setUnreadCounts(counts => ({
            ...counts,
            [message.chat_id]: (counts[message.chat_id] || 0) + 1
          }));
        }
        return prev;
      });
    };

    socket.on('receive_message', handleUnreadMessage);

    return () => {
      socket.off('receive_message', handleUnreadMessage);
    };
  }, [socket]);

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
        notificationsCount={notifications.filter(n => !n.is_read).length}
        onBellClick={() => setShowNotifications(!showNotifications)}
        setProfileModal={setProfileModal}
        activeTab={sidebarTab}
        setActiveTab={setSidebarTab}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', height: '100%' }}>
        {showNotifications && (
          <div className="notifications-dropdown glass-panel" ref={notificationsRef}>
            <div className="dropdown-header">
              <h4>Notifications</h4>
              <button onClick={async () => {
                await api.delete('/notifications');
                setNotifications([]);
              }} className="text-btn">Clear All</button>
            </div>
            <div className="notifications-list">
              {notifications.length === 0 ? (
                <div className="empty-state">No new notifications</div>
              ) : (
                notifications.map(n => (
                  <div 
                    key={n.id} 
                    className={`notification-item clickable ${n.is_read ? 'is-read' : ''}`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <p>{n.text}</p>
                    <span>{new Date(n.created_at).toLocaleTimeString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {view === 'feed' ? (
          <Feed 
            socket={socket} 
            setProfileModal={setProfileModal} 
            selectedPostId={selectedPostId} 
            clearSelectedPostId={() => setSelectedPostId(null)} 
          />
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
      <ProfileModal 
        isOpen={profileModal.isOpen} 
        onClose={() => setProfileModal({ ...profileModal, isOpen: false })}
        userId={profileModal.userId}
        isOwnProfile={profileModal.isOwn}
      />
    </div>
  );
};

export default ChatDashboard;
