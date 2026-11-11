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

// THREE.JS SCENE SETUP
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfdf2f8);
scene.fog = new THREE.FogExp2(0xfdf2f8, 0.007);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 150);
camera.position.set(0, 15, 17);
camera.lookAt(0, 1.0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

// HỆ THỐNG CHIẾU SÁNG ẤM ÁP
const hemiLight = new THREE.HemisphereLight(0xfffbeb, 0xfce7f3, 1.35);
hemiLight.position.set(0, 30, 0);
scene.add(hemiLight);

const mainLight = new THREE.DirectionalLight(0xffedd5, 1.7);
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

// TẠO 2 ĐÔ VẬT RAGDOLL
const fighterP1 = new RagdollCharacter(scene, 0x0284c7, true);   // P1 Sky Blue
const fighterP2 = new RagdollCharacter(scene, 0xf43f5e, false);  // P2 Rose Red

fighterP1.root.position.set(-3.2, 0, 0);
fighterP1.root.rotation.y = Math.PI / 2;

fighterP2.root.position.set(3.2, 0, 0);
fighterP2.root.rotation.y = -Math.PI / 2;

// BÀN PHÍM & DI CHUYỂN
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

// CLICK CHUỘT / CHẠM ĐỂ ĐẤM
window.addEventListener('mousedown', (e) => {
  if (gameMode === 'MENU' || e.target.closest('#main-menu') || e.target.closest('.tboy-modal-overlay')) return;
  handlePunch();
});

document.getElementById('mobile-punch-btn').addEventListener('touchstart', (e) => {
  e.preventDefault();
  handlePunch();
});

function handlePunch() {
  if (isRoundEnding) return;
  const activeFighter = myRole === 'p1' ? fighterP1 : fighterP2;
  activeFighter.punch();
}

// BOT AI CHO CHẾ ĐỘ ĐẤU VỚI MÁY
function updateBotAI(dt) {
  if (gameMode !== 'AI' || isRoundEnding || fighterP2.isRagdoll) return;

  const p1Pos = fighterP1.root.position;
  const p2Pos = fighterP2.root.position;

  const dx = p1Pos.x - p2Pos.x;
  const dz = p1Pos.z - p2Pos.z;
  const dist = Math.hypot(dx, dz);

  const moveInput = { x: 0, z: 0 };
  const botSpeed = 4.2;

  if (dist > 1.6) {
    // Lao tới tiếp cận P1
    moveInput.x = (dx / dist) * botSpeed;
    moveInput.z = (dz / dist) * botSpeed;
  } else {
    // Khoảng cách gần: Tung cú đấm ngẫu nhiên
    if (Math.random() < 0.05) {
      fighterP2.punch();
    }
  }

  p2Pos.x += moveInput.x * dt;
  p2Pos.z += moveInput.z * dt;

  fighterP2.update(dt, moveInput);
}

// KIỂM TRA VA CHẠM CÚ ĐẤM & DÂY ĐÀI
function checkCombat(dt) {
  if (isRoundEnding) return;

  const p1 = fighterP1;
  const p2 = fighterP2;

  // 1. Kiểm tra P1 đấm trúng P2
  if (p1.isPunching && !p2.isRagdoll) {
    const punchPos = p1.getPunchHitbox();
    const p2BodyPos = p2.root.position.clone().setY(1.2);
    const hitDist = punchPos.distanceTo(p2BodyPos);

    if (hitDist < 1.3) {
      sounds.playPunch();
      particles.createPunchStars(p2BodyPos.x, p2BodyPos.y, p2BodyPos.z, 14);

      // Hướng văng ngược lại cú đấm
      const knockbackDir = new THREE.Vector3().subVectors(p2.root.position, p1.root.position).normalize();
      knockbackDir.y = 0.6; // Đấm bay bổng lên
      knockbackDir.multiplyScalar(14.0); // Lực đấm cực mạnh
      p2.takeHit(knockbackDir);
    }
  }

  // 2. Kiểm tra P2 đấm trúng P1
  if (p2.isPunching && !p1.isRagdoll) {
    const punchPos = p2.getPunchHitbox();
    const p1BodyPos = p1.root.position.clone().setY(1.2);
    const hitDist = punchPos.distanceTo(p1BodyPos);

    if (hitDist < 1.3) {
      sounds.playPunch();
      particles.createPunchStars(p1BodyPos.x, p1BodyPos.y, p1BodyPos.z, 14);

      const knockbackDir = new THREE.Vector3().subVectors(p1.root.position, p2.root.position).normalize();
      knockbackDir.y = 0.6;
      knockbackDir.multiplyScalar(14.0);
      p1.takeHit(knockbackDir);
    }
  }

  // 3. Kiểm tra Rớt Đài (Ring Out < -0.8 hoặc cách tâm quá 6.8m)
  const ringLimit = 6.6;
  if (!p1.isRagdoll && (Math.abs(p1.root.position.x) > ringLimit || Math.abs(p1.root.position.z) > ringLimit)) {
    handleRingOut('p2'); // P2 thắng hiệp này
  } else if (!p2.isRagdoll && (Math.abs(p2.root.position.x) > ringLimit || Math.abs(p2.root.position.z) > ringLimit)) {
    handleRingOut('p1'); // P1 thắng hiệp này
  }
}

// XỬ LÝ RỚT ĐÀI KNOCKOUT
const koBanner = document.getElementById('ko-banner');
const p1ScoreEl = document.getElementById('p1-score');
const p2ScoreEl = document.getElementById('p2-score');

function handleRingOut(winner) {
  isRoundEnding = true;
  sounds.playFallRing();

  if (winner === 'p1') {
    p1Score++;
    p1ScoreEl.innerText = p1Score;
    koBanner.innerHTML = '<span>💥</span> BẠN THẮNG HIỆP NÀY!';
  } else {
    p2Score++;
    p2ScoreEl.innerText = p2Score;
    koBanner.innerHTML = '<span>🤖</span> ĐỐI THỦ THẮNG HIỆP NÀY!';
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
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
      showToast(won ? '🏆 VÔ ĐỊCH VÕ ĐÀI RAGDOLL!' : 'THUA TRẬN NÀY RỒI! HÃY THỬ LẠI NHÉ!', won ? 'success' : 'warning', 4000);
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
  fighterP1.isRagdoll = false;

  fighterP2.root.position.set(3.2, 0, 0);
  fighterP2.root.rotation.y = -Math.PI / 2;
  fighterP2.velocity.set(0, 0, 0);
  fighterP2.isRagdoll = false;
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

// UI EVENTS
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
    document.getElementById('main-menu').classList.add('hidden');
  } catch (e) {
    showToast('Lỗi tạo phòng: ' + e.message, 'error');
  }
});

document.getElementById('btn-cancel-create').addEventListener('click', () => {
  sounds.playClick();
  document.getElementById('modal-create-room').classList.add('hidden');
  document.getElementById('main-menu').classList.remove('hidden');
  ragdollMP.leaveRoom();
});

document.getElementById('btn-open-join-room').addEventListener('click', () => {
  sounds.playClick();
  document.getElementById('modal-join-room').classList.remove('hidden');
  document.getElementById('main-menu').classList.add('hidden');
});

document.getElementById('btn-cancel-join').addEventListener('click', () => {
  sounds.playClick();
  document.getElementById('modal-join-room').classList.add('hidden');
  document.getElementById('main-menu').classList.remove('hidden');
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

// THU GỌN / MỞ RỘNG BẢNG MẸO
const tipsCard = document.getElementById('card-tips');
const btnToggleTips = document.getElementById('btn-toggle-tips');
const iconToggleTips = document.getElementById('btn-toggle-tips-icon');

btnToggleTips.addEventListener('click', () => {
  sounds.playClick();
  const isCollapsed = tipsCard.classList.toggle('collapsed');
  iconToggleTips.innerText = isCollapsed ? '▸' : '▾';
});

// SPLASH LOADING
window.addEventListener('load', () => {
  const fill = document.getElementById('loading-bar-inner');
  const splash = document.getElementById('loading-screen');
  let p = 0;
  const interval = setInterval(() => {
    p += 25;
    if (fill) fill.style.width = `${p}%`;
    if (p >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        if (splash) splash.classList.add('fade-out');
      }, 300);
    }
  }, 60);
});

// ANIMATION LOOP
let lastFrameTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastFrameTime) / 1000, 0.04);
  lastFrameTime = now;

  if (gameMode !== 'MENU') {
    // ĐIỀU KHIỂN NHÂN VẬT CỦA MÌNH
    const myFighter = myRole === 'p1' ? fighterP1 : fighterP2;
    const moveInput = { x: 0, z: 0 };
    const speed = 4.8;

    if (keys.w) moveInput.z -= speed;
    if (keys.s) moveInput.z += speed;
    if (keys.a) moveInput.x -= speed;
    if (keys.d) moveInput.x += speed;

    if (!myFighter.isRagdoll && !isRoundEnding) {
      myFighter.root.position.x += moveInput.x * dt;
      myFighter.root.position.z += moveInput.z * dt;
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

  particles.update(dt);
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
