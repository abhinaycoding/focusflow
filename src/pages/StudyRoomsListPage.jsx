import React, { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, setDoc } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useTranslation } from '../contexts/LanguageContext'
import './StudyRoomsListPage.css'

const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase()

const StudyRoomsListPage = ({ onNavigate, onEnterRoom }) => {
  const { user } = useAuth()
  const toast = useToast()
  const { t } = useTranslation()
  const [myRooms, setMyRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [activeTab, setActiveTab] = useState('my')

  useEffect(() => {
    if (user?.uid) fetchMyRooms()
  }, [user])

  const fetchMyRooms = async () => {
    try {
      setLoading(true)
      const q = query(collection(db, 'room_members'), where('user_id', '==', user.uid))
      const memberSnap = await getDocs(q)
      const roomIds = memberSnap.docs.map(doc => doc.data().room_id)

      if (roomIds.length === 0) {
        setMyRooms([])
        return
      }

      // Fetch room details in chunks (max 10 per 'in' query)
      const roomsData = []
      for (let i = 0; i < roomIds.length; i += 10) {
        const chunk = roomIds.slice(i, i + 10)
        const roomSnap = await getDocs(query(collection(db, 'study_rooms'), where('id', 'in', chunk)))
        roomSnap.forEach(doc => roomsData.push({ id: doc.id, ...doc.data() }))
      }
      setMyRooms(roomsData)
    } catch (err) {
      console.error('Failed to fetch rooms:', err.message)
    } finally {
      setLoading(false)
    }
  }

  const createRoom = async () => {
    if (!roomName.trim() || !user?.uid) return
    setCreating(true)
    try {
      const code = generateCode()
      const roomData = { 
        name: roomName.trim(), 
        code, 
        created_by: user.uid,
        created_at: new Date().toISOString()
      }
      
      const roomRef = await addDoc(collection(db, 'study_rooms'), roomData)
      const roomId = roomRef.id
      
      await setDoc(doc(db, 'study_rooms', roomId), { id: roomId }, { merge: true })

      await addDoc(collection(db, 'room_members'), {
        room_id: roomId,
        user_id: user.uid,
        joined_at: new Date().toISOString()
      })

      toast(`Room "${roomName}" created! Code: ${code}`, 'success', 5000)
      setRoomName('')
      setActiveTab('my')
      fetchMyRooms()
      onEnterRoom(roomId, roomName)
    } catch (err) {
      toast('Failed to create room.', 'error')
      console.error(err.message)
    } finally {
      setCreating(false)
    }
  }

  const joinRoom = async () => {
    if (!joinCode.trim() || !user?.uid) return
    setJoining(true)
    try {
      const q = query(collection(db, 'study_rooms'), where('code', '==', joinCode.trim().toUpperCase()))
      const roomSnap = await getDocs(q)

      if (roomSnap.empty) {
        toast('Room not found. Check the code.', 'error')
        return
      }

      const room = { id: roomSnap.docs[0].id, ...roomSnap.docs[0].data() }

      const memberQ = query(
        collection(db, 'room_members'), 
        where('room_id', '==', room.id),
        where('user_id', '==', user.uid)
      )
      const memberSnap = await getDocs(memberQ)

      if (memberSnap.empty) {
        await addDoc(collection(db, 'room_members'), {
          room_id: room.id,
          user_id: user.uid,
          joined_at: new Date().toISOString()
        })
      }

      toast(`Joined "${room.name}"!`, 'success')
      setJoinCode('')
      fetchMyRooms()
      onEnterRoom(room.id, room.name)
    } catch (err) {
      toast('Failed to join room.', 'error')
      console.error(err.message)
    } finally {
      setJoining(false)
    }
  }

  const leaveRoom = async (roomId, e) => {
    e.stopPropagation()
    if (!user?.uid) return
    try {
      const q = query(
        collection(db, 'room_members'), 
        where('room_id', '==', roomId),
        where('user_id', '==', user.uid)
      )
      const snap = await getDocs(q)
      snap.forEach(async (d) => await deleteDoc(doc(db, 'room_members', d.id)))
      
      setMyRooms(prev => prev.filter(r => r.id !== roomId))
      toast('Left the room.', 'success')
    } catch (err) {
      console.error(err.message)
    }
  }

  return (
    <>
      <main className="rooms-main container">
        {/* Tabs */}
        <div className="rooms-tabs">
          <button className={`rooms-tab ${activeTab === 'my' ? 'active' : ''}`} onClick={() => setActiveTab('my')}>My Rooms</button>
          <button className={`rooms-tab ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')}>+ Create</button>
          <button className={`rooms-tab ${activeTab === 'join' ? 'active' : ''}`} onClick={() => setActiveTab('join')}>Join Room</button>
        </div>

        {/* My Rooms Tab */}
        {activeTab === 'my' && (
          <div className="rooms-list-section">
            {loading ? (
              <div className="rooms-loading">
                <div className="skeleton" style={{ height: '80px', marginBottom: '1rem' }} />
                <div className="skeleton" style={{ height: '80px', marginBottom: '1rem' }} />
              </div>
            ) : myRooms.length === 0 ? (
              <div className="rooms-empty">
                <div className="rooms-empty-icon">📚</div>
                <p className="font-serif italic text-lg">No rooms yet.</p>
                <p className="text-xs text-muted mt-1 uppercase tracking-widest">Create or join a room to study together.</p>
                <div className="flex gap-4 mt-6 justify-center">
                  <button className="rooms-cta-btn" onClick={() => setActiveTab('create')}>Create Room</button>
                  <button className="rooms-cta-btn rooms-cta-btn--outline" onClick={() => setActiveTab('join')}>Join Room</button>
                </div>
              </div>
            ) : (
              <div className="rooms-grid">
                {myRooms.map(room => (
                  <div key={room.id} className="room-card" onClick={() => onEnterRoom(room.id, room.name)}>
                    <div className="room-card-header">
                      <div className="room-card-icon">📖</div>
                      <div className="room-card-name">{room.name}</div>
                    </div>
                    <div className="room-card-code">
                      <span className="text-xs text-muted uppercase tracking-widest">Code</span>
                      <span className="room-code-chip">{room.code}</span>
                    </div>
                    <div className="room-card-footer">
                      <button className="room-enter-btn">Enter →</button>
                      <button className="room-leave-btn" onClick={(e) => leaveRoom(room.id, e)}>Leave</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create Tab */}
        {activeTab === 'create' && (
          <div className="rooms-form-section">
            <h2 className="font-serif text-2xl text-primary mb-2">Create a Study Room</h2>
            <p className="text-muted text-sm mb-6">Give your room a name and share the code with classmates.</p>
            <div className="rooms-form">
              <input
                type="text"
                value={roomName}
                onChange={e => setRoomName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createRoom()}
                placeholder="e.g. Physics Finals 2026"
                className="rooms-input"
                autoFocus
                maxLength={50}
              />
              <button
                onClick={createRoom}
                disabled={creating || !roomName.trim()}
                className="rooms-submit-btn"
              >
                {creating ? 'Creating…' : 'Create Room'}
              </button>
            </div>
          </div>
        )}

        {/* Join Tab */}
        {activeTab === 'join' && (
          <div className="rooms-form-section">
            <h2 className="font-serif text-2xl text-primary mb-2">Join a Study Room</h2>
            <p className="text-muted text-sm mb-6">Enter the 6-character invite code from your classmate.</p>
            <div className="rooms-form">
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && joinRoom()}
                placeholder="e.g. NX72K1"
                className="rooms-input rooms-input--code"
                autoFocus
                maxLength={6}
              />
              <button
                onClick={joinRoom}
                disabled={joining || joinCode.length !== 6}
                className="rooms-submit-btn"
              >
                {joining ? 'Joining…' : 'Join Room'}
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  )
}

export default StudyRoomsListPage
