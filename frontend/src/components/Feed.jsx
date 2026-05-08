import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Send, Heart, MessageCircle, Share2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Feed = ({ socket, setProfileModal, selectedPostId, clearSelectedPostId }) => {
  const [posts, setPosts] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [commentingOn, setCommentingOn] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState({}); // { postId: [comments] }
  const [replyingTo, setReplyingTo] = useState(null); // { id, username }
  const { user } = useAuth();
  
  // Recursive Comment Component
  const CommentItem = ({ comment, allComments, postId }) => {
    const replies = allComments.filter(c => c.parent_comment_id === comment.id);
    const [isExpanded, setIsExpanded] = useState(false);
    
    return (
      <div className="comment-item">
        <div className="comment-item-container">
          <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '0.8rem', flexShrink: 0 }}>
            {comment.profile_pic ? (
              <img src={`${getBaseUrl()}${comment.profile_pic}`} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              comment.username[0].toUpperCase()
            )}
          </div>
          <div className="comment-content-main">
            <div className="comment-header">
              <span className="username" style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-main)', cursor: 'pointer' }} onClick={() => setProfileModal({ isOpen: true, userId: comment.user_id, isOwn: comment.user_id === user.id })}>{comment.username}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(comment.created_at).toLocaleDateString()}</span>
            </div>
            <div className="comment-text" style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
              {comment.content}
            </div>
            
            <div className="comment-actions">
              <button 
                className={`comment-action-btn ${comment.is_liked ? 'active' : ''}`}
                onClick={() => handleCommentLike(comment.id, postId)}
              >
                <Heart size={14} fill={comment.is_liked ? '#f43f5e' : 'none'} />
                <span>{comment.like_count || 0}</span>
              </button>
              
              <button 
                className="comment-action-btn"
                onClick={() => {
                  setReplyingTo({ id: comment.id, username: comment.username });
                  setCommentText(`@${comment.username} `);
                }}
              >
                Reply
              </button>

              {replies.length > 0 && (
                <button 
                  className="comment-action-btn"
                  onClick={() => setIsExpanded(!isExpanded)}
                  style={{ color: 'var(--primary)', opacity: 1 }}
                >
                  {isExpanded ? 'Hide replies' : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
                </button>
              )}
            </div>
          </div>
        </div>

        {isExpanded && replies.length > 0 && (
          <div className="comment-thread">
            {replies.map(reply => (
              <CommentItem 
                key={reply.id} 
                comment={reply} 
                allComments={allComments} 
                postId={postId} 
              />
            ))}
          </div>
        )}
      </div>
    );
  };

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

      const res = await api.post('/social', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setContent('');
      setImageUrl('');
      fetchPosts();
      if (socket) socket.emit('new_post', { sender: user.username, postId: res.data.id });
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
        socket.emit('post_like', { postId, ownerId: res.data.ownerId, likerName: res.data.likerName });
      }
      fetchPosts();
    } catch (err) {
      console.error('Error liking post', err);
    }
  };

  const handleComment = async (postId) => {
    if (!commentText.trim()) return;
    try {
      const res = await api.post(`/social/${postId}/comments`, { 
        content: commentText,
        parent_comment_id: replyingTo?.id || null
      });
      
      if (socket) {
        if (res.data.ownerId) {
          socket.emit('post_comment', { postId, ownerId: res.data.ownerId, commenterName: res.data.commenterName });
        }
        if (res.data.replyToId) {
          socket.emit('comment_reply', { postId, ownerId: res.data.replyToId, commenterName: res.data.commenterName });
        }
      }
      
      setCommentText('');
      setReplyingTo(null);
      setCommentingOn(postId);
      fetchPosts();
      fetchComments(postId);
    } catch (err) {
      console.error('Error adding comment', err);
    }
  };

  const handleCommentLike = async (commentId, postId) => {
    try {
      const res = await api.post(`/social/comments/${commentId}/like`);
      if (res.data.ownerId && socket) {
        socket.emit('comment_like', { ownerId: res.data.ownerId, likerName: res.data.likerName });
      }
      fetchComments(postId);
    } catch (err) {
      console.error('Error liking comment', err);
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

  const filteredPosts = selectedPostId 
    ? posts.filter(p => p.id === parseInt(selectedPostId)) 
    : posts;

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

      {selectedPostId && (
        <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(99, 102, 241, 0.1)', marginBottom: '1rem', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>Viewing single post</span>
          <button className="text-btn" onClick={clearSelectedPostId}>Show All Posts</button>
        </div>
      )}

      <div className="post-list">
        {fetching ? (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading feed...
          </div>
        ) : error ? (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
            {error}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            {selectedPostId ? 'Post not found or unavailable.' : 'No posts yet. Be the first to share something!'}
          </div>
        ) : filteredPosts.map(post => (
          <div key={post.id} className="post-card glass-panel">
            <div className="post-card-header">
              <div className="avatar clickable" onClick={() => setProfileModal({ isOpen: true, userId: post.user_id, isOwn: post.user_id === user.id })}>
                {post.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="post-meta">
                <h4 
                  style={{ cursor: 'pointer' }}
                  onClick={() => setProfileModal({ isOpen: true, userId: post.user_id, isOwn: post.user_id === user.id })}
                >
                  {post.username}
                </h4>
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
                  {(comments[post.id] || []).filter(c => !c.parent_comment_id).map(c => (
                    <CommentItem 
                      key={c.id} 
                      comment={c} 
                      allComments={comments[post.id]} 
                      postId={post.id} 
                    />
                  ))}
                </div>
                
                <div className="comment-input-area">
                  {replyingTo && (
                    <div className="reply-indicator">
                      <span>Replying to <strong>{replyingTo.username}</strong></span>
                      <button className="text-btn" onClick={() => {
                        setReplyingTo(null);
                        setCommentText('');
                      }}>Cancel</button>
                    </div>
                  )}
                  <div className="comment-input-wrapper">
                    <input 
                      type="text" 
                      placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      className="form-input"
                    />
                    <button className="icon-btn" onClick={() => handleComment(post.id)}>
                      <Send size={16} />
                    </button>
                  </div>
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
