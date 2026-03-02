/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase'
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  writeBatch,
  getDocs
} from 'firebase/firestore'
import { useAuth } from './AuthContext'

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Real-time listener for notifications
  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore timestamp to ISO string for consistency
        created_at: doc.data().created_at?.toDate()?.toISOString() || new Date().toISOString()
      })).sort((a, b) => {
        const da = new Date(a.created_at)
        const db = new Date(b.created_at)
        return db - da
      });
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    }, (err) => {
      console.warn('Notification listener error:', err.message);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const addNotification = async (title, message, type = 'info') => {
    if (!user?.uid) return;
    
    try {
      await addDoc(collection(db, 'notifications'), {
        user_id: user.uid,
        title,
        message,
        type,
        read: false,
        created_at: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed to add notification:', err);
    }
  };

  const markAsRead = async (id) => {
    if (!user?.uid) return;
    
    try {
      const docRef = doc(db, 'notifications', id);
      await updateDoc(docRef, { read: true });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.uid || unreadCount === 0) return;
    
    try {
      const batch = writeBatch(db);
      const unreadQuery = query(
        collection(db, 'notifications'),
        where('user_id', '==', user.uid),
        where('read', '==', false)
      );
      
      const snapshot = await getDocs(unreadQuery);
      snapshot.forEach((doc) => {
        batch.update(doc.ref, { read: true });
      });
      
      await batch.commit();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      addNotification, 
      markAsRead, 
      markAllAsRead,
      refreshNotifications: () => {} // No-op now as it's real-time
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider');
  return ctx;
};
