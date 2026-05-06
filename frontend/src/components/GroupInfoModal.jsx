import React, { useState, useEffect, useRef } from 'react';
import { X, UserPlus, Shield, User, MoreVertical, Trash2, Crown, Check, Camera } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const GroupInfoModal = ({ isOpen, onClose, chatId, onGroupDeleted, onGroupUpdated }) => {
  const { user } = useAuth();
  const [groupData, setGroupData] = useState(null);
  const [friends, setFriends] = useState([]);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [memberMenu, setMemberMenu] = useState(null);
  const [groupPicPreview, setGroupPicPreview] = useState(null);
  const [groupPicFile, setGroupPicFile] = useState(null);
  const fileInputRef = useRef(null);

  const getBaseUrl = () => import.meta.env.VITE_API_URL.replace('/api', '');

  useEffect(() => {
    if (isOpen && chatId) {
      fetchGroupInfo();
      fetchFriends();
    }
    // Reset preview on open
    setGroupPicPreview(null);
    setGroupPicFile(null);
  }, [isOpen, chatId]);

  const fetchGroupInfo = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/chats/${chatId}/members`);
      setGroupData(res.data);
    } catch (err) {
      toast.error('Failed to load group info');
    } finally {
      setLoading(false);
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

  const handleGroupPicChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setGroupPicFile(file);
    setGroupPicPreview(URL.createObjectURL(file));
  };

  const handleSaveGroupPic = async () => {
    if (!groupPicFile) return;
    try {
      const formData = new FormData();
      formData.append('group_pic', groupPicFile);
      const res = await api.put(`/chats/${chatId}/info`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Group picture updated!');
      setGroupPicPreview(null);
      setGroupPicFile(null);
      fetchGroupInfo();
      if (onGroupUpdated) onGroupUpdated({ group_pic: res.data.group_pic });
    } catch (err) {
      toast.error('Failed to update group picture');
    }
  };

  const handleAddMembers = async () => {
    try {
      await api.post(`/chats/${chatId}/members`, { memberIds: selectedNewMembers });
      toast.success('Members added!');
      setShowAddMembers(false);
      setSelectedNewMembers([]);
      fetchGroupInfo();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add members');
    }
  };

  const handleUpdateRole = async (targetUserId, role) => {
    try {
      await api.put(`/chats/${chatId}/role`, { targetUserId, role });
      toast.success(`Role updated to ${role}`);
      setMemberMenu(null);
      fetchGroupInfo();
    } catch (err) {
      toast.error('Failed to update role');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Remove this member?')) return;
    try {
      await api.delete(`/chats/${chatId}/members/${memberId}`);
      toast.success('Member removed');
      setMemberMenu(null);
      fetchGroupInfo();
    } catch (err) {
      toast.error('Failed to remove member');
    }
  };

  const handleTogglePermissions = async () => {
    try {
      await api.post(`/chats/${chatId}/permissions`, { anyoneCanPost: !groupData.anyone_can_post });
      toast.success('Permissions updated');
      fetchGroupInfo();
    } catch (err) {
      toast.error('Failed to update permissions');
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this group? This cannot be undone.')) return;
    try {
      await api.delete(`/chats/${chatId}`);
      toast.success('Group deleted');
      onClose();
      if (onGroupDeleted) onGroupDeleted(chatId);
    } catch (err) {
      toast.error('Failed to delete group');
    }
  };

  const toggleNewMember = (id) => {
    setSelectedNewMembers(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  if (!isOpen) return null;

  const currentUserMember = groupData?.members.find(m => m.id === user.id);
  const isCurrentUserAdmin = currentUserMember?.role === 'admin';
  const nonMemberFriends = friends.filter(f => !groupData?.members.some(m => m.id === f.id));
  const groupAvatarSrc = groupPicPreview || (groupData?.group_pic ? `${getBaseUrl()}${groupData.group_pic}` : null);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Group Info</h3>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
        ) : groupData && (
          <div className="group-info-body">
            {/* Group Avatar */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <div className="large-avatar" style={{ margin: '0 auto' }}>
                  {groupAvatarSrc ? (
                    <img src={groupAvatarSrc} alt="Group" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    groupData.group_name?.[0].toUpperCase()
                  )}
                </div>
                {isCurrentUserAdmin && (
                  <>
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleGroupPicChange} />
                    <div
                      className="avatar-edit"
                      onClick={() => fileInputRef.current?.click()}
                      title="Change group photo"
                    >
                      <Camera size={14} />
                    </div>
                  </>
                )}
              </div>
              <h2 style={{ margin: '0.75rem 0 0.25rem' }}>{groupData.group_name}</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{groupData.members.length} Members</p>

              {/* Save pic button */}
              {groupPicFile && (
                <button className="btn-primary" style={{ marginTop: '0.75rem', padding: '0.4rem 1.2rem', fontSize: '0.85rem' }} onClick={handleSaveGroupPic}>
                  Save Photo
                </button>
              )}
            </div>

            {/* Post Permissions Toggle (admin only) */}
            {isCurrentUserAdmin && (
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem' }}>Anyone can post messages</span>
                <button
                  className={`icon-btn ${groupData.anyone_can_post ? 'success' : ''}`}
                  onClick={handleTogglePermissions}
                  style={{ width: '36px', height: '36px', borderRadius: '50%' }}
                >
                  {groupData.anyone_can_post ? <Check size={16} /> : <X size={16} />}
                </button>
              </div>
            )}

            {/* Members Section */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ margin: 0 }}>Members</h4>
                {isCurrentUserAdmin && (
                  <button className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => setShowAddMembers(!showAddMembers)}>
                    <UserPlus size={14} /> Add
                  </button>
                )}
              </div>

              {showAddMembers && (
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ maxHeight: '140px', overflowY: 'auto', marginBottom: '0.75rem' }}>
                    {nonMemberFriends.length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>No more friends to add.</p>
                    ) : nonMemberFriends.map(friend => (
                      <div key={friend.id} className={`chat-item ${selectedNewMembers.includes(friend.id) ? 'active' : ''}`} onClick={() => toggleNewMember(friend.id)} style={{ padding: '0.35rem 0.5rem' }}>
                        <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '0.75rem' }}>
                          {friend.profile_pic ? <img src={`${getBaseUrl()}${friend.profile_pic}`} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : friend.username?.[0].toUpperCase()}
                        </div>
                        <div className="chat-name" style={{ fontSize: '0.9rem' }}>{friend.username}</div>
                        {selectedNewMembers.includes(friend.id) && <Check size={14} color="var(--primary)" />}
                      </div>
                    ))}
                  </div>
                  <button className="btn-primary" style={{ width: '100%', fontSize: '0.85rem' }} onClick={handleAddMembers} disabled={selectedNewMembers.length === 0}>
                    Add Selected ({selectedNewMembers.length})
                  </button>
                </div>
              )}

              <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {groupData.members.map(member => (
                  <div key={member.id} className="chat-item" style={{ cursor: 'default', position: 'relative' }}>
                    <div className="avatar">
                      {member.profile_pic ? <img src={`${getBaseUrl()}${member.profile_pic}`} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : member.username?.[0].toUpperCase()}
                    </div>
                    <div className="chat-info">
                      <div className="chat-name">{member.username} {member.id === user.id && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>(You)</span>}</div>
                      <div className="chat-status">{member.status}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {member.role === 'admin' && <Shield size={15} color="var(--primary)" title="Admin" />}
                      {isCurrentUserAdmin && member.id !== user.id && (
                        <div style={{ position: 'relative' }}>
                          <button className="icon-btn" style={{ width: '24px', height: '24px' }} onClick={() => setMemberMenu(memberMenu === member.id ? null : member.id)}>
                            <MoreVertical size={14} />
                          </button>
                          {memberMenu === member.id && (
                            <div className="glass-panel" style={{ position: 'absolute', top: '100%', right: 0, zIndex: 200, minWidth: '155px', padding: '0.25rem', marginTop: '0.25rem', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
                              {member.role === 'admin' ? (
                                <div className="menu-item" onClick={() => handleUpdateRole(member.id, 'member')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem', borderRadius: '0.25rem' }}>
                                  <User size={14} /> Dismiss as Admin
                                </div>
                              ) : (
                                <div className="menu-item" onClick={() => handleUpdateRole(member.id, 'admin')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem', borderRadius: '0.25rem' }}>
                                  <Crown size={14} /> Make Admin
                                </div>
                              )}
                              <div className="menu-item" onClick={() => handleRemoveMember(member.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem', borderRadius: '0.25rem', color: 'var(--danger)' }}>
                                <Trash2 size={14} /> Remove
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delete Group (admin only) */}
            {isCurrentUserAdmin && (
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button
                  onClick={handleDeleteGroup}
                  style={{ width: '100%', padding: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: '12px', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem', transition: 'all 0.2s ease' }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                >
                  <Trash2 size={16} /> Delete Group
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupInfoModal;
