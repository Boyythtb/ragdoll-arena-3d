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

// HỆ THỐNG CHIẾU SÁNG ẤM ÁP BIRDIE BASH STYLE
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
  if (gameMode === 'MENU' || e.target.closest('#main-menu') || e.target.closest('.tboy-modal-overlay') || e.target.closest('#hud')) return;
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

// BOT AI CHO CHẾ ĐỘ ĐẤU VỚI MÁY (THÔNG MINH, LINH HOẠT & HÀI HƯỚC)
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
    botDecisionTimer = 0.4 + Math.random() * 0.4;
    // Đổi hướng lượn vòng né đòn
    botStrafe = (Math.random() - 0.5) * 2.2;
  }

  const moveInput = { x: 0, z: 0 };
  const botSpeed = 4.4;

  // Nếu quá gần mép dây đài, Bot tự động lui về giữa sân
  const distFromCenter = Math.hypot(p2Pos.x, p2Pos.z);
  if (distFromCenter > 5.1) {
    moveInput.x = -p2Pos.x * 0.8;
    moveInput.z = -p2Pos.z * 0.8;
  } else if (fighterP1.isRagdoll) {
    // Nếu người chơi đang ngã uốn dẻo, Bot lao vào đấm và húc ra mép đài!
    moveInput.x = (dx / dist) * botSpeed * 1.25;
    moveInput.z = (dz / dist) * botSpeed * 1.25;
    if (dist < 1.4 && Math.random() < 0.12) {
      fighterP2.punch();
    }
  } else if (dist > 1.6) {
    // Tiếp cận có lượn vòng tạo thế
    const nx = dx / dist;
    const nz = dz / dist;
    moveInput.x = (nx + -nz * botStrafe * 0.6) * botSpeed;
    moveInput.z = (nz + nx * botStrafe * 0.6) * botSpeed;
  } else {
    // Đã áp sát -> tung cú đấm smash
    if (Math.random() < 0.1) {
      fighterP2.punch();
    }
    // Lùi nhẹ hoặc lách sang bên
    moveInput.x = -dz * 0.8;
    moveInput.z = dx * 0.8;
  }

  p2Pos.x += moveInput.x * dt;
  p2Pos.z += moveInput.z * dt;

  fighterP2.update(dt, moveInput);
}

// 1. VA CHẠM THÂN THỂ GIỮA 2 VÕ SĨ (PUSHING & SHOVING VUI NHỘN)
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
      // 2 võ sĩ đẩy nhau cân tài cân sức
      p1.x -= nx * overlap * 0.5;
      p1.z -= nz * overlap * 0.5;
      p2.x += nx * overlap * 0.5;
      p2.z += nz * overlap * 0.5;
    } else if (f1.isRagdoll && !f2.isRagdoll) {
      // F1 đang uốn dẻo -> F2 húc F1 trượt dài
      p1.x -= nx * overlap * 0.85;
      p1.z -= nz * overlap * 0.85;
      f1.velocity.x -= nx * 4.2;
      f1.velocity.z -= nz * 4.2;
    } else if (!f1.isRagdoll && f2.isRagdoll) {
      // F2 đang uốn dẻo -> F1 húc F2 trượt dài
      p2.x += nx * overlap * 0.85;
      p2.z += nz * overlap * 0.85;
      f2.velocity.x += nx * 4.2;
      f2.velocity.z += nz * 4.2;
    }
  }
}

// 2. DÂY ĐÀI ĐÀN HỒI (TRAMPOLINE ELASTIC BOING REBOUND)
function checkRopes(fighter) {
  if (fighter.isFallingOff) return;

  const pos = fighter.root.position;
  const bound = 5.85; // Cạnh dây đài

  // Nếu còn trong tầm với của dây đài
  if (pos.y < 1.35) {
    let bounced = false;

    // Cạnh dây phải (+X)
    if (pos.x > bound) {
      pos.x = bound;
      fighter.velocity.x = -Math.max(Math.abs(fighter.velocity.x) * 1.35, 6.8);
      bounced = true;
    }
    // Cạnh dây trái (-X)
    if (pos.x < -bound) {
      pos.x = -bound;
      fighter.velocity.x = Math.max(Math.abs(fighter.velocity.x) * 1.35, 6.8);
      bounced = true;
    }
    // Cạnh dây trước (+Z)
    if (pos.z > bound) {
      pos.z = bound;
      fighter.velocity.z = -Math.max(Math.abs(fighter.velocity.z) * 1.35, 6.8);
      bounced = true;
    }
    // Cạnh dây sau (-Z)
    if (pos.z < -bound) {
      pos.z = -bound;
      fighter.velocity.z = Math.max(Math.abs(fighter.velocity.z) * 1.35, 6.8);
      bounced = true;
    }

    if (bounced) {
      sounds.playBoing();
      particles.createPunchStars(pos.x, 1.2, pos.z, 8);
      screenShake = 0.16;
      fighter.squashY = 0.75;
      fighter.squashXZ = 1.25;
    }
  }
}

// 3. KIỂM TRA ĐÒN ĐẤM & RỚT ĐÀI
function checkCombat(dt) {
  if (isRoundEnding) return;

  const p1 = fighterP1;
  const p2 = fighterP2;

  // Va chạm thân người & dây đài
  resolveBodyCollision(p1, p2);
  checkRopes(p1);
  checkRopes(p2);

  // 1. Kiểm tra P1 đấm trúng P2
  if (p1.isPunching && !p2.isRagdoll && !p2.isFallingOff) {
    const punchPos = p1.getPunchHitbox();
    const p2BodyPos = p2.root.position.clone().setY(1.25);
    const hitDist = punchPos.distanceTo(p2BodyPos);

    if (hitDist < 1.4) {
      sounds.playPunch();
      particles.createPunchStars(p2BodyPos.x, p2BodyPos.y, p2BodyPos.z, 16);
      screenShake = 0.24;

      const knockbackDir = new THREE.Vector3().subVectors(p2.root.position, p1.root.position).normalize();
      knockbackDir.y = 0.55;
      knockbackDir.multiplyScalar(14.5);
      p2.takeHit(knockbackDir);
    }
  }

  // 2. Kiểm tra P2 đấm trúng P1
  if (p2.isPunching && !p1.isRagdoll && !p1.isFallingOff) {
    const punchPos = p2.getPunchHitbox();
    const p1BodyPos = p1.root.position.clone().setY(1.25);
    const hitDist = punchPos.distanceTo(p1BodyPos);

    if (hitDist < 1.4) {
      sounds.playPunch();
      particles.createPunchStars(p1BodyPos.x, p1BodyPos.y, p1BodyPos.z, 16);
      screenShake = 0.24;

      const knockbackDir = new THREE.Vector3().subVectors(p1.root.position, p2.root.position).normalize();
      knockbackDir.y = 0.55;
      knockbackDir.multiplyScalar(14.5);
      p1.takeHit(knockbackDir);
    }
  }

  // 3. Kiểm tra Rớt Đài (Ring Out ra khỏi mép đài 6.35m)
  if (Math.abs(p1.root.position.x) > 6.35 || Math.abs(p1.root.position.z) > 6.35) {
    p1.isFallingOff = true;
  }
  if (Math.abs(p2.root.position.x) > 6.35 || Math.abs(p2.root.position.z) > 6.35) {
    p2.isFallingOff = true;
  }

  if (p1.isFallingOff && p1.root.position.y <= -1.2) {
    handleRingOut('p2');
  } else if (p2.isFallingOff && p2.root.position.y <= -1.2) {
    handleRingOut('p1');
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
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
      showToast(won ? '🏆 VÔ ĐỊCH VÕ ĐÀI RAGDOLL ARENA!' : 'THUA TRẬN NÀY RỒI! HÃY THỬ LẠI NHÉ!', won ? 'success' : 'warning', 4000);
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

// DIALOG MẸO THI ĐẤU (POPUP CHUYÊN NGHIỆP, KHÔNG ĐÈ LÊN SÀN ĐẤU)
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

// ANIMATION LOOP VỚI CAMERA SHAKE
let lastFrameTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastFrameTime) / 1000, 0.04);
  lastFrameTime = now;

  if (gameMode !== 'MENU') {
    const myFighter = myRole === 'p1' ? fighterP1 : fighterP2;
    const moveInput = { x: 0, z: 0 };
    const speed = 4.8;

    if (keys.w) moveInput.z -= speed;
    if (keys.s) moveInput.z += speed;
    if (keys.a) moveInput.x -= speed;
    if (keys.d) moveInput.x += speed;

    if (!myFighter.isRagdoll && !myFighter.isFallingOff && !isRoundEnding) {
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
