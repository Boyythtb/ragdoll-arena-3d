import * as THREE from 'three';
import confetti from 'canvas-confetti';
import './style.css';
import { createArena } from './arena.js';
import { RagdollCharacter } from './character.js';
import { ParticleFX } from './particles.js';
import { sounds } from './sounds.js';
import { showToast } from './toast.js';
import { ragdollMP } from './firebase.js';

// TRẠNG THÁI GAME
let gameMode = 'MENU'; // 'MENU', 'AI', 'ONLINE'
let myRole = 'p1';     // 'p1' (Host), 'p2' (Guest)
let roomCode = null;

const randId = Math.floor(1000 + Math.random() * 9000);
let playerName = localStorage.getItem('tboy_ragdoll_name') || `Đô Vật #${randId}`;
document.getElementById('display-player-name').innerText = playerName;

let p1Score = 0;
let p2Score = 0;
const targetScore = 5;
let isRoundEnding = false;
let screenShake = 0;

// THREE.JS SCENE SETUP
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfdf2f8);
scene.fog = new THREE.FogExp2(0xfdf2f8, 0.007);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 150);
const baseCamPos = new THREE.Vector3(0, 14.5, 16.5);
camera.position.copy(baseCamPos);
camera.lookAt(0, 0.6, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

// HỆ THỐNG CHIẾU SÁNG ẤM ÁP
const hemiLight = new THREE.HemisphereLight(0xfffbeb, 0xfce7f3, 1.35);
hemiLight.position.set(0, 30, 0);
scene.add(hemiLight);

const mainLight = new THREE.DirectionalLight(0xffedd5, 1.75);
mainLight.position.set(12, 28, 10);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 2048;
mainLight.shadow.mapSize.height = 2048;
mainLight.shadow.camera.near = 1;
mainLight.shadow.camera.far = 60;
mainLight.shadow.camera.left = -16;
mainLight.shadow.camera.right = 16;
mainLight.shadow.camera.top = 16;
mainLight.shadow.camera.bottom = -16;
mainLight.shadow.bias = -0.0003;
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0xbae6fd, 0.7);
fillLight.position.set(-10, 20, -10);
scene.add(fillLight);

// TẠO VÕ ĐÀI & HIỆU ỨNG
const arena = createArena();
scene.add(arena);

const particles = new ParticleFX(scene);

// TẠO 2 ĐÔ VẬT RAGDOLL UỐN DẺO
const fighterP1 = new RagdollCharacter(scene, 0x0284c7, true);   // P1 Sky Blue
const fighterP2 = new RagdollCharacter(scene, 0xf43f5e, false);  // P2 Rose Red

resetFighterPositions();

// HỆ THỐNG ĐIỀU KHIỂN ĐA NĂNG (BÀN PHÍM + CHUỘT / CẢM ỨNG KÉO DRAG)
const keys = { w: false, a: false, s: false, d: false, space: false };
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') keys.w = true;
  if (k === 'a' || k === 'arrowleft') keys.a = true;
  if (k === 's' || k === 'arrowdown') keys.s = true;
  if (k === 'd' || k === 'arrowright') keys.d = true;
  if (k === ' ') {
    keys.space = true;
    handlePunch();
  }
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') keys.w = false;
  if (k === 'a' || k === 'arrowleft') keys.a = false;
  if (k === 's' || k === 'arrowdown') keys.s = false;
  if (k === 'd' || k === 'arrowright') keys.d = false;
  if (k === ' ') keys.space = false;
});

// VIRTUAL JOYSTICK & TOUCH/MOUSE DRAG
let isDraggingPointer = false;
let pointerStartX = 0;
let pointerStartY = 0;
let pointerMoveVec = { x: 0, z: 0 };
let pointerStartTime = 0;

window.addEventListener('pointerdown', (e) => {
  if (gameMode === 'MENU' || e.target.closest('#main-menu') || e.target.closest('.tboy-modal-overlay') || e.target.closest('#hud') || e.target.closest('#mobile-punch-btn')) return;
  isDraggingPointer = true;
  pointerStartX = e.clientX;
  pointerStartY = e.clientY;
  pointerStartTime = performance.now();
  pointerMoveVec.x = 0;
  pointerMoveVec.z = 0;
});

window.addEventListener('pointermove', (e) => {
  if (!isDraggingPointer) return;
  const dx = e.clientX - pointerStartX;
  const dy = e.clientY - pointerStartY;
  const dist = Math.hypot(dx, dy);
  if (dist > 12) {
    const factor = Math.min(dist / 65, 1.0);
    pointerMoveVec.x = (dx / dist) * factor;
    pointerMoveVec.z = (dy / dist) * factor;
  } else {
    pointerMoveVec.x = 0;
    pointerMoveVec.z = 0;
  }
});

window.addEventListener('pointerup', (e) => {
  if (isDraggingPointer) {
    const dx = e.clientX - pointerStartX;
    const dy = e.clientY - pointerStartY;
    const elapsed = performance.now() - pointerStartTime;
    // Chạm nhanh hoặc click nhẹ (< 250ms & < 14px) -> TUNG CÚ ĐẤM!
    if (elapsed < 250 && Math.hypot(dx, dy) < 14) {
      handlePunch();
    }
  }
  isDraggingPointer = false;
  pointerMoveVec.x = 0;
  pointerMoveVec.z = 0;
});

document.getElementById('mobile-punch-btn').addEventListener('touchstart', (e) => {
  e.preventDefault();
  handlePunch();
});

function handlePunch() {
  if (isRoundEnding) return;
  const activeFighter = myRole === 'p1' ? fighterP1 : fighterP2;
  const opponent = myRole === 'p1' ? fighterP2 : fighterP1;

  // Hỗ trợ tự động xoay mặt về đối thủ nếu ở cự ly gần (< 3.2m)
  if (!activeFighter.isRagdoll && !activeFighter.isFallingOff) {
    const dx = opponent.root.position.x - activeFighter.root.position.x;
    const dz = opponent.root.position.z - activeFighter.root.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 3.2) {
      activeFighter.root.rotation.y = Math.atan2(dx, dz);
    }
  }

  activeFighter.punch();
}

// BOT AI CHO CHẾ ĐỘ ĐẤU VỚI MÁY (THÔNG MINH, TẤN CÔNG & LÙI HỢP LÝ)
let botDecisionTimer = 0;
let botStrafe = 0;

function updateBotAI(dt) {
  if (gameMode !== 'AI' || isRoundEnding || fighterP2.isRagdoll || fighterP2.isFallingOff) return;

  const p1Pos = fighterP1.root.position;
  const p2Pos = fighterP2.root.position;

  const dx = p1Pos.x - p2Pos.x;
  const dz = p1Pos.z - p2Pos.z;
  const dist = Math.hypot(dx, dz);

  botDecisionTimer -= dt;
  if (botDecisionTimer <= 0) {
    botDecisionTimer = 0.35 + Math.random() * 0.35;
    botStrafe = (Math.random() - 0.5) * 2.0;
  }

  const moveInput = { x: 0, z: 0 };
  const botSpeed = 4.5;

  const distFromCenter = Math.hypot(p2Pos.x, p2Pos.z);

  // Nếu quá gần mép dây đài, Bot tự giác lùi vào trong
  if (distFromCenter > 5.1) {
    moveInput.x = -p2Pos.x * 0.9;
    moveInput.z = -p2Pos.z * 0.9;
  } else if (fighterP1.isRagdoll) {
    // Khi người chơi ngã, Bot húc đẩy người chơi ra mép đài
    moveInput.x = (dx / dist) * botSpeed * 1.25;
    moveInput.z = (dz / dist) * botSpeed * 1.25;
    if (dist < 1.6 && Math.random() < 0.15) {
      fighterP2.root.rotation.y = Math.atan2(dx, dz);
      fighterP2.punch();
    }
  } else if (dist > 1.6) {
    // Tiếp cận có lượn né
    const nx = dx / dist;
    const nz = dz / dist;
    moveInput.x = (nx + -nz * botStrafe * 0.5) * botSpeed;
    moveInput.z = (nz + nx * botStrafe * 0.5) * botSpeed;
  } else {
    // Áp sát -> Xoay mặt và đấm
    fighterP2.root.rotation.y = Math.atan2(dx, dz);
    if (Math.random() < 0.12) {
      fighterP2.punch();
    }
    moveInput.x = -dz * 0.8;
    moveInput.z = dx * 0.8;
  }

  p2Pos.x += moveInput.x * dt;
  p2Pos.z += moveInput.z * dt;

  fighterP2.update(dt, moveInput);
}

// 1. VA CHẠM THÂN THỂ GIỮA 2 VÕ SĨ (PUSHING & SHOVING)
function resolveBodyCollision(f1, f2) {
  if (f1.isFallingOff || f2.isFallingOff) return;

  const p1 = f1.root.position;
  const p2 = f2.root.position;
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const dist = Math.hypot(dx, dz);
  const minDist = 1.15; // Khoảng cách chạm người

  if (dist < minDist && dist > 0.001) {
    const overlap = minDist - dist;
    const nx = dx / dist;
    const nz = dz / dist;

    if (!f1.isRagdoll && !f2.isRagdoll) {
      p1.x -= nx * overlap * 0.5;
      p1.z -= nz * overlap * 0.5;
      p2.x += nx * overlap * 0.5;
      p2.z += nz * overlap * 0.5;
    } else if (f1.isRagdoll && !f2.isRagdoll) {
      p1.x -= nx * overlap * 0.85;
      p1.z -= nz * overlap * 0.85;
      f1.velocity.x -= nx * 4.5;
      f1.velocity.z -= nz * 4.5;
    } else if (!f1.isRagdoll && f2.isRagdoll) {
      p2.x += nx * overlap * 0.85;
      p2.z += nz * overlap * 0.85;
      f2.velocity.x += nx * 4.5;
      f2.velocity.z += nz * 4.5;
    }
  }
}

// 2. DÂY ĐÀI ĐÀN HỒI & CƠ CHẾ RỚT ĐÀI KHI BỊ ĐẤM VĂNG
function checkRopes(fighter) {
  if (fighter.isFallingOff) return;

  const pos = fighter.root.position;
  const bound = 5.80; // Mép dây đài

  // A. KHI ĐANG ĐI BÌNH THƯỜNG (!isRagdoll): Dây đài cản lại không cho đi lố
  if (!fighter.isRagdoll) {
    let touched = false;
    if (pos.x > bound) { pos.x = bound; touched = true; }
    if (pos.x < -bound) { pos.x = -bound; touched = true; }
    if (pos.z > bound) { pos.z = bound; touched = true; }
    if (pos.z < -bound) { pos.z = -bound; touched = true; }

    if (touched) {
      fighter.velocity.x *= -0.5;
      fighter.velocity.z *= -0.5;
    }
    return;
  }

  // B. KHI ĐANG BỊ ĐẤM UỐN DẺO (isRagdoll):
  // Nếu bị đấm văng ra ngoài mép dây
  const isOutside = Math.abs(pos.x) > bound || Math.abs(pos.z) > bound;
  if (isOutside) {
    const horizSpeed = Math.hypot(fighter.velocity.x, fighter.velocity.z);
    // Nếu cú đấm mạnh (> 4.0 m/s) hoặc đang bay bổng: HẤT VĂNG QUA DÂY RỚT ĐÀI!
    if (horizSpeed > 4.0 || pos.y > 0.35) {
      fighter.isFallingOff = true;
      sounds.playBoing();
      particles.createPunchStars(pos.x, 1.2, pos.z, 14);
      screenShake = 0.22;
      return;
    } else {
      // Nếu va chạm chậm thì nảy vào trong
      if (pos.x > bound) { pos.x = bound; fighter.velocity.x = -Math.abs(fighter.velocity.x) * 1.2 - 2; }
      if (pos.x < -bound) { pos.x = -bound; fighter.velocity.x = Math.abs(fighter.velocity.x) * 1.2 + 2; }
      if (pos.z > bound) { pos.z = bound; fighter.velocity.z = -Math.abs(fighter.velocity.z) * 1.2 - 2; }
      if (pos.z < -bound) { pos.z = -bound; fighter.velocity.z = Math.abs(fighter.velocity.z) * 1.2 + 2; }
      sounds.playBoing();
    }
  }
}

// 3. KIỂM TRA ĐÒN ĐẤM & RỚT ĐÀI (RING OUT)
function checkCombat(dt) {
  if (isRoundEnding) return;

  const p1 = fighterP1;
  const p2 = fighterP2;

  // Va chạm thân thể & dây đài
  resolveBodyCollision(p1, p2);
  checkRopes(p1);
  checkRopes(p2);

  const p1Pos = p1.root.position;
  const p2Pos = p2.root.position;
  const dist = Math.hypot(p2Pos.x - p1Pos.x, p2Pos.z - p1Pos.z);

  // 1. Kiểm tra P1 đấm trúng P2
  if (p1.isPunching && !p2.isRagdoll && !p2.isFallingOff) {
    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), p1.root.rotation.y);
    const toVictim = new THREE.Vector3(p2Pos.x - p1Pos.x, 0, p2Pos.z - p1Pos.z).normalize();
    const dot = forward.dot(toVictim);

    // Cự ly đấm trúng trong tầm 1.9m và quay mặt về đối thủ
    if (dist < 1.9 && dot > 0.1) {
      sounds.playPunch();
      particles.createPunchStars(p2Pos.x, 1.25, p2Pos.z, 18);
      screenShake = 0.28;

      const knockback = toVictim.clone();
      knockback.y = 0.45;
      knockback.multiplyScalar(14.0); // Lực đấm cực mạnh để hất văng qua dây đài
      p2.takeHit(knockback);
    }
  }

  // 2. Kiểm tra P2 đấm trúng P1
  if (p2.isPunching && !p1.isRagdoll && !p1.isFallingOff) {
    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), p2.root.rotation.y);
    const toVictim = new THREE.Vector3(p1Pos.x - p2Pos.x, 0, p1Pos.z - p2Pos.z).normalize();
    const dot = forward.dot(toVictim);

    if (dist < 1.9 && dot > 0.1) {
      sounds.playPunch();
      particles.createPunchStars(p1Pos.x, 1.25, p1Pos.z, 18);
      screenShake = 0.28;

      const knockback = toVictim.clone();
      knockback.y = 0.45;
      knockback.multiplyScalar(14.0);
      p1.takeHit(knockback);
    }
  }

  // 3. Kiểm tra Rớt Đài (Ring Out khi rơi xuống vực)
  if (p1.isFallingOff && p1.root.position.y <= -0.9) {
    handleRingOut('p2');
  } else if (p2.isFallingOff && p2.root.position.y <= -0.9) {
    handleRingOut('p1');
  }
}

// XỬ LÝ RỚT ĐÀI KNOCKOUT & CỘNG ĐIỂM
const koBanner = document.getElementById('ko-banner');
const p1ScoreEl = document.getElementById('p1-score');
const p2ScoreEl = document.getElementById('p2-score');

function handleRingOut(winner) {
  isRoundEnding = true;
  sounds.playFallRing();

  if (winner === 'p1') {
    p1Score++;
    p1ScoreEl.innerText = p1Score;
    koBanner.innerHTML = '<span>💥</span> RING OUT! BẠN ĐÃ THẮNG HIỆP NÀY!';
  } else {
    p2Score++;
    p2ScoreEl.innerText = p2Score;
    koBanner.innerHTML = '<span>🤖</span> RING OUT! ĐỐI THỦ THẮNG HIỆP NÀY!';
  }

  if (gameMode === 'ONLINE' && myRole === 'p1') {
    ragdollMP.updateScores({ p1: p1Score, p2: p2Score }, winner);
  }

  koBanner.classList.add('show');

  setTimeout(() => {
    koBanner.classList.remove('show');
    if (p1Score >= targetScore || p2Score >= targetScore) {
      const won = (winner === 'p1' && myRole === 'p1') || (winner === 'p2' && myRole === 'p2');
      sounds.playVictory();
      confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 } });
      showToast(won ? '🏆 VÔ ĐỊCH VÕ ĐÀI RAGDOLL ARENA!' : 'THUA TRẬN NÀY RỒI! HÃY THỬ LẠI NHÉ!', won ? 'success' : 'warning', 4500);
      resetMatch();
      backToMenu();
    } else {
      resetFighterPositions();
      isRoundEnding = false;
    }
  }, 2200);
}

function resetFighterPositions() {
  fighterP1.root.position.set(-3.2, 0, 0);
  fighterP1.root.rotation.y = Math.PI / 2;
  fighterP1.velocity.set(0, 0, 0);
  fighterP1.angularVelocity.set(0, 0, 0);
  fighterP1.torsoGroup.rotation.set(0, 0, 0);
  fighterP1.headPivot.rotation.set(0, 0, 0);
  fighterP1.isRagdoll = false;
  fighterP1.isFallingOff = false;

  fighterP2.root.position.set(3.2, 0, 0);
  fighterP2.root.rotation.y = -Math.PI / 2;
  fighterP2.velocity.set(0, 0, 0);
  fighterP2.angularVelocity.set(0, 0, 0);
  fighterP2.torsoGroup.rotation.set(0, 0, 0);
  fighterP2.headPivot.rotation.set(0, 0, 0);
  fighterP2.isRagdoll = false;
  fighterP2.isFallingOff = false;
}

function resetMatch() {
  p1Score = 0;
  p2Score = 0;
  p1ScoreEl.innerText = '0';
  p2ScoreEl.innerText = '0';
  resetFighterPositions();
  isRoundEnding = false;
}

function backToMenu() {
  gameMode = 'MENU';
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('mobile-punch-btn').classList.add('hidden');
  document.getElementById('main-menu').classList.remove('hidden');
  ragdollMP.leaveRoom();
}

// REALTIME FIREBASE MULTIPLAYER LISTENERS
ragdollMP.on('game_start', (data) => {
  document.getElementById('modal-create-room').classList.add('hidden');
  document.getElementById('modal-join-room').classList.add('hidden');
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('mobile-punch-btn').classList.remove('hidden');
  gameMode = 'ONLINE';

  if (data.players) {
    document.getElementById('hud-p1-name').innerText = data.players[0].name.toUpperCase();
    document.getElementById('hud-p2-name').innerText = data.players[1].name.toUpperCase();
  }
  showToast('Đối thủ đã lên đài! Bắt đầu đấu!', 'success');
});

ragdollMP.on('opponent_state', (data) => {
  const opp = myRole === 'p1' ? fighterP2 : fighterP1;
  opp.root.position.set(data.x, data.y, data.z);
  opp.root.rotation.y = data.rotY;
  if (data.isPunching && !opp.isPunching) {
    opp.punch();
  }
  opp.isRagdoll = data.isRagdoll;
});

ragdollMP.on('sync_scores', (scores) => {
  if (myRole === 'p2') {
    p1Score = scores.p1;
    p2Score = scores.p2;
    p1ScoreEl.innerText = p1Score;
    p2ScoreEl.innerText = p2Score;
  }
});

ragdollMP.on('player_disconnected', () => {
  showToast('Đối thủ đã rời võ đài!', 'warning');
  backToMenu();
});

// UI EVENT LISTENERS
document.getElementById('btn-play-ai').addEventListener('click', () => {
  sounds.playClick();
  gameMode = 'AI';
  myRole = 'p1';
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('mobile-punch-btn').classList.remove('hidden');
  document.getElementById('hud-p1-name').innerText = playerName.toUpperCase();
  document.getElementById('hud-p2-name').innerText = 'BOT';
  resetMatch();
  showToast('Bắt đầu đấu với Bot!', 'info');
});

document.getElementById('btn-open-create-room').addEventListener('click', async () => {
  sounds.playClick();
  try {
    const res = await ragdollMP.createRoom(playerName);
    roomCode = res.roomCode;
    myRole = 'p1';
    document.getElementById('label-room-code').innerText = roomCode;
    document.getElementById('modal-create-room').classList.remove('hidden');
  } catch (e) {
    showToast('Lỗi tạo phòng: ' + e.message, 'error');
  }
});

document.getElementById('btn-cancel-create').addEventListener('click', () => {
  sounds.playClick();
  document.getElementById('modal-create-room').classList.add('hidden');
  ragdollMP.leaveRoom();
});

document.getElementById('btn-open-join-room').addEventListener('click', () => {
  sounds.playClick();
  document.getElementById('modal-join-room').classList.remove('hidden');
});

document.getElementById('btn-cancel-join').addEventListener('click', () => {
  sounds.playClick();
  document.getElementById('modal-join-room').classList.add('hidden');
});

document.getElementById('btn-confirm-join').addEventListener('click', async () => {
  sounds.playClick();
  const code = document.getElementById('input-join-code').value.trim();
  if (!code) {
    showToast('Vui lòng nhập mã phòng!', 'warning');
    return;
  }
  try {
    const res = await ragdollMP.joinRoom(code, playerName);
    roomCode = res.roomCode;
    myRole = 'p2';
    document.getElementById('modal-join-room').classList.add('hidden');
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('mobile-punch-btn').classList.remove('hidden');
    gameMode = 'ONLINE';
    showToast('Đã tham gia phòng thi đấu thành công!', 'success');
  } catch (e) {
    showToast(e.message || 'Lỗi tham gia phòng!', 'error');
  }
});

document.getElementById('btn-exit-match').addEventListener('click', () => {
  sounds.playClick();
  backToMenu();
});

document.getElementById('btn-change-name').addEventListener('click', () => {
  sounds.playClick();
  const newName = prompt('Nhập tên đô vật của bạn:', playerName);
  if (newName && newName.trim()) {
    playerName = newName.trim().substring(0, 15);
    localStorage.setItem('tboy_ragdoll_name', playerName);
    document.getElementById('display-player-name').innerText = playerName;
    showToast(`Đã đổi tên thành: ${playerName}`, 'success');
  }
});

// DIALOG MẸO THI ĐẤU
const modalTips = document.getElementById('modal-tips');
const btnToggleTips = document.getElementById('btn-toggle-tips');
const btnCloseTips = document.getElementById('btn-close-tips');
const btnAckTips = document.getElementById('btn-ack-tips');

btnToggleTips.addEventListener('click', () => {
  sounds.playClick();
  modalTips.classList.remove('hidden');
});

[btnCloseTips, btnAckTips].forEach((el) => {
  if (el) {
    el.addEventListener('click', () => {
      sounds.playClick();
      modalTips.classList.add('hidden');
    });
  }
});

modalTips.addEventListener('click', (e) => {
  if (e.target === modalTips) {
    sounds.playClick();
    modalTips.classList.add('hidden');
  }
});

// SPLASH LOADING CHẠY TỰ ĐỘNG
function dismissSplash() {
  const fill = document.getElementById('loading-bar-inner');
  const splash = document.getElementById('loading-screen');
  let p = 0;
  const interval = setInterval(() => {
    p += 25;
    if (fill) fill.style.width = `${p}%`;
    if (p >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        if (splash) {
          splash.classList.add('fade-out');
          setTimeout(() => {
            splash.style.display = 'none';
          }, 350);
        }
      }, 200);
    }
  }, 80);
}
if (document.readyState === 'complete') {
  dismissSplash();
} else {
  window.addEventListener('load', dismissSplash);
  setTimeout(dismissSplash, 800);
}

// EXPOSE DEBUG FOR TESTING
window.gameDebug = {
  fighterP1,
  fighterP2,
  getScores: () => ({ p1: p1Score, p2: p2Score }),
  getGameMode: () => gameMode,
  isRoundEnding: () => isRoundEnding
};

// ANIMATION LOOP VỚI CAMERA SHAKE
let lastFrameTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastFrameTime) / 1000, 0.04);
  lastFrameTime = now;

  if (gameMode !== 'MENU') {
    const myFighter = myRole === 'p1' ? fighterP1 : fighterP2;
    const opponent = myRole === 'p1' ? fighterP2 : fighterP1;
    const speed = 4.8;

    // Tổng hợp điều khiển từ bàn phím & touch drag
    let mx = 0, mz = 0;
    if (keys.w) mz -= 1;
    if (keys.s) mz += 1;
    if (keys.a) mx -= 1;
    if (keys.d) mx += 1;

    if (isDraggingPointer && (Math.abs(pointerMoveVec.x) > 0 || Math.abs(pointerMoveVec.z) > 0)) {
      mx = pointerMoveVec.x;
      mz = pointerMoveVec.z;
    }

    const moveInput = { x: 0, z: 0 };
    const len = Math.hypot(mx, mz);
    if (len > 0.05) {
      const norm = Math.min(len, 1.0);
      moveInput.x = (mx / len) * norm * speed;
      moveInput.z = (mz / len) * norm * speed;
    }

    if (!myFighter.isRagdoll && !myFighter.isFallingOff && !isRoundEnding) {
      myFighter.root.position.x += moveInput.x * dt;
      myFighter.root.position.z += moveInput.z * dt;

      // Khi đứng yên ở gần đối thủ, tự động xoay mặt đối diện nhau (Squaring up)
      if (len <= 0.05 && !myFighter.isPunching) {
        const dx = opponent.root.position.x - myFighter.root.position.x;
        const dz = opponent.root.position.z - myFighter.root.position.z;
        if (Math.hypot(dx, dz) < 3.8) {
          const targetRot = Math.atan2(dx, dz);
          let diff = targetRot - myFighter.root.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          myFighter.root.rotation.y += diff * Math.min(dt * 8, 1.0);
        }
      }
    }

    myFighter.update(dt, moveInput);

    if (gameMode === 'AI') {
      updateBotAI(dt);
    }

    checkCombat(dt);

    if (gameMode === 'ONLINE') {
      ragdollMP.sendState({
        x: myFighter.root.position.x,
        y: myFighter.root.position.y,
        z: myFighter.root.position.z,
        rotY: myFighter.root.rotation.y,
        isPunching: myFighter.isPunching,
        isRagdoll: myFighter.isRagdoll
      });
    }
  }

  // Camera Shake Decay
  if (screenShake > 0) {
    camera.position.x = baseCamPos.x + (Math.random() - 0.5) * screenShake;
    camera.position.y = baseCamPos.y + (Math.random() - 0.5) * screenShake;
    screenShake = Math.max(0, screenShake - dt * 1.5);
  } else {
    camera.position.x = baseCamPos.x;
    camera.position.y = baseCamPos.y;
  }

  particles.update(dt);
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
