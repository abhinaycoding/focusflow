import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import {
  collection, query, orderBy, limit, onSnapshot, where,
  doc, updateDoc, deleteDoc, serverTimestamp, setDoc, getDocs, addDoc
} from 'firebase/firestore';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { seedScholars } from '../utils/SeedMockUsers';
import './AdminDashboard.css';

const AdminDashboard = ({ onNavigate }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [metrics, setMetrics] = useState({ 
    totalRevenue: 0, 
    dailyRevenue: 0,
    weeklyRevenue: 0,
    totalUsers: 0, 
    activeRooms: 0, 
    masterUsers: 0, 
    totalTasks: 0, 
    totalSessions: 0,
    liveScholars: 0
  });
  const [payments, setPayments] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [supportTickets, setSupportTickets] = useState([]);
  const [promoCodes, setPromoCodes] = useState([]);
  const [liveActivity, setLiveActivity] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [newPromo, setNewPromo] = useState({ code: '', discount: 10 });
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [broadcast, setBroadcast] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [userSearch, setUserSearch] = useState('');
  const [masterSearch, setMasterSearch] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [currentBroadcast, setCurrentBroadcast] = useState('');

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserStats, setSelectedUserStats] = useState({ tasks: [], notes: [] });
  
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedRoomStats, setSelectedRoomStats] = useState({ chats: [], tasks: [], occupants: [] });

  useEffect(() => {
    // 1. Payments & Revenue breakdown
    const unsubPayments = onSnapshot(
      query(collection(db, 'payments'), orderBy('timestamp', 'desc')),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPayments(list);
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const weekAgo = today - (7 * 24 * 60 * 60 * 1000);

        const total = list.reduce((a, c) => a + (c.amount || 0), 0);
        const day = list.filter(p => {
          const t = p.timestamp?.toDate?.()?.getTime() || 0;
          return t >= today;
        }).reduce((a, c) => a + (c.amount || 0), 0);
        
        const week = list.filter(p => {
          const t = p.timestamp?.toDate?.()?.getTime() || 0;
          return t >= weekAgo;
        }).reduce((a, c) => a + (c.amount || 0), 0);

        setMetrics(p => ({ ...p, totalRevenue: total, dailyRevenue: day, weeklyRevenue: week }));
      }, err => console.warn('payments:', err.message)
    );

    // 2. Profiles & Recent activity
    const unsubProfiles = onSnapshot(
      query(collection(db, 'profiles')),
      (snap) => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const sorted = [...all]
          .filter(u => u.updated_at)
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        
        setUsers(all);
        setRecentUsers(sorted.slice(0, 10));
        setMetrics(p => ({ ...p, totalUsers: snap.size, masterUsers: all.filter(u => u.is_pro).length }));
      }, err => console.warn('profiles:', err.message)
    );

    // 3. Live Activity Monitor
    const twentyMins = new Date(Date.now() - 20 * 60 * 1000);
    const unsubLive = onSnapshot(
      query(collection(db, 'room_members'), where('last_seen', '>=', twentyMins)),
      (snap) => {
        const live = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setLiveActivity(live);
        setMetrics(p => ({ ...p, liveScholars: new Set(live.map(l => l.user_id)).size }));
      }
    );

    // 4. Rooms
    const unsubRooms = onSnapshot(
      query(collection(db, 'study_rooms'), limit(50)),
      (snap) => {
        setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setMetrics(p => ({ ...p, activeRooms: snap.size }));
      }, err => console.warn('rooms:', err.message)
    );

    // 5. Support Tickets
    const unsubTickets = onSnapshot(
      query(collection(db, 'support_tickets'), orderBy('created_at', 'desc')),
      (snap) => {
        setSupportTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, err => console.warn('tickets:', err.message)
    );

    // 6. Global Settings
    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'global'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setIsMaintenance(data.maintenance_active === true);
          setIsBroadcasting(data.announcement_active === true);
          setCurrentBroadcast(data.announcement || '');
        }
      }, err => console.warn('settings:', err.message)
    );

    // 7. Promo Codes
    const unsubPromos = onSnapshot(
      collection(db, 'promo_codes'),
      (snap) => {
        setPromoCodes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, err => console.warn('promos:', err.message)
    );

    // Platform totals (Background)
    const fetchTotals = async () => {
      try {
        const [tasks, notes] = await Promise.all([
          getDocs(query(collection(db, 'tasks'), limit(500))),
          getDocs(query(collection(db, 'notes'), limit(500)))
        ]);
        setMetrics(p => ({ ...p, totalTasks: tasks.size, totalNotes: notes.size }));
      } catch (e) { /* ignore */ }
    };
    fetchTotals();

    return () => { 
      unsubPayments(); unsubProfiles(); unsubRooms(); unsubTickets(); 
      unsubSettings(); unsubPromos(); unsubLive();
    };
  }, []);

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (passcode === '2004') {
      try {
        // We no longer permanently write isAdmin to Firestore here
        // The user must already be an admin to even see the Command Center link.
        // This passcode just acts as a secondary unlocking step.
        setIsUnlocked(true);
        setPasscodeError(false);
      } catch (err) {
        console.error('Unlock error:', err);
        // Even if profiling fails, unlock the UI
        setIsUnlocked(true);
        toast('Admin status update failed, but access granted.', 'warning');
      }
    } else {
      setPasscodeError(true);
      setPasscode('');
      setTimeout(() => setPasscodeError(false), 2000);
    }
  };

  const handleCreatePromo = async () => {
    if (!newPromo.code) return toast('Protocol Error: Code Name Required', 'error');
    const discountValue = Number(newPromo.discount);
    if (isNaN(discountValue) || discountValue < 0 || discountValue > 100) {
      return toast('Validation Error: Discount must be 0-100%', 'error');
    }

    try {
      await addDoc(collection(db, 'promo_codes'), {
        code: newPromo.code.toUpperCase().trim(),
        discount_pct: discountValue,
        active: true,
        created_at: serverTimestamp()
      });
      toast(`Deployment Successful: ${newPromo.code.toUpperCase()} active.`, 'success');
      setNewPromo({ code: '', discount: 10 });
    } catch (err) { 
      console.error('PROMO_CREATE_ERROR:', err);
      toast(`Deployment Failed: ${err.message}`, 'error'); 
    }
  };

  const handleTogglePromo = async (id, currentStatus) => {
    try {
      await updateDoc(doc(db, 'promo_codes', id), { active: !currentStatus });
      toast('Code status updated.', 'success');
    } catch { toast('Failed to update code.', 'error'); }
  };

  const handleGrantPro = async (userId, grant) => {
    try {
      await updateDoc(doc(db, 'profiles', userId), { is_pro: grant });
      toast(grant ? '✅ Pro granted!' : '❌ Pro revoked.', grant ? 'success' : 'info');
    } catch { toast('Failed to update user.', 'error'); }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm('Delete this room permanently?')) return;
    try {
      await deleteDoc(doc(db, 'study_rooms', roomId));
      toast('Room deleted.', 'success');
    } catch { toast('Failed to delete room.', 'error'); }
  };

  const handleBroadcast = async () => {
    if (!broadcast.trim()) return;
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        announcement: broadcast,
        announcement_at: serverTimestamp(),
        announcement_active: true
      }, { merge: true });
      toast('Broadcast sent!', 'success');
      setBroadcast('');
    } catch { toast('Failed. Create settings/global doc first.', 'error'); }
  };

  const handleStopBroadcast = async () => {
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        announcement_active: false
      }, { merge: true });
      toast('Broadcast stopped.', 'success');
    } catch { toast('Failed to stop broadcast.', 'error'); }
  };

  const handleToggleMaintenance = async () => {
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        maintenance_active: !isMaintenance
      }, { merge: true });
      toast(isMaintenance ? 'Platform online.' : '🚨 MAINTENANCE MODE ENGAGED.', isMaintenance ? 'success' : 'error');
    } catch { toast('Failed to toggle maintenance mode.', 'error'); }
  };

  const handleSeedScholars = async () => {
    const success = await seedScholars();
    if (success) toast('Scholars Seeded Successfully! 🏆', 'success');
    else toast('Seeding Failed.', 'error');
  };

  const handleResolveTicket = async (id, isResolved) => {
    try {
      await updateDoc(doc(db, 'support_tickets', id), { resolved: isResolved });
      toast('Ticket status updated.', 'success');
    } catch { toast('Failed to update ticket.', 'error'); }
  };

  const handleViewUser = async (userObj) => {
    setSelectedUser(userObj);
    try {
      const [tasksSnap, notesSnap] = await Promise.all([
        getDocs(query(collection(db, 'tasks'), where('user_id', '==', userObj.id), limit(50))),
        getDocs(query(collection(db, 'notes'), where('user_id', '==', userObj.id), limit(50)))
      ]);
      setSelectedUserStats({
        tasks: tasksSnap.docs.map(d => ({id: d.id, ...d.data()})),
        notes: notesSnap.docs.map(d => ({id: d.id, ...d.data()}))
      });
    } catch (e) {
      toast('Failed to load user details', 'error');
    }
  };

  const handleBanUser = async (userId, currentBanStatus) => {
    try {
      await updateDoc(doc(db, 'profiles', userId), { isBanned: !currentBanStatus });
      toast(!currentBanStatus ? 'User banned from platform.' : 'User ban lifted.', 'success');
    } catch { toast('Failed to update ban status.', 'error'); }
  };

  const handleViewRoom = async (roomObj) => {
    setSelectedRoom(roomObj);
    try {
      const [chatsSnap, tasksSnap, occupantsSnap] = await Promise.all([
        getDocs(query(collection(db, 'study_rooms', roomObj.id, 'messages'), orderBy('timestamp', 'desc'), limit(50))),
        getDocs(query(collection(db, 'study_rooms', roomObj.id, 'tasks'), limit(50))),
        getDocs(query(collection(db, 'room_members'), where('room_id', '==', roomObj.id)))
      ]);
      setSelectedRoomStats({
        chats: chatsSnap.docs.map(d => ({id: d.id, ...d.data()})),
        tasks: tasksSnap.docs.map(d => ({id: d.id, ...d.data()})),
        occupants: occupantsSnap.docs.map(d => ({id: d.id, ...d.data()}))
      });
    } catch (e) {
      toast('Failed to load room details', 'error');
    }
  };

  const handleKickUser = async (memberId) => {
    try {
      await deleteDoc(doc(db, 'room_members', memberId));
      toast('User kicked from room.', 'success');
      setSelectedRoomStats(prev => ({
        ...prev,
        occupants: prev.occupants.filter(o => o.id !== memberId)
      }));
    } catch { toast('Failed to kick user.', 'error'); }
  };

  const filteredUsers = users.filter(u =>
    !userSearch || (u.full_name || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  const globalSearchItems = [
    ...users.map(u => ({ type: 'User', name: u.full_name, id: u.id, sub: u.student_type, link: 'users' })),
    ...rooms.map(r => ({ type: 'Room', name: r.name, id: r.id, sub: r.code, link: 'rooms' })),
    ...payments.map(p => ({ type: 'Payment', name: `₹${p.amount} from ${p.userName}`, id: p.id, sub: p.razorpay_payment_id, link: 'payments' }))
  ].filter(item => 
    !masterSearch || 
    (item.name || '').toLowerCase().includes(masterSearch.toLowerCase()) || 
    (item.id || '').toLowerCase().includes(masterSearch.toLowerCase())
  );

  const convRate = metrics.totalUsers ? ((metrics.masterUsers / metrics.totalUsers) * 100).toFixed(1) : '0.0';

  if (!isUnlocked) {
    return (
      <div className="citadel-theme">
        <div className="admin-lock-screen">
          <div className="admin-lock-box">
            <div className="admin-lock-icon">🔒</div>
            <h1 className="admin-lock-title">RESTRICTED ACCESS</h1>
            <p className="admin-lock-subtitle">Enter Owner Authorization Code</p>
            <form onSubmit={handleUnlock} className="admin-lock-form">
              <input 
                type="password" 
                className={`admin-passcode-input ${passcodeError ? 'error' : ''}`}
                placeholder="••••"
                maxLength={4}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                autoFocus
              />
              <button type="submit" className="admin-btn">AUTHORIZE</button>
            </form>
            {passcodeError && <div className="admin-lock-error">ACCESS DENIED</div>}
            <button className="admin-abort-btn" onClick={() => onNavigate('dashboard')}>
              ← Abort & Return
            </button>
          </div>
        </div>
      </div>
    );
  }

  const earningsPerScholar = metrics.totalUsers ? (metrics.totalRevenue / metrics.totalUsers).toFixed(2) : '0.00';

  return (
    <div className="citadel-theme">
      <div className="citadel-layout">
        {/* ── Sidebar Navigation ── */}
        <aside className="citadel-sidebar">
          <div className="sidebar-brand">
            <h1 className="citadel-title">Command</h1>
            <span className="citadel-version">v2.5</span>
          </div>

          <nav className="sidebar-nav">
            <button
              className={`nav-item ${activeTab === 'overview' ? 'sidebar-active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <span className="icon">📊</span> Overview
            </button>
            <button
              className={`nav-item ${activeTab === 'scholars' ? 'sidebar-active' : ''}`}
              onClick={() => setActiveTab('scholars')}
            >
              <span className="icon">👥</span> Scholars
            </button>
            <button
              className={`nav-item ${activeTab === 'rooms' ? 'sidebar-active' : ''}`}
              onClick={() => setActiveTab('rooms')}
            >
              <span className="icon">🏠</span> Study Rooms
            </button>
            <button
              className={`nav-item ${activeTab === 'promos' ? 'sidebar-active' : ''}`}
              onClick={() => setActiveTab('promos')}
            >
              <span className="icon">🏷️</span> Promo Codes
            </button>
            <button
              className={`nav-item ${activeTab === 'support' ? 'sidebar-active' : ''}`}
              onClick={() => setActiveTab('support')}
            >
              <span className="icon">🎧</span> Support
            </button>
            <button
              className={`nav-item ${activeTab === 'system' ? 'sidebar-active' : ''}`}
              onClick={() => setActiveTab('system')}
            >
              <span className="icon">⚙️</span> System
            </button>
          </nav>

          <div className="sidebar-footer">
            <button className="citadel-btn-main secondary w-full" onClick={() => onNavigate('dashboard')}>
              ← Exit Command
            </button>
          </div>
        </aside>

        {/* ── Main Content Area ── */}
        <main className="citadel-main">
          <header className="citadel-top-bar">
            <div className="search-box">
              <span className="icon">🔍</span>
              <input
                type="text"
                placeholder={`Search in ${activeTab}...`}
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
            </div>
            <div className="top-bar-stats">
              <div className="stat">
                <span className="dot green pulse"></span>
                {metrics.liveScholars} Scholars Live
              </div>
            </div>
          </header>

          <div className="citadel-viewport">
            {activeTab === 'overview' && (
              <div className="section-fade-in">
                <div className="citadel-metrics-summary">
                  <div className="citadel-metric-card">
                    <span className="label">Total Revenue</span>
                    <div className="value">₹{metrics.totalRevenue}</div>
                    <div className="card-bg-icon">💰</div>
                  </div>
                  <div className="citadel-metric-card">
                    <span className="label">Active Scholars</span>
                    <div className="value">{metrics.totalUsers}</div>
                    <div className="card-bg-icon">👥</div>
                  </div>
                  <div className="citadel-metric-card">
                    <span className="label">Pro Deployments</span>
                    <div className="value">{metrics.masterUsers}</div>
                    <div className="card-bg-icon">🛡️</div>
                  </div>
                  <div className="citadel-metric-card">
                    <span className="label">Daily Earnings</span>
                    <div className="value">₹{metrics.dailyRevenue}</div>
                    <div className="card-bg-icon">📈</div>
                  </div>
                </div>

                <div className="admin-panel mt-6">
                  <div className="admin-panel-header">
                    <h2 className="admin-panel-title">Recent Transactions</h2>
                  </div>
                  <div className="admin-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th align="left">USER</th>
                          <th align="left">EMAIL</th>
                          <th align="center">AMOUNT</th>
                          <th align="center">PROMO</th>
                          <th align="right">DATE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.slice(0, 10).map(p => (
                          <tr key={p.id}>
                            <td align="left" className="font-bold">{p.userName || 'Scholar'}</td>
                            <td align="left" className="opacity-50 text-xs">{p.userEmail || '—'}</td>
                            <td align="center" className="text-primary font-bold">₹{p.amount}</td>
                            <td align="center">
                              {p.promo_used ? (
                                <span className="citadel-badge pro" style={{ fontSize: '10px' }}>{p.promo_used}</span>
                              ) : (
                                <span className="opacity-30">—</span>
                              )}
                            </td>
                            <td align="right" className="text-xs opacity-50">
                              {p.timestamp?.toDate ? p.timestamp.toDate().toLocaleString() : 'Just now'}
                            </td>
                          </tr>
                        ))}
                        {payments.length === 0 && (
                          <tr>
                            <td colSpan="5" className="text-center py-8 opacity-50">No recent transactions found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'scholars' && (
              <div className="section-fade-in">
                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <h2 className="admin-panel-title">Scholar Management</h2>
                  </div>
                  <div className="admin-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th align="left">SCHOLAR NAME</th>
                          <th align="left">STUDENT TYPE</th>
                          <th align="left">TIER</th>
                          <th align="right">OPERATIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map(u => (
                          <tr key={u.id}>
                            <td align="left" className="font-bold">{u.full_name || 'Anonymous'}</td>
                            <td align="left" className="opacity-50 text-xs uppercase">{u.student_type || 'General'}</td>
                            <td align="left">
                              <span className={`citadel-badge ${u.is_pro ? 'pro' : 'free'}`} style={{ marginRight: '8px' }}>
                                {u.is_pro ? 'PRO' : 'FREE'}
                              </span>
                              {u.isBanned && (
                                <span className="citadel-badge" style={{ background: '#ef4444', color: 'white' }}>BANNED</span>
                              )}
                            </td>
                            <td align="right">
                              <div className="flex justify-end gap-2">
                                <button className="citadel-action-btn" style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }} onClick={() => handleViewUser(u)}>
                                  Insights
                                </button>
                                <button
                                  className={`citadel-action-btn ${u.is_pro ? 'revoke' : 'grant'}`}
                                  onClick={() => handleGrantPro(u.id, !u.is_pro)}
                                >
                                  {u.is_pro ? '- Pro' : '+ Pro'}
                                </button>
                                <button 
                                  className={`citadel-action-btn ${u.isBanned ? 'grant' : 'revoke'}`} 
                                  onClick={() => handleBanUser(u.id, u.isBanned)}
                                >
                                  {u.isBanned ? 'Unban' : 'Ban'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'rooms' && (
              <div className="section-fade-in">
                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <h2 className="admin-panel-title">Live Occupancy (Study Rooms)</h2>
                  </div>
                  <div className="citadel-room-grid p-6">
                    {rooms.map(r => {
                      const occupants = liveActivity.filter(l => l.room_id === r.id).length;
                      return (
                        <div key={r.id} className={`citadel-room-status clickable-row ${occupants > 0 ? 'active' : ''}`} onClick={() => handleViewRoom(r)}>
                          <div className="room-name">{r.name}</div>
                          <div className="room-occupancy">
                            <span className="dot"></span>
                            {occupants} Active Scholars
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'promos' && (
              <div className="section-fade-in">
                <div className="citadel-promo-layout">
                  <div className="admin-panel">
                    <div className="admin-panel-header">
                      <h2 className="admin-panel-title">Deploy Promo</h2>
                    </div>
                    <div className="p-6">
                      <div className="flex flex-col gap-4">
                        <input
                          className="citadel-input-small w-full"
                          placeholder="PROMO_CODE"
                          value={newPromo.code}
                          onChange={e => setNewPromo({...newPromo, code: e.target.value.toUpperCase()})}
                        />
                        <input
                          type="number"
                          className="citadel-input-small w-full"
                          placeholder="DISCOUNT %"
                          value={newPromo.discount}
                          onChange={e => setNewPromo({...newPromo, discount: e.target.value})}
                        />
                        <button className="citadel-action-btn grant w-full mt-2" onClick={handleCreatePromo}>
                          GENERATE & DEPLOY
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="admin-panel">
                    <div className="admin-panel-header">
                      <h2 className="admin-panel-title">Active Deployments</h2>
                    </div>
                    <div className="admin-table-container">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th align="left">CODE</th>
                            <th align="left">DISCOUNT</th>
                            <th align="center">STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {promoCodes.map(p => (
                            <tr key={p.id}>
                              <td align="left" className="font-bold text-primary">{p.code}</td>
                              <td align="left" className="font-black">{p.discount_pct}% OFF</td>
                              <td align="center">
                                <span className={`citadel-badge ${p.active ? 'pro' : 'free'}`} onClick={() => handleTogglePromo(p.id, p.active)} style={{cursor: 'pointer'}}>
                                  {p.active ? 'ON' : 'OFF'}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {promoCodes.length === 0 && (
                            <tr><td colSpan="3" className="text-center py-20 opacity-30 italic">No promo codes deployed.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'support' && (
              <div className="section-fade-in">
                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <h2 className="admin-panel-title">Support Intelligence</h2>
                  </div>
                  <div className="admin-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th align="left">SCHOLAR</th>
                          <th align="left">ISSUE</th>
                          <th align="right">ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supportTickets.map(t => (
                          <tr key={t.id}>
                            <td align="left" className="font-bold">{t.user_name || 'Anonymous'}</td>
                            <td align="left" className="text-sm opacity-50">{t.subject}</td>
                            <td align="right">
                              <button
                                className={`citadel-action-btn ${t.resolved ? 'revoke' : 'grant'}`}
                                onClick={() => handleResolveTicket(t.id, !t.resolved)}
                              >
                                {t.resolved ? 'Reopen' : 'Resolve'}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {supportTickets.length === 0 && (
                          <tr><td colSpan="3" className="text-center py-20 opacity-30 italic">No tickets found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'system' && (
              <div className="section-fade-in">
                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <h2 className="admin-panel-title">Deployment Controls</h2>
                  </div>
                  <div className="p-6 flex flex-col gap-6">
                    <button
                      className={`citadel-btn-main w-full ${isMaintenance ? 'active' : ''}`}
                      onClick={handleToggleMaintenance}
                    >
                      {isMaintenance ? '🚫 DISENGAGE LOCKDOWN' : '🚨 ENGAGE PLATFORM LOCKDOWN'}
                    </button>
                    <div className="admin-broadcast-section">
                      <h3 className="text-white font-bold mb-4">Platform Broadcast</h3>
                      {isBroadcasting && (
                        <div className="mb-4 p-4 rounded flex justify-between items-center" style={{background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)'}}>
                          <div className="text-red-400">
                            <span className="font-bold mr-2">LIVE:</span> 
                            {currentBroadcast}
                          </div>
                          <button 
                            className="citadel-btn-main" 
                            style={{background: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(239, 68, 68, 0.5)', color: 'white', padding: '0.5rem 1rem', minWidth: 'auto'}} 
                            onClick={handleStopBroadcast}
                          >
                            STOP
                          </button>
                        </div>
                      )}
                      <textarea
                        className="citadel-textarea mb-4"
                        placeholder="Broadcast to all scholarship terminals..."
                        value={broadcast}
                        onChange={e => setBroadcast(e.target.value)}
                      />
                      <button className="citadel-btn-main secondary w-full" onClick={handleBroadcast}>
                        TRANSMIT BANNER
                      </button>
                    </div>

                    <div className="admin-danger-zone mt-8 pt-6 border-t border-red-500/20">
                      <h3 className="text-red-400 font-bold mb-4">Development Utilities</h3>
                      <button 
                        className="citadel-btn-main w-full" 
                        style={{background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)', color: '#60a5fa'}}
                        onClick={handleSeedScholars}
                      >
                        🚀 SEED REPUTATION SCHOLARS (INDIAN)
                      </button>
                      <p className="text-[10px] opacity-40 mt-2 text-center">Populates leaderboard with high-ranking scholars for social proof.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Insights Modal */}
          {selectedUser && (
            <div className="admin-modal-overlay" onClick={() => setSelectedUser(null)}>
              <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
                <div className="admin-modal-header">
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedUser.full_name || 'Anonymous'}</h2>
                    <p className="text-sm opacity-50">{selectedUser.email}</p>
                  </div>
                  <button className="admin-modal-close" onClick={() => setSelectedUser(null)}>×</button>
                </div>
                <div className="admin-modal-body">
                  <div className="admin-grid-2">
                    <div className="admin-panel">
                      <div className="p-4 border-b border-[rgba(255,255,255,0.05)] font-bold">Recent Tasks ({selectedUserStats.tasks.length})</div>
                      <div className="admin-log-box" style={{ border: 'none', background: 'transparent' }}>
                        {selectedUserStats.tasks.length === 0 ? <p className="opacity-50 text-sm italic">No tasks found.</p> : null}
                        {selectedUserStats.tasks.map(t => (
                          <div key={t.id} className="admin-log-item">
                            <div className="admin-log-meta">
                              <span>{t.date || 'No Date'}</span>
                              <span style={{ color: t.completed ? '#10b981' : '#ef4444' }}>{t.completed ? 'Done' : 'Pending'}</span>
                            </div>
                            <div>{t.title}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="admin-panel">
                      <div className="p-4 border-b border-[rgba(255,255,255,0.05)] font-bold">Recent Notes ({selectedUserStats.notes.length})</div>
                      <div className="admin-log-box" style={{ border: 'none', background: 'transparent' }}>
                        {selectedUserStats.notes.length === 0 ? <p className="opacity-50 text-sm italic">No notes found.</p> : null}
                        {selectedUserStats.notes.map(n => (
                          <div key={n.id} className="admin-log-item">
                            <div className="admin-log-meta">{new Date(n.created_at?.toDate?.() || Date.now()).toLocaleDateString()}</div>
                            <div className="font-bold">{n.title}</div>
                            <div className="text-xs opacity-70 mt-1 line-clamp-2">{n.content}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end mt-4 pt-4 border-t border-[rgba(255,255,255,0.05)]">
                    <button 
                      className={`citadel-btn-main ${selectedUser.isBanned ? 'secondary' : 'active'}`}
                      onClick={() => {
                        handleBanUser(selectedUser.id, selectedUser.isBanned);
                        setSelectedUser({...selectedUser, isBanned: !selectedUser.isBanned});
                      }}
                    >
                      {selectedUser.isBanned ? 'RESTORE ACCESS' : 'BAN SCHOLAR'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Room Insights Modal */}
          {selectedRoom && (
            <div className="admin-modal-overlay" onClick={() => setSelectedRoom(null)}>
              <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
                <div className="admin-modal-header">
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedRoom.name}</h2>
                    <p className="text-sm opacity-50">Code: {selectedRoom.code || 'N/A'}</p>
                  </div>
                  <button className="admin-modal-close" onClick={() => setSelectedRoom(null)}>×</button>
                </div>
                <div className="admin-modal-body">
                  
                  <div className="admin-panel mb-4">
                    <div className="p-4 border-b border-[rgba(255,255,255,0.05)] font-bold">Active Occupants ({selectedRoomStats.occupants.length})</div>
                    <div className="p-4 flex flex-wrap gap-2">
                      {selectedRoomStats.occupants.length === 0 ? <p className="opacity-50 text-sm italic">Room is empty.</p> : null}
                      {selectedRoomStats.occupants.map(o => (
                        <div key={o.id} className="flex items-center gap-2 bg-[rgba(255,255,255,0.05)] px-3 py-1.5 rounded-full text-sm">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          {o.user_name || 'Anonymous'}
                          <button 
                            className="ml-2 text-red-400 hover:text-red-300 font-bold px-1"
                            onClick={() => handleKickUser(o.id)}
                            title="Kick User"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="admin-grid-2">
                    <div className="admin-panel">
                      <div className="p-4 border-b border-[rgba(255,255,255,0.05)] font-bold">Chat Logs</div>
                      <div className="admin-log-box" style={{ border: 'none', background: 'transparent' }}>
                        {selectedRoomStats.chats.length === 0 ? <p className="opacity-50 text-sm italic">No messages found.</p> : null}
                        {selectedRoomStats.chats.map(msg => (
                          <div key={msg.id} className="admin-log-item">
                            <div className="admin-log-meta">
                              <span className="font-bold text-white">{msg.user_name || 'System'}</span>
                              <span>{msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString() : 'Now'}</span>
                            </div>
                            <div className="text-sm">{msg.text}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="admin-panel">
                      <div className="p-4 border-b border-[rgba(255,255,255,0.05)] font-bold">Collab Tasks</div>
                      <div className="admin-log-box" style={{ border: 'none', background: 'transparent' }}>
                        {selectedRoomStats.tasks.length === 0 ? <p className="opacity-50 text-sm italic">No collaborative tasks found.</p> : null}
                        {selectedRoomStats.tasks.map(t => (
                          <div key={t.id} className="admin-log-item">
                            <div className="admin-log-meta">
                              <span>Assigned to: {t.assignee_name || 'Unassigned'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>{t.title}</span>
                              <span style={{ color: t.completed ? '#10b981' : '#ef4444', fontSize: '0.7rem' }}>
                                {t.completed ? 'Done' : 'Pending'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
