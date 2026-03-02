import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import './SupportWidget.css';

const SupportWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { profile, user } = useAuth();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'support_tickets'), {
        user_id: user.uid,
        user_name: profile?.full_name || 'Anonymous',
        user_email: user.email,
        message: message.trim(),
        resolved: false,
        created_at: serverTimestamp()
      });
      toast('Message sent directly to Command Center.', 'success');
      setIsOpen(false);
      setMessage('');
    } catch (err) {
      toast('Failed to send message.', 'error');
    }
    setLoading(false);
  };

  return (
    <div className="support-widget-container">
      {isOpen && (
        <div className="support-widget-modal">
          <div className="support-widget-header">
            <h3>Contact Command Center</h3>
            <button onClick={() => setIsOpen(false)} className="close-btn">×</button>
          </div>
          <form onSubmit={handleSubmit} className="support-widget-body">
            <p className="support-instructions">
              Report a bug, request a feature, or ask for a promo code. Messages go directly to the platform owner.
            </p>
            <textarea
              className="support-textarea"
              placeholder="How can we help?"
              rows="4"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
              autoFocus
            />
            <button type="submit" className="support-submit-btn" disabled={loading || !message.trim()}>
              {loading ? 'Sending...' : 'Transmit Message'}
            </button>
          </form>
        </div>
      )}
      {!isOpen && (
        <button className="support-floating-btn" onClick={() => setIsOpen(true)}>
          <span className="icon">?</span>
          <span className="text">Support</span>
        </button>
      )}
    </div>
  );
};

export default SupportWidget;
