import { initializeApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  onValue,
  off,
  remove,
  onDisconnect
} from 'firebase/database';

export const firebaseConfig = {
  projectId: "birdie-bash-3d-2026",
  appId: "1:962511515177:web:54bba507b47807d7b8f638",
  databaseURL: "https://birdie-bash-3d-2026-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "birdie-bash-3d-2026.firebasestorage.app",
  apiKey: "AIzaSyBjRj4Z9vGA_phvyqfnGRB3_P5RNMx8EfQ",
  authDomain: "birdie-bash-3d-2026.firebaseapp.com",
  messagingSenderId: "962511515177"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

export const myClientId = 'user_' + Math.random().toString(36).substring(2, 9);

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export class RagdollMultiplayer {
  constructor() {
    this.currentRoomCode = null;
    this.myRole = 'p1'; // 'p1' (Host) hoặc 'p2' (Guest)
    this.roomRef = null;
    this.callbacks = {};
    this.roomListener = null;
    this.opponentListener = null;
    this.scoreListener = null;
    this.lastSent = 0;
  }

  on(event, cb) {
    if (!this.callbacks[event]) this.callbacks[event] = [];
    this.callbacks[event].push(cb);
  }

  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data));
    }
  }

  // TẠO PHÒNG MỚI (P1 - Host)
  async createRoom(playerName) {
    let roomCode = generateRoomCode();
    let rRef = ref(db, `ragdoll_rooms/${roomCode}`);
    let snapshot = await get(rRef);
    let attempts = 0;
    while (snapshot.exists() && attempts < 5) {
      roomCode = generateRoomCode();
      rRef = ref(db, `ragdoll_rooms/${roomCode}`);
      snapshot = await get(rRef);
      attempts++;
    }

    this.currentRoomCode = roomCode;
    this.myRole = 'p1';
    this.roomRef = rRef;

    const initialData = {
      code: roomCode,
      state: 'WAITING',
      targetScore: 5,
      createdAt: Date.now(),
      players: {
        p1: { id: myClientId, name: playerName || 'Đô Vật 1', role: 'p1' }
      },
      scores: { p1: 0, p2: 0 },
      positions: {
        p1: { x: -3.5, y: 1.5, z: 0, rotY: 0, isPunching: false, isRagdoll: false },
        p2: { x: 3.5, y: 1.5, z: 0, rotY: Math.PI, isPunching: false, isRagdoll: false }
      }
    };

    await set(this.roomRef, initialData);
    onDisconnect(this.roomRef).remove();
    this.listenToRoom();
    return { roomCode, role: 'p1' };
  }

  // VÀO PHÒNG ĐÃ CÓ (P2 - Guest)
  async joinRoom(roomCode, playerName) {
    const code = roomCode.toUpperCase().trim();
    const rRef = ref(db, `ragdoll_rooms/${code}`);
    const snap = await get(rRef);

    if (!snap.exists()) {
      throw new Error('Mã phòng không tồn tại!');
    }

    const data = snap.val();
    if (data.players && data.players.p2) {
      throw new Error('Phòng thi đấu đã đủ 2 người!');
    }

    this.currentRoomCode = code;
    this.myRole = 'p2';
    this.roomRef = rRef;

    await update(ref(db, `ragdoll_rooms/${code}`), {
      'players/p2': { id: myClientId, name: playerName || 'Đô Vật 2', role: 'p2' },
      state: 'PLAYING'
    });

    onDisconnect(ref(db, `ragdoll_rooms/${code}/players/p2`)).remove();
    this.listenToRoom();
    return { roomCode: code, role: 'p2' };
  }

  listenToRoom() {
    if (!this.roomRef) return;

    this.roomListener = onValue(this.roomRef, (snap) => {
      if (!snap.exists()) {
        this.emit('player_disconnected', {});
        return;
      }
      const data = snap.val();

      if (data.state === 'PLAYING' && data.players && data.players.p1 && data.players.p2) {
        this.emit('game_start', {
          players: [data.players.p1, data.players.p2],
          scores: data.scores
        });
      }

      if (this.myRole === 'p1' && data.state === 'PLAYING' && !data.players.p2) {
        this.emit('player_disconnected', {});
      }
    });

    // Lắng nghe vị trí đối thủ
    const oppKey = this.myRole === 'p1' ? 'p2' : 'p1';
    this.opponentListener = onValue(ref(db, `ragdoll_rooms/${this.currentRoomCode}/positions/${oppKey}`), (snap) => {
      if (snap.exists()) {
        this.emit('opponent_state', snap.val());
      }
    });

    // Lắng nghe điểm số
    this.scoreListener = onValue(ref(db, `ragdoll_rooms/${this.currentRoomCode}/scores`), (snap) => {
      if (snap.exists()) {
        this.emit('sync_scores', snap.val());
      }
    });
  }

  // Gửi trạng thái nhân vật (Tọa độ, góc xoay, đấm, té ngã)
  sendState(stateData) {
    if (!this.roomRef || !this.currentRoomCode) return;
    const now = performance.now();
    if (now - this.lastSent < 25) return; // 40Hz
    this.lastSent = now;

    set(ref(db, `ragdoll_rooms/${this.currentRoomCode}/positions/${this.myRole}`), {
      x: Number(stateData.x.toFixed(2)),
      y: Number(stateData.y.toFixed(2)),
      z: Number(stateData.z.toFixed(2)),
      rotY: Number(stateData.rotY.toFixed(2)),
      isPunching: !!stateData.isPunching,
      isRagdoll: !!stateData.isRagdoll
    });
  }

  async updateScores(scores, winner) {
    if (!this.currentRoomCode) return;
    await update(ref(db, `ragdoll_rooms/${this.currentRoomCode}`), {
      scores,
      lastWinner: winner,
      roundTimestamp: Date.now()
    });
  }

  leaveRoom() {
    if (this.roomRef) {
      if (this.roomListener) off(this.roomRef, 'value', this.roomListener);
      if (this.myRole === 'p1') {
        remove(this.roomRef);
      } else {
        remove(ref(db, `ragdoll_rooms/${this.currentRoomCode}/players/p2`));
      }
    }
    this.currentRoomCode = null;
    this.roomRef = null;
  }
}

export const ragdollMP = new RagdollMultiplayer();
