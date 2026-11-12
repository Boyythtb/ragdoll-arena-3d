import { initializeApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  onDisconnect
} from 'firebase/database';

const firebaseConfig = {
  databaseURL: "https://birdie-bash-3d-2026-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const myClientId = 'ragdoll_' + Math.random().toString(36).substring(2, 9);

export class RagdollMultiplayer {
  constructor() {
    this.currentRoomCode = null;
    this.myRole = null; // 'p1' (Host) hoặc 'p2' (Guest)
    this.roomRef = null;
    this.callbacks = {};
    this.unsubscribers = [];
    this.lastSent = 0;
    this.lastHitTs = 0;
    this.lastRoundId = 0;
    this.gameStartedEmitted = false;
  }

  on(event, cb) {
    if (!this.callbacks[event]) this.callbacks[event] = [];
    this.callbacks[event].push(cb);
  }

  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => {
        try { cb(data); } catch (e) { console.error(e); }
      });
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
        state: 'WAITING', // WAITING -> PLAYING
        targetScore: 5,
        createdAt: Date.now()
      },
      players: {
        p1: { id: myClientId, name: playerName || 'Đô Vật 1', color: colorHex, role: 'p1', ready: false }
      },
      roundState: {
        scores: { p1: 0, p2: 0 },
        winner: null,
        roundId: 0
      },
      positions: {
        p1: { x: -3.2, y: 0, z: 0, rotY: 1.57, isPunching: false, isRagdoll: false, isSprinting: false, isFallingOff: false },
        p2: { x: 3.2, y: 0, z: 0, rotY: -1.57, isPunching: false, isRagdoll: false, isSprinting: false, isFallingOff: false }
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

    // Giữ state là WAITING để cả 2 cùng bấm SẴN SÀNG
    await update(ref(db, `ragdoll_rooms/${code}`), {
      'players/p2': { id: myClientId, name: playerName || 'Đô Vật 2', color: colorHex, role: 'p2', ready: false }
    });

    onDisconnect(ref(db, `ragdoll_rooms/${code}/players/p2`)).remove();
    this.listenToRoom();
    return { roomCode: code, role: 'p2' };
  }

  // BẬT / TẮT TRẠNG THÁI SẴN SÀNG (READY)
  async toggleReady(isReady) {
    if (!this.currentRoomCode || !this.myRole) return;
    await set(ref(db, `ragdoll_rooms/${this.currentRoomCode}/players/${this.myRole}/ready`), isReady);
  }

  // CHỦ PHÒNG (P1) BẮT ĐẦU TRẬN ĐẤU KHI CẢ 2 ĐÃ SẴN SÀNG
  async startMatch() {
    if (!this.currentRoomCode || this.myRole !== 'p1') return;
    await update(ref(db, `ragdoll_rooms/${this.currentRoomCode}/meta`), {
      state: 'PLAYING'
    });
  }

  listenToRoom() {
    if (!this.currentRoomCode) return;
    const code = this.currentRoomCode;

    // 1. Lắng nghe meta (WAITING -> PLAYING)
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

    // 2. Lắng nghe thay đổi người chơi (Slot, Ready status, Disconnect)
    const playersRef = ref(db, `ragdoll_rooms/${code}/players`);
    const unsubPlayers = onValue(playersRef, (snap) => {
      if (!snap.exists()) {
        if (this.currentRoomCode && this.gameStartedEmitted) {
          this.emit('player_disconnected', {});
        }
        return;
      }
      const players = snap.val();
      this.emit('room_updated', { players });

      if (this.gameStartedEmitted && (!players.p1 || !players.p2)) {
        this.emit('player_disconnected', {});
      }
    });
    this.unsubscribers.push(unsubPlayers);

    // 3. Lắng nghe vị trí riêng của đối thủ (20Hz lerp)
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

  // Gửi trạng thái nhân vật (~20Hz = 50ms, cực kỳ mượt mà, không nghẽn mạng)
  sendState(stateData) {
    if (!this.currentRoomCode || !this.gameStartedEmitted) return;
    const now = performance.now();
    if (now - this.lastSent < 50) return;
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
