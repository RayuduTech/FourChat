import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

import api from '../services/api';
import { Send, MoreVertical, Paperclip, Info, LogOut, UserPlus, User, Smile, Image, Ghost, Reply, X, Plus } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import GroupInfoModal from './GroupInfoModal';
import ProfileModal from './ProfileModal';

const MOCK_GIFS = [
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMSZlcD12MV9pbnRlcm5hbF9naWZzX2dpZklkJmN0PWc/13HgwGsXF0aiGY/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMSZlcD12MV9pbnRlcm5hbF9naWZzX2dpZklkJmN0PWc/3o7TKSjRrfIPjeiVyM/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMSZlcD12MV9pbnRlcm5hbF9naWZzX2dpZklkJmN0PWc/mlvseq9yvZhba/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMSZlcD12MV9pbnRlcm5hbF9naWZzX2dpZklkJmN0PWc/JIX9t2j0ZTN9S/giphy.gif"
];

const MOCK_STICKERS = [
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMSZlcD12MV9pbnRlcm5hbF9naWZzX2dpZklkJmN0PXM/3oEjI6SIIHBdRxXI40/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMSZlcD12MV9pbnRlcm5hbF9naWZzX2dpZklkJmN0PXM/l41lFw057lAJQMwg0/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMSZlcD12MV9pbnRlcm5hbF9naWZzX2dpZklkJmN0PXM/26FPCXdkvDbKBbgOI/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMSZlcD12MV9pbnRlcm5hbF9naWZzX2dpZklkJmN0PXM/3o7TKDk86gVhlBpmjm/giphy.gif"
];

// Helper: render message text with @mention highlights
const renderMessageContent = (content, onMentionClick) => {
  if (!content) return null;
  const parts = content.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span
          key={i}
          className="mention-highlight"
          onClick={(e) => {
            e.stopPropagation();
            if (onMentionClick) onMentionClick(part.slice(1));
          }}
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
};

const ChatWindow = ({ chat, socket, onGroupDeleted, onGroupUpdated }) => {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState('emoji');
  // Reply state
  const [replyingTo, setReplyingTo] = useState(null);
  // Mentions state
  const [mentionQuery, setMentionQuery] = useState(null); // null = dropdown hidden, '' = show all
  const [groupMembers, setGroupMembers] = useState([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState(null);
  // Reaction picker state
  const [activeReactionPickerMessageId, setActiveReactionPickerMessageId] = useState(null);

  const messagesAreaRef = useRef(null);
  const fileInputRef = useRef(null);
  const pickerRef = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);
  const messageRefs = useRef({});
  let typingTimeout = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (activeReactionPickerMessageId && !event.target.closest('.reaction-picker-popover') && !event.target.closest('.react-action-btn')) {
        setActiveReactionPickerMessageId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeReactionPickerMessageId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getBaseUrl = () => {
    return import.meta.env.VITE_API_URL.replace('/api', '');
  };

  useEffect(() => {
    fetchMessages();
    // Fetch group members for mentions if it's a group chat
    if (chat.is_group) {
      fetchGroupMembers();
    }
  }, [chat.id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target) && !event.target.closest('.emoji-toggle-btn')) {
        setShowPicker(false);
      }
    };
    if (showPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

  const handleMessageReactionUpdated = useCallback((data) => {
    const { messageId, userId, username, emoji, action } = data;
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg;
        const currentReactions = msg.reactions || [];
        let updatedReactions;
        if (action === 'remove') {
          updatedReactions = currentReactions.filter(
            (r) => !(r.user_id === userId && r.emoji === emoji)
          );
        } else {
          const exists = currentReactions.some(
            (r) => r.user_id === userId && r.emoji === emoji
          );
          if (exists) {
            updatedReactions = currentReactions;
          } else {
            updatedReactions = [
              ...currentReactions,
              { user_id: userId, username, emoji }
            ];
          }
        }
        return { ...msg, reactions: updatedReactions };
      })
    );
  }, []);

  const handleToggleReaction = (messageId, emoji) => {
    if (socket && messageId) {
      socket.emit('toggle_reaction', {
        messageId,
        chatId: chat.id,
        emoji
      });
    }
    setActiveReactionPickerMessageId(null);
  };

  useEffect(() => {
    if (!socket || !chat.id) return;

    socket.emit('join_room', chat.id);

    const handleReceiveMessage = (message) => {
      if (parseInt(message.chat_id) !== parseInt(chat.id)) return;
      setMessages((prev) => {
        if (message.sender_id === user.id) {
          const hasOptimistic = prev.some(m => m.isOptimistic && m.content === message.content);
          if (hasOptimistic) {
            return prev.map(m => (m.isOptimistic && m.content === message.content) ? { ...message, isOptimistic: false } : m);
          }
        }
        if (message.id && prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
    };

    const handleUserTyping = ({ userId, chatId }) => {
      if (userId !== user.id && parseInt(chatId) === parseInt(chat.id)) setIsTyping(true);
    };

    const handleUserStoppedTyping = ({ userId, chatId }) => {
      if (userId !== user.id && parseInt(chatId) === parseInt(chat.id)) setIsTyping(false);
    };

    const handleGroupUpdated = (data) => {
      if (parseInt(data.chatId) === parseInt(chat.id)) {
        if (onGroupUpdated) onGroupUpdated(chat.id, data);
      }
    };

    const handleGroupDeleted = (data) => {
      if (parseInt(data.chatId) === parseInt(chat.id)) {
        if (onGroupDeleted) onGroupDeleted(chat.id);
      }
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stopped_typing', handleUserStoppedTyping);
    socket.on('group_updated_realtime', handleGroupUpdated);
    socket.on('group_deleted_realtime', handleGroupDeleted);
    socket.on('message_reaction_updated', handleMessageReactionUpdated);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stopped_typing', handleUserStoppedTyping);
      socket.off('group_updated_realtime', handleGroupUpdated);
      socket.off('group_deleted_realtime', handleGroupDeleted);
      socket.off('message_reaction_updated', handleMessageReactionUpdated);
    };
  }, [socket, chat.id, user.id, onGroupUpdated, onGroupDeleted, handleMessageReactionUpdated]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Reset reply when chat changes
  useEffect(() => {
    setReplyingTo(null);
    setMentionQuery(null);
    setActiveReactionPickerMessageId(null);
  }, [chat.id]);

  const openUserProfile = (userId) => {
    setSelectedUserId(userId);
    setShowProfileModal(true);
  };

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/chats/${chat.id}/messages`);
      setMessages(res.data);
    } catch (err) {
      console.error('Error fetching messages', err);
    }
  };

  const fetchGroupMembers = async () => {
    try {
      const res = await api.get(`/chats/${chat.id}/members`);
      setGroupMembers(res.data.members || []);
    } catch (err) {
      console.error('Error fetching group members', err);
    }
  };

  const scrollToBottom = () => {
    if (messagesAreaRef.current) {
      messagesAreaRef.current.scrollTop = messagesAreaRef.current.scrollHeight;
    }
  };

  const scrollToMessage = (messageId) => {
    const el = messageRefs.current[messageId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-flash');
      setTimeout(() => el.classList.remove('highlight-flash'), 1500);
    }
  };


  const handleReply = (msg) => {
    setReplyingTo({
      id: msg.id || msg.reply_original_id,
      sender_username: msg.sender_username,
      content: msg.content,
      media_url: msg.media_url
    });
    // Focus the input
    if (inputRef.current) inputRef.current.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const handleTyping = (e) => {
    const value = e.target.value;
    setInputMessage(value);
    
    if (socket) {
      socket.emit('typing', chat.id);
      
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        socket.emit('stop_typing', chat.id);
      }, 1000);
    }

    // Mention detection for group chats
    if (chat.is_group) {
      const cursorPos = e.target.selectionStart;
      const textBeforeCursor = value.slice(0, cursorPos);
      const atMatch = textBeforeCursor.match(/@(\w*)$/);
      
      if (atMatch) {
        setMentionQuery(atMatch[1]);
        setMentionStartPos(cursorPos - atMatch[0].length);
        setMentionIndex(0);
      } else {
        setMentionQuery(null);
        setMentionStartPos(null);
      }
    }
  };

  const filteredMembers = groupMembers.filter(m => {
    if (m.id === user.id) return false; // Don't show self
    if (mentionQuery === null) return false;
    if (mentionQuery === '') return true;
    return m.username.toLowerCase().startsWith(mentionQuery.toLowerCase());
  });

  const handleMentionSelect = (member) => {
    if (mentionStartPos === null) return;
    const before = inputMessage.slice(0, mentionStartPos);
    const after = inputMessage.slice(mentionStartPos + mentionQuery.length + 1); // +1 for @
    const newValue = `${before}@${member.username} ${after}`;
    setInputMessage(newValue);
    setMentionQuery(null);
    setMentionStartPos(null);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleInputKeyDown = (e) => {
    // Handle mention dropdown keyboard navigation
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => Math.min(prev + 1, filteredMembers.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleMentionSelect(filteredMembers[mentionIndex]);
        return;
      } else if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
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

  const handleEmojiClick = (emojiObj) => {
    setInputMessage(prev => prev + emojiObj.emoji);
  };

  const sendMediaUrl = async (url) => {
    try {
      const payload = {
        chatId: chat.id,
        content: '',
        mediaUrl: url
      };
      
      const tempId = Date.now().toString();
      const optimisticMessage = {
        id: tempId,
        chat_id: chat.id,
        sender_id: user.id,
        sender_username: user.username,
        content: '',
        media_url: url,
        created_at: new Date().toISOString(),
        isOptimistic: true
      };

      setMessages(prev => [...prev, optimisticMessage]);
      setShowPicker(false);

      const res = await api.post('/chats/messages', payload);
      
      setMessages(prev => prev.map(m => m.id === tempId ? res.data : m));
      
      if (socket) {
        socket.emit('send_message', res.data);
        if (onGroupUpdated) {
          onGroupUpdated(chat.id, { last_message: '🖼️ Media' });
        }
      }
    } catch (err) {
      console.error('Error sending media message', err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (inputMessage.trim() && socket && canPost) {
      const msgData = {
        chatId: chat.id,
        content: inputMessage,
        replyToMessageId: replyingTo?.id || null,
      };

      // Optimistic Update: Add to UI immediately
      const optimisticMessage = {
        ...msgData,
        chat_id: chat.id,
        sender_id: user.id,
        sender_username: user.username,
        created_at: new Date().toISOString(),
        isOptimistic: true,
        // Include reply data for optimistic render
        reply_to_message_id: replyingTo?.id || null,
        reply_original_id: replyingTo?.id || null,
        reply_original_sender: replyingTo?.sender_username || null,
        reply_original_content: replyingTo?.content || null,
        reply_original_media_url: replyingTo?.media_url || null,
      };
      
      setMessages((prev) => [...prev, optimisticMessage]);
      
      socket.emit('send_message', msgData);
      setInputMessage('');
      setReplyingTo(null);
      setMentionQuery(null);
      socket.emit('stop_typing', chat.id);
    }
  };

  const canPost = !chat.is_group || chat.anyone_can_post || chat.my_role === 'admin';

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="avatar" style={{ cursor: 'pointer' }} onClick={() => chat.is_group ? setShowInfoModal(true) : openUserProfile(chat.other_user_id)}>
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
        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => chat.is_group ? setShowInfoModal(true) : openUserProfile(chat.other_user_id)}>
          <h3 style={{ margin: 0, fontWeight: 600 }}>
            {chat.is_group ? chat.group_name : chat.other_username}
          </h3>
          {!chat.is_group && (
            <span style={{ fontSize: '0.8rem', color: chat.other_status === 'online' ? 'var(--success)' : 'var(--text-muted)' }}>
              {chat.other_status === 'online' ? 'Online' : 'Offline'}
            </span>
          )}
        </div>
        <div style={{ position: 'relative' }} ref={menuRef}>
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
                <div className="menu-item" onClick={() => { openUserProfile(chat.other_user_id); setShowMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', cursor: 'pointer', borderRadius: '0.25rem' }}>
                  <User size={16} /> View Profile
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="messages-area" ref={messagesAreaRef}>
        {messages.map((msg, index) => {
          const isSent = msg.sender_id === user.id;
          const msgId = msg.id || `opt-${index}`;
          return (
            <div 
              key={msgId} 
              className={`message-bubble ${isSent ? 'message-sent' : 'message-received'}`}
              ref={(el) => { if (msg.id) messageRefs.current[msg.id] = el; }}
            >
              {/* Message Hover Toolbar */}
              {msg.id && !msg.isOptimistic && (
                <div className="message-hover-toolbar">
                  {/* Quick Reactions */}
                  {['👍', '❤️', '😂', '😮', '😢'].map((emoji) => (
                    <button
                      key={emoji}
                      className="toolbar-emoji-btn"
                      onClick={() => handleToggleReaction(msg.id, emoji)}
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                  
                  {/* More Reactions Plus Button */}
                  <button
                    className="toolbar-action-btn plus-btn"
                    onClick={() => setActiveReactionPickerMessageId(activeReactionPickerMessageId === msg.id ? null : msg.id)}
                    title="Add reaction"
                  >
                    <Plus size={14} />
                  </button>

                  {/* Reply Button */}
                  <button
                    className="toolbar-action-btn reply-btn"
                    onClick={() => handleReply(msg)}
                    title="Reply"
                  >
                    <Reply size={14} />
                  </button>
                </div>
              )}

              {/* Full Emoji Picker Popover for Reactions */}
              {msg.id && activeReactionPickerMessageId === msg.id && (
                <div className={`reaction-emoji-picker-popover ${index < 3 ? 'position-below' : 'position-above'}`}>
                  <EmojiPicker
                    onEmojiClick={(emojiObj) => handleToggleReaction(msg.id, emojiObj.emoji)}
                    theme="dark"
                    width="300px"
                    height="350px"
                    searchDisabled={false}
                    skinTonesDisabled={true}
                    previewConfig={{ showPreview: false }}
                  />
                </div>
              )}

              {!isSent && Boolean(chat.is_group) && (
                <div 
                  style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--primary)', cursor: 'pointer' }}
                  onClick={() => openUserProfile(msg.sender_id)}
                >
                  {msg.sender_username}
                </div>
              )}

              {/* Quoted message (reply context) */}
              {msg.reply_original_id && (
                <div 
                  className="quoted-message"
                  onClick={() => scrollToMessage(msg.reply_original_id)}
                >
                  <div className="quoted-message-sender">
                    {msg.reply_original_sender}
                  </div>
                  <div className="quoted-message-text">
                    {msg.reply_original_media_url ? '🖼️ Media' : ''}
                    {msg.reply_original_content || ''}
                  </div>
                </div>
              )}

              {msg.media_url && (
                <div style={{ marginBottom: '0.5rem' }}>
                  {msg.media_url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || msg.media_url.includes('giphy.com') ? (
                    <img 
                      src={msg.media_url.startsWith('http') ? msg.media_url : `http://localhost:5000${msg.media_url}`} 
                      alt="attachment" 
                      style={{ maxWidth: '100%', borderRadius: '8px' }} 
                    />
                  ) : (
                    <a href={msg.media_url.startsWith('http') ? msg.media_url : `http://localhost:5000${msg.media_url}`} target="_blank" rel="noopener noreferrer" style={{ color: 'white', textDecoration: 'underline' }}>
                      View Attachment
                    </a>
                  )}
                </div>
              )}
              <div>{renderMessageContent(msg.content, (username) => {
                // Find the user by username and open profile
                const member = groupMembers.find(m => m.username === username);
                if (member) openUserProfile(member.id);
              })}</div>
              <div className="message-meta">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>

              {/* Message reactions display */}
              {msg.reactions && msg.reactions.length > 0 && (
                <div className="reactions-list">
                  {Object.entries(
                    msg.reactions.reduce((acc, r) => {
                      if (!acc[r.emoji]) acc[r.emoji] = [];
                      acc[r.emoji].push(r);
                      return acc;
                    }, {})
                  ).map(([emoji, userReactions]) => {
                    const hasReacted = userReactions.some((r) => r.user_id === user.id);
                    const tooltipText = userReactions.map((r) => r.username).join(', ');
                    return (
                      <div
                        key={emoji}
                        className={`reaction-badge ${hasReacted ? 'user-reacted' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleReaction(msg.id, emoji);
                        }}
                      >
                        <span>{emoji}</span>
                        <span>{userReactions.length}</span>
                        <div className="reaction-tooltip">{tooltipText}</div>
                      </div>
                    );
                  })}
                </div>
              )}
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
      </div>

      <div className="message-input-area" style={{ position: 'relative' }}>
        {/* Mentions dropdown */}
        {mentionQuery !== null && filteredMembers.length > 0 && (
          <div className="mentions-dropdown">
            {filteredMembers.map((member, idx) => (
              <div
                key={member.id}
                className={`mention-item ${idx === mentionIndex ? 'active' : ''}`}
                onClick={() => handleMentionSelect(member)}
              >
                <div className="mention-avatar">
                  {member.profile_pic ? (
                    <img src={`${getBaseUrl()}${member.profile_pic}`} alt={member.username} />
                  ) : (
                    member.username[0].toUpperCase()
                  )}
                </div>
                <span className="mention-username">@{member.username}</span>
              </div>
            ))}
          </div>
        )}

        {showPicker && (
          <div ref={pickerRef} className="media-picker-popup glass-panel">
            <div className="picker-tabs">
              <button 
                className={`picker-tab ${pickerTab === 'emoji' ? 'active' : ''}`}
                onClick={() => setPickerTab('emoji')}
              >
                <Smile size={16} /> Emojis
              </button>
              <button 
                className={`picker-tab ${pickerTab === 'gif' ? 'active' : ''}`}
                onClick={() => setPickerTab('gif')}
              >
                <Image size={16} /> GIFs
              </button>
              <button 
                className={`picker-tab ${pickerTab === 'sticker' ? 'active' : ''}`}
                onClick={() => setPickerTab('sticker')}
              >
                <Ghost size={16} /> Stickers
              </button>
            </div>
            
            <div className="picker-content">
              {pickerTab === 'emoji' && (
                <EmojiPicker 
                  onEmojiClick={handleEmojiClick}
                  theme="dark"
                  width="100%"
                  height={350}
                />
              )}
              {pickerTab === 'gif' && (
                <div className="mock-media-grid">
                  {MOCK_GIFS.map((url, i) => (
                    <img 
                      key={i} 
                      src={url} 
                      alt="gif" 
                      onClick={() => sendMediaUrl(url)} 
                      className="mock-media-item"
                    />
                  ))}
                </div>
              )}
              {pickerTab === 'sticker' && (
                <div className="mock-media-grid">
                  {MOCK_STICKERS.map((url, i) => (
                    <img 
                      key={i} 
                      src={url} 
                      alt="sticker" 
                      onClick={() => sendMediaUrl(url)} 
                      className="mock-media-item sticker"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reply banner */}
        {replyingTo && (
          <div className="reply-banner">
            <Reply size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <div className="reply-banner-content">
              <div className="reply-banner-sender">
                Replying to {replyingTo.sender_username}
              </div>
              <div className="reply-banner-text">
                {replyingTo.media_url ? '🖼️ Media' : ''}
                {replyingTo.content || ''}
              </div>
            </div>
            <button className="reply-banner-close" onClick={cancelReply}>
              <X size={16} />
            </button>
          </div>
        )}

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
          <button 
            type="button" 
            className={`icon-btn emoji-toggle-btn`} 
            onClick={() => setShowPicker(!showPicker)}
            disabled={!canPost}
          >
            <Smile size={20} />
          </button>
          <input 
            type="text" 
            className="message-input" 
            ref={inputRef}
            value={inputMessage} 
            onChange={handleTyping} 
            onKeyDown={handleInputKeyDown}
            placeholder={!canPost ? 'Only admins can send messages here' : (isUploading ? 'Uploading...' : (chat.is_group ? 'Type a message... (use @ to mention)' : 'Type a message...'))}
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
          socket={socket}
          onGroupDeleted={onGroupDeleted}
          onGroupUpdated={(data) => { if (onGroupUpdated) onGroupUpdated(chat.id, data); }}
        />
      )}

      {showProfileModal && (
        <ProfileModal 
          isOpen={showProfileModal} 
          onClose={() => { setShowProfileModal(false); setSelectedUserId(null); }} 
          userId={selectedUserId} 
          isOwnProfile={selectedUserId === user.id}
        />
      )}
    </div>
  );
};

export default ChatWindow;
