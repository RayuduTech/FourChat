import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Send, Heart, MessageCircle, Share2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Feed = ({ socket }) => {
  const [posts, setPosts] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [commentingOn, setCommentingOn] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState({}); // { postId: [comments] }
  const { user } = useAuth();
  const getBaseUrl = () => {
    return import.meta.env.VITE_API_URL.replace('/api', '');
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('new_post_notification', () => {
      fetchPosts();
    });
    return () => socket.off('new_post_notification');
  }, [socket]);

  const fetchPosts = async () => {
    try {
      setFetching(true);
      setError(null);
      const res = await api.get('/social');
      setPosts(res.data);
    } catch (err) {
      console.error('Error fetching posts', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setFetching(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!content.trim() && !imageUrl) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('content', content);
      if (imageUrl && typeof imageUrl !== 'string') {
        formData.append('image', imageUrl);
      } else if (imageUrl) {
        formData.append('image_url', imageUrl);
      }

      await api.post('/social', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setContent('');
      setImageUrl('');
      fetchPosts();
      if (socket) socket.emit('new_post', { sender: user.username });
      toast.success('Post shared!');
    } catch (err) {
      console.error('Error creating post', err);
      toast.error(err.response?.data?.error || 'Failed to post.');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      const res = await api.post(`/social/${postId}/like`);
      if (res.data.ownerId && socket) {
        socket.emit('post_like', { ownerId: res.data.ownerId, likerName: res.data.likerName });
      }
      fetchPosts();
    } catch (err) {
      console.error('Error liking post', err);
    }
  };

  const handleComment = async (postId) => {
    if (!commentText.trim()) return;
    try {
      const res = await api.post(`/social/${postId}/comments`, { content: commentText });
      if (res.data.ownerId && socket) {
        socket.emit('post_comment', { ownerId: res.data.ownerId, commenterName: res.data.commenterName });
      }
      setCommentText('');
      setCommentingOn(null);
      fetchPosts();
      fetchComments(postId);
    } catch (err) {
      console.error('Error adding comment', err);
    }
  };

  const fetchComments = async (postId) => {
    try {
      const res = await api.get(`/social/${postId}/comments`);
      setComments(prev => ({ ...prev, [postId]: res.data }));
      setCommentingOn(postId);
    } catch (err) {
      console.error('Error fetching comments', err);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageUrl(file); // Set the file object for later upload
  };

  return (
    <div className="feed-container">
      <div className="feed-header glass-panel">
        <form onSubmit={handleCreatePost} className="post-create">
          <textarea 
            placeholder="What's on your mind?" 
            value={content}
            onChange={e => setContent(e.target.value)}
            className="post-input"
          />
          {imageUrl && (
            <div className="post-preview-img">
              <img 
                src={typeof imageUrl === 'string' ? `${getBaseUrl()}${imageUrl}` : URL.createObjectURL(imageUrl)} 
                alt="preview" 
              />
              <button type="button" onClick={() => setImageUrl('')} className="remove-img">×</button>
            </div>
          )}
          <div className="post-actions">
            <label className="icon-btn">
              <ImageIcon size={20} />
              <input type="file" style={{ display: 'none' }} onChange={handleImageUpload} />
            </label>
            <button type="submit" className="btn-primary" disabled={loading || (!content.trim() && !imageUrl)}>
              {loading ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      </div>

      <div className="post-list">
        {fetching ? (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading feed...
          </div>
        ) : error ? (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
            {error}
          </div>
        ) : posts.length === 0 ? (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No posts yet. Be the first to share something!
          </div>
        ) : posts.map(post => (
          <div key={post.id} className="post-card glass-panel">
            <div className="post-card-header">
              <div className="avatar">
                {post.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="post-meta">
                <h4>{post.username}</h4>
                <span>{new Date(post.created_at).toLocaleString()}</span>
              </div>
            </div>
            <div className="post-content">
              <p>{post.content}</p>
              {post.image_url && (
                <img src={`${getBaseUrl()}${post.image_url}`} alt="post" className="post-img" />
              )}
            </div>
            <div className="post-footer">
              <button 
                className={`post-action-btn ${post.is_liked ? 'active' : ''}`} 
                onClick={() => handleLike(post.id)}
              >
                <Heart size={18} fill={post.is_liked ? 'var(--danger)' : 'none'} color={post.is_liked ? 'var(--danger)' : 'currentColor'} /> 
                {post.like_count || 0} Likes
              </button>
              <button className="post-action-btn" onClick={() => fetchComments(post.id)}>
                <MessageCircle size={18} /> {post.comment_count || 0} Comments
              </button>
              <button className="post-action-btn"><Share2 size={18} /> Share</button>
            </div>

            {commentingOn === post.id && (
              <div className="comment-section">
                <div className="comment-list">
                  {comments[post.id]?.map(c => (
                    <div key={c.id} className="comment-item">
                      <strong>{c.username}: </strong> {c.content}
                    </div>
                  ))}
                </div>
                <div className="comment-input-area">
                  <input 
                    type="text" 
                    placeholder="Write a comment..." 
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    className="form-input"
                  />
                  <button className="icon-btn" onClick={() => handleComment(post.id)}>
                    <Send size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Feed;
