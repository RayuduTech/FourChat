import React, { useState, useEffect } from 'react';
import { X, Camera, Save } from 'lucide-react';
import api from '../services/api';

const ProfileModal = ({ isOpen, onClose, userId, isOwnProfile }) => {
  const [profile, setProfile] = useState(null);
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);

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
      setBio(res.data.bio || '');
    } catch (err) {
      console.error('Error fetching profile', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      await api.put('/auth/profile', { bio, profile_pic: profile.profile_pic });
      onClose();
    } catch (err) {
      console.error('Error updating profile', err);
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
              <div className="large-avatar">
                {profile.username[0].toUpperCase()}
                {isOwnProfile && <div className="avatar-edit"><Camera size={16} /></div>}
              </div>
              <h2>{profile.username}</h2>
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
                  <span className="stat-value">{new Date(profile.created_at).toLocaleDateString()}</span>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileModal;
