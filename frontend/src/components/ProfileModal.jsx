import React, { useState, useEffect } from 'react';
import { X, Camera, Save, UserPlus, Clock, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const ProfileModal = ({ isOpen, onClose, userId, isOwnProfile }) => {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(true);

  const getBaseUrl = () => {
    return import.meta.env.VITE_API_URL.replace('/api', '');
  };

  useEffect(() => {
    if (isOpen && userId) {
      fetchProfile();
    }
  }, [isOpen, userId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/auth/profile/${userId}`);
      setProfile(res.data);
      setUsername(res.data.username || '');
      setBio(res.data.bio || '');
      setPreview(res.data.profile_pic ? `${getBaseUrl()}${res.data.profile_pic}` : '');
    } catch (err) {
      console.error('Error fetching profile', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('bio', bio);
      if (avatar) {
        formData.append('profile_pic', avatar);
      }
      
      const res = await api.put('/auth/profile', formData);

      // Update global context
      if (isOwnProfile) {
        updateUser(res.data.user);
      }

      onClose();
    } catch (err) {
      console.error('Error updating profile', err);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatar(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSendInvite = async (receiverId) => {
    try {
      await api.post('/friends/invite', { receiverId });
      // Refresh profile to show "Request Sent"
      fetchProfile();
    } catch (err) {
      console.error('Error sending invite', err);
    }
  };

  const handleAccept = async (senderId) => {
    try {
      // Find the request ID
      const res = await api.get('/friends/pending');
      const req = res.data.find(r => r.sender_id === senderId);
      if (req) {
        await api.post('/friends/respond', { requestId: req.id, action: 'accepted' });
        fetchProfile();
      }
    } catch (err) {
      console.error('Error accepting invite', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><X size={24} /></button>
        
        {loading ? (
          <div className="loading">Loading...</div>
        ) : profile && (
          <div className="profile-details">
            <div className="profile-header">
              <div className="large-avatar" style={{ position: 'relative' }}>
                {preview ? (
                  <img src={preview} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  profile.username[0].toUpperCase()
                )}
                {isOwnProfile && (
                  <label className="avatar-edit" style={{ cursor: 'pointer' }}>
                    <Camera size={16} />
                    <input type="file" style={{ display: 'none' }} onChange={handleFileChange} accept="image/*" />
                  </label>
                )}
              </div>
              {isOwnProfile ? (
                <div className="form-group" style={{ marginTop: '1rem', width: '100%' }}>
                  <input 
                    type="text" 
                    value={username} 
                    onChange={e => setUsername(e.target.value)} 
                    className="form-input text-center"
                    placeholder="Username"
                    style={{ fontSize: '1.5rem', fontWeight: 'bold' }}
                  />
                </div>
              ) : (
                <h2>{profile.username}</h2>
              )}
              <p className="text-muted">{profile.email}</p>
            </div>

            <div className="profile-body">
              <div className="form-group">
                <label>Bio</label>
                {isOwnProfile ? (
                  <textarea 
                    value={bio} 
                    onChange={e => setBio(e.target.value)} 
                    placeholder="Tell us about yourself..."
                    className="form-input"
                    rows="4"
                  />
                ) : (
                  <p className="bio-text">{profile.bio || 'No bio yet.'}</p>
                )}
              </div>
              
              <div className="profile-stats">
                <div className="stat">
                  <span className="stat-label">Joined</span>
                  <span className="stat-value">{profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Status</span>
                  <span className={`stat-value status-${profile.status}`}>{profile.status}</span>
                </div>
              </div>

              {isOwnProfile && (
                <button className="btn-primary" onClick={handleUpdate}>
                  <Save size={18} style={{ marginRight: '0.5rem' }} />
                  Save Changes
                </button>
              )}

              {!isOwnProfile && (
                <div className="profile-actions" style={{ marginTop: '1rem' }}>
                  {!profile.friendship_status && (
                    <button className="btn-primary" onClick={() => handleSendInvite(profile.id)}>
                      <UserPlus size={18} style={{ marginRight: '0.5rem' }} />
                      Add Friend
                    </button>
                  )}
                  {profile.friendship_status === 'pending' && profile.sender_id === user.id && (
                    <button className="btn-secondary" disabled style={{ opacity: 0.7 }}>
                      <Clock size={18} style={{ marginRight: '0.5rem' }} />
                      Request Sent
                    </button>
                  )}
                  {profile.friendship_status === 'pending' && profile.sender_id !== user.id && (
                    <button className="btn-primary" onClick={() => handleAccept(profile.id)}>
                      <Check size={18} style={{ marginRight: '0.5rem' }} />
                      Accept Request
                    </button>
                  )}
                  {profile.friendship_status === 'accepted' && (
                    <button className="btn-success" disabled style={{ opacity: 0.8, background: '#22c55e', color: 'white', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
                      <Check size={18} style={{ marginRight: '0.5rem' }} />
                      Connected
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileModal;
