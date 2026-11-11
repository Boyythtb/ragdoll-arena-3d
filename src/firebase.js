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
    this.unsubscribers = [];
    this.lastSent = 0;
    this.gameStartedEmitted = false;
    this.lastHitTs = 0;
    this.lastRoundId = 0;
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

  clearListeners() {
    this.unsubscribers.forEach(unsub => {
      try { unsub(); } catch (e) {}
    });
    this.unsubscribers = [];
  }

  // TẠO PHÒNG MỚI (P1 - Host)
  async createRoom(playerName, colorHex = 0x0284c7) {
    this.clearListeners();
    this.gameStartedEmitted = false;
    this.lastHitTs = 0;
    this.lastRoundId = 0;

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
      meta: {
        code: roomCode,
        state: 'WAITING',
        targetScore: 5,
        createdAt: Date.now()
      },
      players: {
        p1: { id: myClientId, name: playerName || 'Đô Vật 1', color: colorHex, role: 'p1' }
      },
      roundState: {
        scores: { p1: 0, p2: 0 },
        winner: null,
        roundId: 0
      },
      positions: {
        p1: { x: -3.2, y: 0, z: 0, rotY: Math.PI / 2, isPunching: false, isRagdoll: false, isSprinting: false, isFallingOff: false },
        p2: { x: 3.2, y: 0, z: 0, rotY: -Math.PI / 2, isPunching: false, isRagdoll: false, isSprinting: false, isFallingOff: false }
      }
    };

    await set(this.roomRef, initialData);
    onDisconnect(this.roomRef).remove();
    this.listenToRoom();
    return { roomCode, role: 'p1' };
  }

  // VÀO PHÒNG ĐÃ CÓ (P2 - Guest)
  async joinRoom(roomCode, playerName, colorHex = 0xf43f5e) {
    this.clearListeners();
    this.gameStartedEmitted = false;
    this.lastHitTs = 0;
    this.lastRoundId = 0;

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
      'players/p2': { id: myClientId, name: playerName || 'Đô Vật 2', color: colorHex, role: 'p2' },
      'meta/state': 'PLAYING'
    });

    onDisconnect(ref(db, `ragdoll_rooms/${code}/players/p2`)).remove();
    this.listenToRoom();
    return { roomCode: code, role: 'p2' };
  }

  listenToRoom() {
    if (!this.currentRoomCode) return;
    const code = this.currentRoomCode;

    // 1. Chỉ lắng nghe meta (WAITING -> PLAYING -> Xóa phòng) - KHÔNG bị kích hoạt khi di chuyển
    const metaRef = ref(db, `ragdoll_rooms/${code}/meta`);
    const unsubMeta = onValue(metaRef, async (snap) => {
      if (!snap.exists()) {
        if (this.currentRoomCode) {
          this.emit('player_disconnected', {});
        }
        return;
      }
      const meta = snap.val();
      if (meta.state === 'PLAYING' && !this.gameStartedEmitted) {
        this.gameStartedEmitted = true;
        const playersSnap = await get(ref(db, `ragdoll_rooms/${code}/players`));
        const playersData = playersSnap.val() || {};
        this.emit('game_start', {
          players: playersData
        });
      }
    });
    this.unsubscribers.push(unsubMeta);

    // 2. Lắng nghe thay đổi người chơi (VD: P2 rời phòng)
    const playersRef = ref(db, `ragdoll_rooms/${code}/players`);
    const unsubPlayers = onValue(playersRef, (snap) => {
      if (!snap.exists()) {
        if (this.currentRoomCode && this.gameStartedEmitted) {
          this.emit('player_disconnected', {});
        }
        return;
      }
      const players = snap.val();
      if (this.gameStartedEmitted && (!players.p1 || !players.p2)) {
        this.emit('player_disconnected', {});
      }
    });
    this.unsubscribers.push(unsubPlayers);

    // 3. Lắng nghe vị trí riêng của đối thủ (Băng thông siêu nhẹ, không spam toàn phòng)
    const oppKey = this.myRole === 'p1' ? 'p2' : 'p1';
    const oppPosRef = ref(db, `ragdoll_rooms/${code}/positions/${oppKey}`);
    const unsubOpp = onValue(oppPosRef, (snap) => {
      if (snap.exists()) {
        this.emit('opponent_state', snap.val());
      }
    });
    this.unsubscribers.push(unsubOpp);

    // 4. Lắng nghe ĐÒN ĐÁNH trúng mình từ đối thủ (Hit Authority Transfer)
    const myHitRef = ref(db, `ragdoll_rooms/${code}/hits/${this.myRole}`);
    const unsubHit = onValue(myHitRef, (snap) => {
      if (snap.exists()) {
        const hitData = snap.val();
        if (hitData.ts && hitData.ts > this.lastHitTs) {
          this.lastHitTs = hitData.ts;
          this.emit('received_hit', hitData);
        }
      }
    });
    this.unsubscribers.push(unsubHit);

    // 5. Lắng nghe kết quả hiệp & đồng bộ tỷ số
    const roundRef = ref(db, `ragdoll_rooms/${code}/roundState`);
    const unsubRound = onValue(roundRef, (snap) => {
      if (snap.exists()) {
        const rData = snap.val();
        if (rData.roundId > this.lastRoundId) {
          this.lastRoundId = rData.roundId;
          this.emit('round_result', rData);
        }
      }
    });
    this.unsubscribers.push(unsubRound);
  }

  // Gửi trạng thái nhân vật (~30Hz, có đủ isSprinting, isFallingOff)
  sendState(stateData) {
    if (!this.currentRoomCode || !this.gameStartedEmitted) return;
    const now = performance.now();
    if (now - this.lastSent < 33) return;
    this.lastSent = now;

    set(ref(db, `ragdoll_rooms/${this.currentRoomCode}/positions/${this.myRole}`), {
      x: Number(stateData.x.toFixed(2)),
      y: Number(stateData.y.toFixed(2)),
      z: Number(stateData.z.toFixed(2)),
      rotY: Number(stateData.rotY.toFixed(2)),
      isPunching: !!stateData.isPunching,
      isRagdoll: !!stateData.isRagdoll,
      isSprinting: !!stateData.isSprinting,
      isFallingOff: !!stateData.isFallingOff
    });
  }

  // Gửi lực đánh/húc sang đối thủ khi đấm trúng
  sendHit(targetRole, vec) {
    if (!this.currentRoomCode) return;
    set(ref(db, `ragdoll_rooms/${this.currentRoomCode}/hits/${targetRole}`), {
      vx: Number(vec.x.toFixed(2)),
      vy: Number(vec.y.toFixed(2)),
      vz: Number(vec.z.toFixed(2)),
      ts: Date.now()
    });
  }

  // Host (P1) đồng bộ kết quả hiệp đấu
  async updateRoundState(scores, winner, roundId) {
    if (!this.currentRoomCode) return;
    await set(ref(db, `ragdoll_rooms/${this.currentRoomCode}/roundState`), {
      scores,
      winner,
      roundId,
      ts: Date.now()
    });
  }

  leaveRoom() {
    this.clearListeners();
    const code = this.currentRoomCode;
    const role = this.myRole;
    this.currentRoomCode = null;
    this.roomRef = null;
    this.gameStartedEmitted = false;

    if (code) {
      if (role === 'p1') {
        remove(ref(db, `ragdoll_rooms/${code}`));
      } else {
        remove(ref(db, `ragdoll_rooms/${code}/players/p2`));
      }
    }
  }
}

export const ragdollMP = new RagdollMultiplayer();
