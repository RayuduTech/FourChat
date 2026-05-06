import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

import api from '../services/api';
import { Send, MoreVertical, Paperclip, Info, LogOut, UserPlus } from 'lucide-react';
import GroupInfoModal from './GroupInfoModal';

const ChatWindow = ({ chat, socket, onGroupDeleted, onGroupUpdated }) => {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  let typingTimeout = useRef(null);

  const getBaseUrl = () => {
    return import.meta.env.VITE_API_URL.replace('/api', '');
  };

  useEffect(() => {
    fetchMessages();
  }, [chat.id]);

  useEffect(() => {
    if (socket && chat.id) {
      socket.emit('join_room', chat.id);

      socket.on('receive_message', (message) => {
        setMessages((prev) => [...prev, message]);
      });

      socket.on('user_typing', ({ userId }) => {
        if (userId !== user.id) setIsTyping(true);
      });

      socket.on('user_stopped_typing', ({ userId }) => {
        if (userId !== user.id) setIsTyping(false);
      });
    }

    return () => {
      if (socket) {
        socket.off('receive_message');
        socket.off('user_typing');
        socket.off('user_stopped_typing');
      }
    };
  }, [socket, chat.id, user.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/chats/${chat.id}/messages`);
      setMessages(res.data);
    } catch (err) {
      console.error('Error fetching messages', err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleTyping = (e) => {
    setInputMessage(e.target.value);
    
    if (socket) {
      socket.emit('typing', chat.id);
      
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        socket.emit('stop_typing', chat.id);
      }, 1000);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.value ? e.target.files[0] : null;
    if (!file) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await api.post('/chats/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (socket) {
        socket.emit('send_message', {
          chatId: chat.id,
          content: 'Sent an attachment',
          media_url: res.data.url
        });
      }
    } catch (err) {
      console.error('Upload error', err);
    } finally {
      setIsUploading(false);
      e.target.value = null;
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (inputMessage.trim() && socket && canPost) {
      socket.emit('send_message', {
        chatId: chat.id,
        content: inputMessage,
      });
      setInputMessage('');
      socket.emit('stop_typing', chat.id);
    }
  };

  const canPost = !chat.is_group || chat.anyone_can_post || chat.my_role === 'admin';

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="avatar" style={{ cursor: chat.is_group ? 'pointer' : 'default' }} onClick={() => chat.is_group && setShowInfoModal(true)}>
          {chat.is_group ? (
            chat.group_pic ? (
              <img src={`${getBaseUrl()}${chat.group_pic}`} alt="Group" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : chat.group_name?.[0]?.toUpperCase()
          ) : (
            chat.other_profile_pic ? (
              <img src={`${getBaseUrl()}${chat.other_profile_pic}`} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : chat.other_username?.[0]?.toUpperCase()
          )}
        </div>
        <div style={{ flex: 1, cursor: chat.is_group ? 'pointer' : 'default' }} onClick={() => chat.is_group && setShowInfoModal(true)}>
          <h3 style={{ margin: 0, fontWeight: 600 }}>
            {chat.is_group ? chat.group_name : chat.other_username}
          </h3>
          {!chat.is_group && (
            <span style={{ fontSize: '0.8rem', color: chat.other_status === 'online' ? 'var(--success)' : 'var(--text-muted)' }}>
              {chat.other_status === 'online' ? 'Online' : 'Offline'}
            </span>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            onClick={() => setShowMenu(!showMenu)}
          >
            <MoreVertical size={20} />
          </button>
          
          {showMenu && (
            <div className="glass-panel" style={{ 
              position: 'absolute', 
              top: '100%', 
              right: 0, 
              zIndex: 100, 
              minWidth: '150px',
              padding: '0.5rem',
              marginTop: '0.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}>
              {chat.is_group ? (
                <>
                  <div className="menu-item" onClick={() => { setShowInfoModal(true); setShowMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', cursor: 'pointer', borderRadius: '0.25rem' }}>
                    <Info size={16} /> Group Info
                  </div>
                  <div className="menu-item" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', cursor: 'pointer', borderRadius: '0.25rem', color: 'var(--danger)' }}>
                    <LogOut size={16} /> Leave Group
                  </div>
                </>
              ) : (
                <div className="menu-item" onClick={() => { setShowMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', cursor: 'pointer', borderRadius: '0.25rem' }}>
                  <User size={16} /> View Profile
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="messages-area">
        {messages.map((msg, index) => {
          const isSent = msg.sender_id === user.id;
          return (
            <div key={index} className={`message-bubble ${isSent ? 'message-sent' : 'message-received'}`}>
              {!isSent && chat.is_group && (
                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--primary)' }}>
                  {msg.sender_username}
                </div>
              )}
              {msg.media_url && (
                <div style={{ marginBottom: '0.5rem' }}>
                  {msg.media_url.match(/\.(jpeg|jpg|gif|png)$/) ? (
                    <img src={`http://localhost:5000${msg.media_url}`} alt="attachment" style={{ maxWidth: '100%', borderRadius: '8px' }} />
                  ) : (
                    <a href={`http://localhost:5000${msg.media_url}`} target="_blank" rel="noopener noreferrer" style={{ color: 'white', textDecoration: 'underline' }}>
                      View Attachment
                    </a>
                  )}
                </div>
              )}
              <div>{msg.content}</div>
              <div className="message-meta">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="message-bubble message-received" style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '1rem' }}>
            <span style={{ width: '6px', height: '6px', background: 'var(--text-muted)', borderRadius: '50%', animation: 'fadeIn 1s infinite' }}></span>
            <span style={{ width: '6px', height: '6px', background: 'var(--text-muted)', borderRadius: '50%', animation: 'fadeIn 1s infinite 0.2s' }}></span>
            <span style={{ width: '6px', height: '6px', background: 'var(--text-muted)', borderRadius: '50%', animation: 'fadeIn 1s infinite 0.4s' }}></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="message-input-area">
        <form onSubmit={sendMessage} className="message-form">
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleFileUpload} 
          />
          <button 
            type="button" 
            className={`icon-btn ${isUploading ? 'loading' : ''}`} 
            onClick={() => fileInputRef.current.click()}
            disabled={isUploading}
          >
            <Paperclip size={20} />
          </button>
          <input 
            type="text" 
            className="message-input" 
            value={inputMessage} 
            onChange={handleTyping} 
            placeholder={!canPost ? 'Only admins can send messages here' : (isUploading ? 'Uploading...' : 'Type a message...')}
            disabled={isUploading || !canPost}
          />
          <button type="submit" className="send-btn" disabled={!inputMessage.trim() || !canPost}>
            <Send size={20} />
          </button>
        </form>
      </div>

      {chat.is_group && (
        <GroupInfoModal 
          isOpen={showInfoModal} 
          onClose={() => setShowInfoModal(false)} 
          chatId={chat.id}
          onGroupDeleted={onGroupDeleted}
          onGroupUpdated={(data) => { if (onGroupUpdated) onGroupUpdated(chat.id, data); }}
        />
      )}
    </div>
  );
};

export default ChatWindow;
