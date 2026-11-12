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

let playerColorHex = parseInt(localStorage.getItem('tboy_ragdoll_color') || '0x0284c7', 16);

let p1Score = 0;
let p2Score = 0;
const targetScore = 5;
let isRoundEnding = false;
let screenShake = 0;
let currentRoundId = 0;
let sprintToggleTimer = 0;
let sprintTrailTimer = 0;
const oppTargetState = {
  hasTarget: false,
  x: 3.2,
  y: 0,
  z: 0,
  rotY: -Math.PI / 2,
  isRagdoll: false,
  isSprinting: false,
  isFallingOff: false
};
const btnPunch = document.getElementById('btn-punch');
const btnSprint = document.getElementById('btn-sprint');

// THREE.JS SCENE SETUP
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfdf2f8);
scene.fog = new THREE.FogExp2(0xfdf2f8, 0.007);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 150);
const currentCamPos = new THREE.Vector3(-5.5, 11.2, 14.5);
const currentCamLookAt = new THREE.Vector3(-1.5, 0.4, 0);
const targetCamPos = new THREE.Vector3(-5.5, 11.2, 14.5);
const targetCamLookAt = new THREE.Vector3(-1.5, 0.4, 0);

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
mainLight.shadow.mapSize.width = 1024;
mainLight.shadow.mapSize.height = 1024;
mainLight.shadow.camera.near = 1;
mainLight.shadow.camera.far = 65;
mainLight.shadow.camera.left = -11;
mainLight.shadow.camera.right = 11;
mainLight.shadow.camera.top = 11;
mainLight.shadow.camera.bottom = -11;
mainLight.shadow.bias = -0.0004;
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0xbae6fd, 0.7);
fillLight.position.set(-10, 20, -10);
scene.add(fillLight);

// TẠO VÕ ĐÀI & HIỆU ỨNG
const arena = createArena();
scene.add(arena);

const particles = new ParticleFX(scene);

// TẠO 2 ĐÔ VẬT RAGDOLL UỐN DẺO
const fighterP1 = new RagdollCharacter(scene, playerColorHex, true);
const fighterP2 = new RagdollCharacter(scene, 0xf43f5e, false);

resetFighterPositions();

// CĂN CHỈNH CAMERA RỘNG CHO CẢ TRANG CHỜ & TRONG TRẬN ĐẤU
function updateCameraTarget() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

  if (gameMode === 'MENU') {
    // TRANG CHỜ LOBBY: Góc nghiêng 3/4 Isometric đẩy sàn đấu sang phải một chút để nhường chỗ cột Menu bên trái
    if (width < 950) {
      targetCamPos.set(-3.2, 11.4, 14.5);
      targetCamLookAt.set(-1.6, 0.4, 0);
    } else {
      targetCamPos.set(-5.8, 11.2, 14.8);
      targetCamLookAt.set(-1.8, 0.4, 0);
    }
  } else {
    // TRONG TRẬN ĐẤU: Chính diện cân đối toàn sân rộng rãi, chừa không gian cho bộ nút 2 góc
    let targetDist = 19.6;
    if (aspect < 1.4) targetDist = 20.8;
    if (aspect < 1.0) targetDist = Math.max(9.2 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect), 28.0);

    targetCamPos.set(0, targetDist * 0.65, targetDist * 0.76);
    targetCamLookAt.set(0, 0.0, 0.3);
  }
}

updateCameraTarget();
currentCamPos.copy(targetCamPos);
currentCamLookAt.copy(targetCamLookAt);
camera.position.copy(currentCamPos);
camera.lookAt(currentCamLookAt);

window.addEventListener('resize', updateCameraTarget);

// KHÓA CỨNG XOAY NGANG CHO THIẾT BỊ DI ĐỘNG
function requestLandscape() {
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(() => {});
  }
}

document.getElementById('btn-force-landscape')?.addEventListener('click', async () => {
  sounds.playClick();
  requestLandscape();
  const el = document.documentElement;
  if (el.requestFullscreen && !document.fullscreenElement) {
    try { await el.requestFullscreen(); } catch (e) {}
  }
});

// ===================================================
// HỆ THỐNG ĐIỀU KHIỂN ĐA NĂNG (JOYSTICK + BÀN PHÍM + ĐẤM + CHẠY NHANH)
// ===================================================
const keys = { w: false, a: false, s: false, d: false, space: false, shift: false };

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') keys.w = true;
  if (k === 'a' || k === 'arrowleft') keys.a = true;
  if (k === 's' || k === 'arrowdown') keys.s = true;
  if (k === 'd' || k === 'arrowright') keys.d = true;
  if (e.key === 'Shift') {
    if (!keys.shift && gameMode !== 'MENU') sounds.playSprint();
    keys.shift = true;
  }
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
  if (e.key === 'Shift') keys.shift = false;
  if (k === ' ') keys.space = false;
});

// VIRTUAL JOYSTICK BÊN TRÁI (HỖ TRỢ ĐA ĐIỂM MULTI-TOUCH & CHUỘT)
const joystickZone = document.getElementById('joystick-zone');
const joystickThumb = document.getElementById('joystick-thumb');
const joystickInput = { x: 0, z: 0 };
let joystickTouchId = null;
let joystickCenter = { x: 0, y: 0 };
const maxJoyRadius = 38;

function updateJoystickFromClientPos(clientX, clientY) {
  const dx = clientX - joystickCenter.x;
  const dy = clientY - joystickCenter.y;
  const dist = Math.hypot(dx, dy);
  const clamped = Math.min(dist, maxJoyRadius);
  const angle = Math.atan2(dy, dx);

  const tx = Math.cos(angle) * clamped;
  const ty = Math.sin(angle) * clamped;

  if (joystickThumb) {
    joystickThumb.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
  }

  if (dist > 6) {
    const norm = clamped / maxJoyRadius;
    joystickInput.x = Math.cos(angle) * norm;
    joystickInput.z = Math.sin(angle) * norm;
  } else {
    joystickInput.x = 0;
    joystickInput.z = 0;
  }
}

function resetJoystick() {
  joystickTouchId = null;
  joystickInput.x = 0;
  joystickInput.z = 0;
  if (joystickThumb) {
    joystickThumb.style.transform = 'translate3d(0px, 0px, 0)';
  }
}

if (joystickZone) {
  // Touch Multi-touch cho Mobile
  joystickZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (joystickTouchId !== null) return;
    const touch = e.changedTouches[0];
    joystickTouchId = touch.identifier;
    const rect = joystickZone.getBoundingClientRect();
    joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    updateJoystickFromClientPos(touch.clientX, touch.clientY);
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (joystickTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joystickTouchId) {
        updateJoystickFromClientPos(t.clientX, t.clientY);
        break;
      }
    }
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (joystickTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId) {
        resetJoystick();
        break;
      }
    }
  });

  // Chuột kéo Joystick trên Laptop/PC
  let isMouseJoy = false;
  joystickZone.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    isMouseJoy = true;
    const rect = joystickZone.getBoundingClientRect();
    joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    updateJoystickFromClientPos(e.clientX, e.clientY);
  });

  window.addEventListener('mousemove', (e) => {
    if (isMouseJoy) updateJoystickFromClientPos(e.clientX, e.clientY);
  });

  window.addEventListener('mouseup', () => {
    if (isMouseJoy) {
      isMouseJoy = false;
      resetJoystick();
    }
  });
}

// 2 NÚT HÀNH ĐỘNG BÊN PHẢI: CHẠY NHANH (GIƠ TAY LÊN TRỜI) & ĐẤM

if (btnPunch) {
  const triggerPunchEvt = (e) => {
    e.preventDefault();
    e.stopPropagation();
    btnPunch.classList.add('pressed');
    setTimeout(() => btnPunch.classList.remove('pressed'), 120);
    handlePunch();
  };
  btnPunch.addEventListener('touchstart', triggerPunchEvt, { passive: false });
  btnPunch.addEventListener('mousedown', triggerPunchEvt);
}

if (btnSprint) {
  const triggerSprintEvt = (e) => {
    e.preventDefault();
    e.stopPropagation();
    btnSprint.classList.add('pressed');
    setTimeout(() => btnSprint.classList.remove('pressed'), 120);

    if (sprintToggleTimer > 0) {
      sprintToggleTimer = 0;
      btnSprint.classList.remove('active-sprint');
    } else {
      sprintToggleTimer = 4.0; // Kích hoạt tăng tốc giơ tay chạy 4 giây
      sounds.playSprint();
      btnSprint.classList.add('active-sprint');
    }
  };
  btnSprint.addEventListener('touchstart', triggerSprintEvt, { passive: false });
  btnSprint.addEventListener('mousedown', triggerSprintEvt);
}

// CLICK CHUỘT TRÊN SÀN ĐẤU ĐỂ ĐẤM (NẾU KHÔNG BẤM VÀO NÚT HAY JOYSTICK)
window.addEventListener('mousedown', (e) => {
  if (gameMode === 'MENU' || e.target.closest('#main-menu') || e.target.closest('.tboy-modal-overlay') || e.target.closest('#hud') || e.target.closest('#in-game-controls')) return;
  handlePunch();
});

function handlePunch() {
  if (isRoundEnding || gameMode === 'MENU') return;
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

// ===================================================
// BOT AI & HỆ THỐNG CHIẾN ĐẤU
// ===================================================
let botDecisionTimer = 0;
let botStrafe = 0;

function updateBotAI(dt) {
  const moveInput = { x: 0, z: 0 };
  if (gameMode !== 'AI' || isRoundEnding || fighterP2.isRagdoll || fighterP2.isFallingOff) {
    fighterP2.isSprinting = false;
    return moveInput;
  }

  const p1Pos = fighterP1.root.position;
  const p2Pos = fighterP2.root.position;
  const dx = p1Pos.x - p2Pos.x;
  const dz = p1Pos.z - p2Pos.z;
  const dist = Math.hypot(dx, dz);

  botDecisionTimer -= dt;
  if (botDecisionTimer <= 0) {
    botDecisionTimer = 0.35 + Math.random() * 0.35;
    botStrafe = (Math.random() - 0.5) * 2.0;
    // Thi thoảng Bot cũng bật chế độ giơ tay chạy nhanh vui nhộn khi đuổi theo!
    fighterP2.isSprinting = (dist > 3.5 && Math.random() < 0.35);
  }

  const botSpeed = fighterP2.isSprinting ? 7.6 : 4.5;
  const distFromCenter = Math.hypot(p2Pos.x, p2Pos.z);

  if (distFromCenter > 5.1) {
    fighterP2.isSprinting = false;
    moveInput.x = -p2Pos.x * 0.9;
    moveInput.z = -p2Pos.z * 0.9;
  } else if (fighterP1.isRagdoll) {
    moveInput.x = (dx / dist) * botSpeed * 1.2;
    moveInput.z = (dz / dist) * botSpeed * 1.2;
    if (dist < 1.6 && Math.random() < 0.15) {
      fighterP2.root.rotation.y = Math.atan2(dx, dz);
      fighterP2.punch();
    }
  } else if (dist > 1.6) {
    const nx = dx / dist;
    const nz = dz / dist;
    moveInput.x = (nx + -nz * botStrafe * 0.5) * botSpeed;
    moveInput.z = (nz + nx * botStrafe * 0.5) * botSpeed;
  } else {
    fighterP2.isSprinting = false;
    fighterP2.root.rotation.y = Math.atan2(dx, dz);
    if (Math.random() < 0.12) {
      fighterP2.punch();
    }
    moveInput.x = -dz * 0.8;
    moveInput.z = dx * 0.8;
  }

  p2Pos.x += moveInput.x * dt;
  p2Pos.z += moveInput.z * dt;

  return moveInput;
}

// VA CHẠM THÂN THỂ & HÚC NGƯỜI KHI CHẠY NHANH
function resolveBodyCollision(f1, f2) {
  if (f1.isFallingOff || f2.isFallingOff) return;

  const p1 = f1.root.position;
  const p2 = f2.root.position;
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const dist = Math.hypot(dx, dz);
  const minDist = 1.15;

  if (dist < minDist && dist > 0.001) {
    const overlap = minDist - dist;
    const nx = dx / dist;
    const nz = dz / dist;

    // Nếu đang ONLINE, chỉ kích hoạt húc bay từ người đang điều khiển nhân vật này
    if (gameMode === 'ONLINE') {
      const myFighter = myRole === 'p1' ? f1 : f2;
      const oppFighter = myRole === 'p1' ? f2 : f1;
      const oppRole = myRole === 'p1' ? 'p2' : 'p1';
      const sign = myRole === 'p1' ? 1 : -1;

      if (myFighter.isSprinting && !myFighter.isRagdoll && !oppFighter.isRagdoll && !oppFighter.isFallingOff) {
        sounds.playPunch();
        particles.createPunchStars(oppFighter.root.position.x, 1.2, oppFighter.root.position.z, 12);
        screenShake = 0.22;
        const hitVec = new THREE.Vector3(nx * sign * 11.0, 3.8, nz * sign * 11.0);
        oppFighter.takeHit(hitVec);
        ragdollMP.sendHit(oppRole, hitVec);
        return;
      }
    } else {
      // AI MODE: P1 hoặc P2 húc nhau
      if (f1.isSprinting && !f1.isRagdoll && !f2.isRagdoll) {
        sounds.playPunch();
        particles.createPunchStars(p2.x, 1.2, p2.z, 12);
        screenShake = 0.22;
        f2.takeHit(new THREE.Vector3(nx * 10.5, 3.8, nz * 10.5));
        return;
      }

      if (f2.isSprinting && !f2.isRagdoll && !f1.isRagdoll) {
        sounds.playPunch();
        particles.createPunchStars(p1.x, 1.2, p1.z, 12);
        screenShake = 0.22;
        f1.takeHit(new THREE.Vector3(-nx * 10.5, 3.8, -nz * 10.5));
        return;
      }
    }

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

// DÂY ĐÀI ĐÀN HỒI & CƠ CHẾ RỚT ĐÀI
function checkRopes(fighter) {
  if (fighter.isFallingOff) return;

  const pos = fighter.root.position;
  const bound = 5.80;

  if (!fighter.isRagdoll) {
    let touched = false;
    if (pos.x > bound) { pos.x = bound; touched = true; }
    if (pos.x < -bound) { pos.x = -bound; touched = true; }
    if (pos.z > bound) { pos.z = bound; touched = true; }
    if (pos.z < -bound) { pos.z = -bound; touched = true; }

    if (touched) {
      fighter.velocity.x *= -0.4;
      fighter.velocity.z *= -0.4;
    }
    return;
  }

  const isOutside = Math.abs(pos.x) > bound || Math.abs(pos.z) > bound;
  if (isOutside) {
    const horizSpeed = Math.hypot(fighter.velocity.x, fighter.velocity.z);
    if (horizSpeed > 3.8 || pos.y > 0.35) {
      fighter.isFallingOff = true;
      sounds.playBoing();
      particles.createPunchStars(pos.x, 1.2, pos.z, 14);
      screenShake = 0.22;
      return;
    } else {
      // Phản hồi đàn hồi mượt mà hướng vào tâm võ đài (chống kẹt góc)
      const toCenterX = -Math.sign(pos.x);
      const toCenterZ = -Math.sign(pos.z);
      if (Math.abs(pos.x) > bound) {
        pos.x = Math.sign(pos.x) * bound;
        fighter.velocity.x = toCenterX * Math.max(Math.abs(fighter.velocity.x) * 0.85, 3.5);
      }
      if (Math.abs(pos.z) > bound) {
        pos.z = Math.sign(pos.z) * bound;
        fighter.velocity.z = toCenterZ * Math.max(Math.abs(fighter.velocity.z) * 0.85, 3.5);
      }
      sounds.playBoing();
    }
  }
}

function checkCombat(dt) {
  if (isRoundEnding) return;

  const p1 = fighterP1;
  const p2 = fighterP2;

  resolveBodyCollision(p1, p2);
  checkRopes(p1);
  checkRopes(p2);

  const p1Pos = p1.root.position;
  const p2Pos = p2.root.position;
  const dist = Math.hypot(p2Pos.x - p1Pos.x, p2Pos.z - p1Pos.z);

  if (gameMode === 'ONLINE') {
    const attacker = myRole === 'p1' ? p1 : p2;
    const victim = myRole === 'p1' ? p2 : p1;
    const oppRole = myRole === 'p1' ? 'p2' : 'p1';
    const aPos = attacker.root.position;
    const vPos = victim.root.position;

    if (attacker.isPunching && !victim.isRagdoll && !victim.isFallingOff) {
      const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), attacker.root.rotation.y);
      const toVictim = new THREE.Vector3(vPos.x - aPos.x, 0, vPos.z - aPos.z).normalize();
      if (dist < 1.9 && forward.dot(toVictim) > 0.1) {
        sounds.playPunch();
        particles.createPunchStars(vPos.x, 1.25, vPos.z, 18);
        screenShake = 0.28;
        const knockback = toVictim.clone();
        knockback.y = 0.45;
        knockback.multiplyScalar(14.0);
        victim.takeHit(knockback);
        ragdollMP.sendHit(oppRole, knockback);
      }
    }
  } else {
    // AI / LOCAL MODE
    if (p1.isPunching && !p2.isRagdoll && !p2.isFallingOff) {
      const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), p1.root.rotation.y);
      const toVictim = new THREE.Vector3(p2Pos.x - p1Pos.x, 0, p2Pos.z - p1Pos.z).normalize();
      if (dist < 1.9 && forward.dot(toVictim) > 0.1) {
        sounds.playPunch();
        particles.createPunchStars(p2Pos.x, 1.25, p2Pos.z, 18);
        screenShake = 0.28;
        const knockback = toVictim.clone();
        knockback.y = 0.45;
        knockback.multiplyScalar(14.0);
        p2.takeHit(knockback);
      }
    }

    if (p2.isPunching && !p1.isRagdoll && !p1.isFallingOff) {
      const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), p2.root.rotation.y);
      const toVictim = new THREE.Vector3(p1Pos.x - p2Pos.x, 0, p1Pos.z - p2Pos.z).normalize();
      if (dist < 1.9 && forward.dot(toVictim) > 0.1) {
        sounds.playPunch();
        particles.createPunchStars(p1Pos.x, 1.25, p1Pos.z, 18);
        screenShake = 0.28;
        const knockback = toVictim.clone();
        knockback.y = 0.45;
        knockback.multiplyScalar(14.0);
        p1.takeHit(knockback);
      }
    }
  }

  // CHỈ HOST P1 QUYẾT ĐỊNH RING OUT TRONG CHẾ ĐỘ ONLINE ĐỂ KHÔNG BỊ TRÙNG ĐIỂM
  if (gameMode !== 'ONLINE' || myRole === 'p1') {
    if (p1.isFallingOff && p1.root.position.y <= -0.9) {
      handleRingOut('p2');
    } else if (p2.isFallingOff && p2.root.position.y <= -0.9) {
      handleRingOut('p1');
    }
  }
}

const koBanner = document.getElementById('ko-banner');
const p1ScoreEl = document.getElementById('p1-score');
const p2ScoreEl = document.getElementById('p2-score');

function handleRingOut(winner) {
  isRoundEnding = true;
  sounds.playFallRing();

  if (winner === 'p1') {
    p1Score++;
    p1ScoreEl.innerText = p1Score;
  } else {
    p2Score++;
    p2ScoreEl.innerText = p2Score;
  }

  const iWon = (winner === 'p1' && myRole === 'p1') || (winner === 'p2' && myRole === 'p2');
  koBanner.innerHTML = iWon
    ? '<span>💥</span> RING OUT! BẠN GHI ĐIỂM!'
    : '<span>🤖</span> RING OUT! ĐỐI THỦ GHI ĐIỂM!';

  if (gameMode === 'ONLINE' && myRole === 'p1') {
    currentRoundId++;
    ragdollMP.updateRoundState({ p1: p1Score, p2: p2Score }, winner, currentRoundId);
  }

  koBanner.classList.add('show');

  setTimeout(() => {
    koBanner.classList.remove('show');
    if (p1Score >= targetScore || p2Score >= targetScore) {
      sounds.playVictory();
      if (iWon) confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 } });
      showToast(iWon ? '🏆 VÔ ĐỊCH VÕ ĐÀI RAGDOLL ARENA!' : 'THUA TRẬN NÀY RỒI! HÃY THỬ LẠI NHÉ!', iWon ? 'success' : 'warning', 4500);
      resetMatch();
      backToMenu();
    } else {
      resetFighterPositions();
      oppTargetState.hasTarget = false;
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
  fighterP1.isSprinting = false;

  fighterP2.root.position.set(3.2, 0, 0);
  fighterP2.root.rotation.y = -Math.PI / 2;
  fighterP2.velocity.set(0, 0, 0);
  fighterP2.angularVelocity.set(0, 0, 0);
  fighterP2.torsoGroup.rotation.set(0, 0, 0);
  fighterP2.headPivot.rotation.set(0, 0, 0);
  fighterP2.isRagdoll = false;
  fighterP2.isFallingOff = false;
  fighterP2.isSprinting = false;

  sprintToggleTimer = 0;
  if (btnSprint) btnSprint.classList.remove('active-sprint');
}

function resetMatch() {
  p1Score = 0;
  p2Score = 0;
  p1ScoreEl.innerText = '0';
  p2ScoreEl.innerText = '0';
  resetFighterPositions();
  isRoundEnding = false;
}

function enterMatchUI() {
  requestLandscape();
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('in-game-controls').classList.remove('hidden');
  updateCameraTarget();
}

function backToMenu() {
  gameMode = 'MENU';
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('in-game-controls').classList.add('hidden');
  document.getElementById('main-menu').classList.remove('hidden');
  ragdollMP.leaveRoom();
  oppTargetState.hasTarget = false;
  fighterP1.setColor(playerColorHex);
  fighterP2.setColor(0xf43f5e);
  resetFighterPositions();
  updateCameraTarget();
}

// REALTIME FIREBASE MULTIPLAYER LISTENERS
ragdollMP.on('game_start', (data) => {
  document.getElementById('modal-online').classList.add('hidden');
  gameMode = 'ONLINE';
  currentRoundId = 0;
  oppTargetState.hasTarget = false;
  isMyReady = false;
  resetMatch();
  enterMatchUI();

  if (data.players && data.players.p1 && data.players.p2) {
    document.getElementById('hud-p1-name').innerText = (data.players.p1.name || 'P1').toUpperCase();
    document.getElementById('hud-p2-name').innerText = (data.players.p2.name || 'P2').toUpperCase();
    if (data.players.p1.color) fighterP1.setColor(data.players.p1.color);
    if (data.players.p2.color) fighterP2.setColor(data.players.p2.color);
  }
  showToast('Đô vật đã sẵn sàng! Trận đấu bắt đầu!', 'success');
});

ragdollMP.on('room_updated', (data) => {
  renderRoomSlots(data.players);
});

function renderRoomSlots(players) {
  const container = document.getElementById('room-players-container');
  if (!container) return;
  const p1 = players ? players.p1 : null;
  const p2 = players ? players.p2 : null;

  let html = '';
  // Slot P1 (Host)
  if (p1) {
    const isMe = myRole === 'p1';
    const readyClass = p1.ready ? 'ready' : '';
    const badgeClass = p1.ready ? 'ready' : 'wait';
    const badgeText = p1.ready ? 'ĐÃ SẴN SÀNG ✅' : 'CHƯA SẴN SÀNG ⏳';
    html += `
      <div class="room-slot ${readyClass}">
        <div class="slot-avatar">🥊</div>
        <div class="slot-text">
          <span class="slot-name">${p1.name} ${isMe ? '(BẠN)' : ''}</span>
          <span class="slot-role host">★ CHỦ PHÒNG (P1)</span>
        </div>
        <span class="slot-badge ${badgeClass}">${badgeText}</span>
      </div>
    `;
  }

  // Slot P2 (Guest)
  if (p2) {
    const isMe = myRole === 'p2';
    const readyClass = p2.ready ? 'ready' : '';
    const badgeClass = p2.ready ? 'ready' : 'wait';
    const badgeText = p2.ready ? 'ĐÃ SẴN SÀNG ✅' : 'CHƯA SẴN SÀNG ⏳';
    html += `
      <div class="room-slot ${readyClass}">
        <div class="slot-avatar">🤼</div>
        <div class="slot-text">
          <span class="slot-name">${p2.name} ${isMe ? '(BẠN)' : ''}</span>
          <span class="slot-role">ĐẤU THỦ (P2)</span>
        </div>
        <span class="slot-badge ${badgeClass}">${badgeText}</span>
      </div>
    `;
  } else {
    html += `
      <div class="room-slot empty">
        <div class="slot-avatar">⏳</div>
        <div class="slot-text">
          <span class="slot-name">Đang chờ bạn bè tham gia...</span>
          <span class="slot-role">Quét QR hoặc nhập mã PIN</span>
        </div>
        <span class="slot-badge wait">CHỜ...</span>
      </div>
    `;
  }

  container.innerHTML = html;

  // Kiểm tra điều kiện bắt đầu trận đấu
  const bothReady = p1 && p2 && p1.ready && p2.ready;
  const hostStartBtn = document.getElementById('btn-host-start');
  const statusNote = document.getElementById('room-status-note');

  if (bothReady) {
    if (myRole === 'p1') {
      hostStartBtn.classList.remove('hidden');
      statusNote.innerText = 'Cả 2 đã sẵn sàng! Bấm nút bên dưới để lên đài ngay!';
      statusNote.style.color = '#16a34a';
    } else {
      hostStartBtn.classList.add('hidden');
      statusNote.innerText = 'Cả 2 đã sẵn sàng! Đang chờ chủ phòng bấm bắt đầu...';
      statusNote.style.color = '#16a34a';
    }
  } else {
    hostStartBtn.classList.add('hidden');
    if (p2) {
      statusNote.innerText = 'Đang chờ cả 2 cùng bấm SẴN SÀNG...';
      statusNote.style.color = '#ea580c';
    } else {
      statusNote.innerText = 'Đang chờ bạn bè quét QR hoặc nhập mã...';
      statusNote.style.color = '#ea580c';
    }
  }
}

ragdollMP.on('opponent_state', (data) => {
  const opp = myRole === 'p1' ? fighterP2 : fighterP1;
  oppTargetState.hasTarget = true;
  oppTargetState.x = data.x;
  oppTargetState.y = data.y;
  oppTargetState.z = data.z;
  oppTargetState.rotY = data.rotY;
  oppTargetState.isRagdoll = !!data.isRagdoll;
  oppTargetState.isSprinting = !!data.isSprinting;
  oppTargetState.isFallingOff = !!data.isFallingOff;

  if (data.isPunching && !opp.isPunching) opp.punch();
});

ragdollMP.on('received_hit', (hitData) => {
  const myFighter = myRole === 'p1' ? fighterP1 : fighterP2;
  if (!myFighter.isRagdoll && !myFighter.isFallingOff && !isRoundEnding) {
    sounds.playPunch();
    particles.createPunchStars(myFighter.root.position.x, 1.25, myFighter.root.position.z, 18);
    screenShake = 0.28;
    myFighter.takeHit(new THREE.Vector3(hitData.vx, hitData.vy, hitData.vz));
  }
});

ragdollMP.on('round_result', (data) => {
  if (myRole === 'p2') {
    isRoundEnding = true;
    sounds.playFallRing();
    p1Score = data.scores.p1;
    p2Score = data.scores.p2;
    p1ScoreEl.innerText = p1Score;
    p2ScoreEl.innerText = p2Score;

    const iWon = (data.winner === 'p2');
    koBanner.innerHTML = iWon
      ? '<span>💥</span> RING OUT! BẠN GHI ĐIỂM!'
      : '<span>🤖</span> RING OUT! ĐỐI THỦ GHI ĐIỂM!';
    koBanner.classList.add('show');

    setTimeout(() => {
      koBanner.classList.remove('show');
      if (p1Score >= targetScore || p2Score >= targetScore) {
        sounds.playVictory();
        if (iWon) confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 } });
        showToast(iWon ? '🏆 VÔ ĐỊCH VÕ ĐÀI RAGDOLL ARENA!' : 'THUA TRẬN NÀY RỒI! HÃY THỬ LẠI NHÉ!', iWon ? 'success' : 'warning', 4500);
        resetMatch();
        backToMenu();
      } else {
        resetFighterPositions();
        oppTargetState.hasTarget = false;
        isRoundEnding = false;
      }
    }, 2200);
  }
});

ragdollMP.on('player_disconnected', () => {
  if (gameMode === 'ONLINE') {
    showToast('Đối thủ đã rời võ đài!', 'warning');
    backToMenu();
  }
});

// UI LOBBY EVENT LISTENERS
document.getElementById('btn-play-ai').addEventListener('click', () => {
  sounds.playClick();
  gameMode = 'AI';
  myRole = 'p1';
  fighterP1.setColor(playerColorHex);
  fighterP2.setColor(0xf43f5e);
  document.getElementById('hud-p1-name').innerText = playerName.toUpperCase();
  document.getElementById('hud-p2-name').innerText = 'BOT';
  resetMatch();
  enterMatchUI();
  showToast('Bắt đầu đấu với Bot!', 'info');
});

// ONLINE MENU MODAL & PHÒNG CHỜ VIP
const modalOnline = document.getElementById('modal-online');
const onlineViewLobby = document.getElementById('online-view-lobby');
const onlineViewRoom = document.getElementById('online-view-room');
let isMyReady = false;

document.getElementById('btn-menu-online').addEventListener('click', () => {
  sounds.playClick();
  onlineViewLobby.classList.remove('hidden');
  onlineViewRoom.classList.add('hidden');
  modalOnline.classList.remove('hidden');
});

document.getElementById('btn-close-online').addEventListener('click', () => {
  sounds.playClick();
  modalOnline.classList.add('hidden');
});

function openRoomView(code) {
  roomCode = code;
  document.getElementById('display-room-code').innerText = code;
  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
  const qrImg = document.getElementById('room-qr-img');
  if (qrImg) {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(inviteUrl)}&color=0f172a&bgcolor=ffffff`;
  }
  isMyReady = false;
  const btnRoomReady = document.getElementById('btn-room-ready');
  const txtRoomReady = document.getElementById('txt-room-ready');
  if (txtRoomReady) txtRoomReady.innerText = 'SẴN SÀNG CHIẾN ĐẤU 🔥';
  if (btnRoomReady) btnRoomReady.style.background = '';

  onlineViewLobby.classList.add('hidden');
  onlineViewRoom.classList.remove('hidden');
}

// TẠO PHÒNG
const handleCreateRoom = async () => {
  sounds.playClick();
  requestLandscape();
  try {
    const res = await ragdollMP.createRoom(playerName, playerColorHex);
    myRole = 'p1';
    openRoomView(res.roomCode);
    renderRoomSlots({ p1: { name: playerName, ready: false } });
  } catch (e) {
    showToast('Lỗi tạo phòng: ' + e.message, 'error');
  }
};

document.getElementById('card-create-room').addEventListener('click', handleCreateRoom);
document.getElementById('btn-opt-create').addEventListener('click', (e) => {
  e.stopPropagation();
  handleCreateRoom();
});

// VÀO PHÒNG BẰNG MÃ
async function doJoinRoom(code) {
  requestLandscape();
  try {
    const res = await ragdollMP.joinRoom(code, playerName, playerColorHex);
    myRole = 'p2';
    openRoomView(res.roomCode);
  } catch (e) {
    showToast(e.message || 'Lỗi tham gia phòng!', 'error');
  }
}

document.getElementById('btn-join-room').addEventListener('click', () => {
  sounds.playClick();
  const inputEl = document.getElementById('room-code-input');
  const code = inputEl ? inputEl.value.trim().toUpperCase() : '';
  if (!code) {
    showToast('Vui lòng nhập mã phòng!', 'warning');
    return;
  }
  doJoinRoom(code);
});

// NÚT SẴN SÀNG (READY)
const btnRoomReady = document.getElementById('btn-room-ready');
const txtRoomReady = document.getElementById('txt-room-ready');
btnRoomReady.addEventListener('click', () => {
  sounds.playClick();
  isMyReady = !isMyReady;
  ragdollMP.toggleReady(isMyReady);
  if (isMyReady) {
    txtRoomReady.innerText = 'HỦY SẴN SÀNG ⏳';
    btnRoomReady.style.background = 'linear-gradient(135deg, #64748b, #475569)';
  } else {
    txtRoomReady.innerText = 'SẴN SÀNG CHIẾN ĐẤU 🔥';
    btnRoomReady.style.background = '';
  }
});

// NÚT BẮT ĐẦU TRANH TÀI (DÀNH CHO CHỦ PHÒNG KHI CẢ 2 SẴN SÀNG)
document.getElementById('btn-host-start').addEventListener('click', () => {
  sounds.playClick();
  ragdollMP.startMatch();
});

// CHÉP MÃ & CHÉP LINK MỜI BẠN BÈ
document.getElementById('btn-copy-code-only').addEventListener('click', (e) => {
  e.stopPropagation();
  if (!roomCode || roomCode === '----') return;
  navigator.clipboard.writeText(roomCode);
  showToast(`Đã sao chép mã phòng: ${roomCode}`, 'success');
});

document.getElementById('btn-copy-invite-link').addEventListener('click', (e) => {
  e.stopPropagation();
  if (!roomCode || roomCode === '----') return;
  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
  navigator.clipboard.writeText(inviteUrl);
  showToast('Đã sao chép link mời bạn bè!', 'success');
});

// RỜI PHÒNG
document.getElementById('btn-leave-room').addEventListener('click', () => {
  sounds.playClick();
  ragdollMP.leaveRoom();
  isMyReady = false;
  txtRoomReady.innerText = 'SẴN SÀNG CHIẾN ĐẤU 🔥';
  btnRoomReady.style.background = '';
  onlineViewRoom.classList.add('hidden');
  onlineViewLobby.classList.remove('hidden');
});

// TỰ ĐỘNG VÀO PHÒNG KHI BẤM LINK MỜI CÓ ?room=CODE
const urlParams = new URLSearchParams(window.location.search);
const inviteRoomParam = urlParams.get('room');
if (inviteRoomParam) {
  const cleanCode = inviteRoomParam.toUpperCase().trim();
  setTimeout(() => {
    modalOnline.classList.remove('hidden');
    document.getElementById('room-code-input').value = cleanCode;
    doJoinRoom(cleanCode);
  }, 600);
}

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

document.getElementById('btn-bb-info')?.addEventListener('click', () => {
  sounds.playClick();
  showToast('Tboy Ragdoll Arena 3D · Phiên bản vật lý uốn dẻo v2.0!', 'info');
});

// COLOR PICKER MODAL (ĐỔI MÀU ĐÔ VẬT)
const modalColor = document.getElementById('modal-color');
document.getElementById('btn-menu-color').addEventListener('click', () => {
  sounds.playClick();
  modalColor.classList.remove('hidden');
});
[document.getElementById('btn-close-color'), document.getElementById('btn-save-color')].forEach(btn => {
  btn?.addEventListener('click', () => {
    sounds.playClick();
    modalColor.classList.add('hidden');
  });
});

document.querySelectorAll('.color-swatch').forEach(swatch => {
  const hexVal = parseInt(swatch.dataset.color, 16);
  if (hexVal === playerColorHex) {
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
  }
  swatch.addEventListener('click', () => {
    sounds.playClick();
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    playerColorHex = parseInt(swatch.dataset.color, 16);
    localStorage.setItem('tboy_ragdoll_color', swatch.dataset.color);
    fighterP1.setColor(playerColorHex);
    showToast('Đã đổi màu trang phục võ sĩ!', 'success');
  });
});

// MODAL HƯỚNG DẪN CHƠI
const modalTips = document.getElementById('modal-tips');
document.getElementById('btn-toggle-tips').addEventListener('click', () => {
  sounds.playClick();
  modalTips.classList.remove('hidden');
});
[document.getElementById('btn-close-tips'), document.getElementById('btn-ack-tips')].forEach((el) => {
  el?.addEventListener('click', () => {
    sounds.playClick();
    modalTips.classList.add('hidden');
  });
});

// SPLASH LOADING -> CHUYỂN MƯỢT VÀO TRANG CHỜ LOBBY
function dismissSplash() {
  const fill = document.getElementById('loading-bar-inner');
  const splash = document.getElementById('loading-screen');
  const menu = document.getElementById('main-menu');
  let p = 0;
  const interval = setInterval(() => {
    p += 20;
    if (fill) fill.style.width = `${p}%`;
    if (p >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        if (menu) menu.classList.remove('hidden');
        if (splash) {
          splash.classList.add('fade-out');
          setTimeout(() => {
            splash.classList.add('hidden');
            splash.style.display = 'none';
          }, 350);
        }
      }, 220);
    }
  }, 70);
}
if (document.readyState === 'complete') {
  dismissSplash();
} else {
  window.addEventListener('load', dismissSplash);
  setTimeout(dismissSplash, 800);
}

// EXPOSE DEBUG
window.gameDebug = {
  fighterP1,
  fighterP2,
  getScores: () => ({ p1: p1Score, p2: p2Score }),
  getGameMode: () => gameMode
};

// ANIMATION LOOP CHÍNH
let lastFrameTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastFrameTime) / 1000, 0.04);
  lastFrameTime = now;

  // Nội suy Camera mượt mà giữa Trang chờ Lobby và Vào Trận
  currentCamPos.lerp(targetCamPos, Math.min(dt * 5, 1.0));
  currentCamLookAt.lerp(targetCamLookAt, Math.min(dt * 5, 1.0));

  if (gameMode === 'MENU') {
    // Trong trang chờ Lobby, 2 nhân vật đứng vẫy chào thở nhịp nhàng trên thảm
    fighterP1.update(dt, { x: 0, z: 0 });
    fighterP2.update(dt, { x: 0, z: 0 });
  } else {
    // TRẠNG THÁI CHẠY NHANH HƠN (GIƠ 2 TAY LÊN TRỜI & HIỆU ỨNG BỤI KHÓI)
    if (sprintToggleTimer > 0) {
      sprintToggleTimer = Math.max(0, sprintToggleTimer - dt);
      if (sprintToggleTimer === 0 && btnSprint) {
        btnSprint.classList.remove('active-sprint');
      }
    }

    const myFighter = myRole === 'p1' ? fighterP1 : fighterP2;
    const isSprintActive = (keys.shift || sprintToggleTimer > 0) && !myFighter.isRagdoll && !myFighter.isFallingOff;
    myFighter.isSprinting = isSprintActive;

    const speed = isSprintActive ? 8.8 : 4.8;

    // 1. TỔNG HỢP INPUT DI CHUYỂN TỪ BÀN PHÍM & JOYSTICK ẢO
    let mx = 0, mz = 0;
    if (keys.w) mz -= 1;
    if (keys.s) mz += 1;
    if (keys.a) mx -= 1;
    if (keys.d) mx += 1;

    if (Math.abs(joystickInput.x) > 0.05 || Math.abs(joystickInput.z) > 0.05) {
      mx = joystickInput.x;
      mz = joystickInput.z;
    }

    const myMoveInput = { x: 0, z: 0 };
    const len = Math.hypot(mx, mz);
    if (len > 0.05) {
      const norm = Math.min(len, 1.0);
      myMoveInput.x = (mx / len) * norm * speed;
      myMoveInput.z = (mz / len) * norm * speed;
    }

    if (!myFighter.isRagdoll && !myFighter.isFallingOff && !isRoundEnding) {
      myFighter.root.position.x += myMoveInput.x * dt;
      myFighter.root.position.z += myMoveInput.z * dt;

      // Hiệu ứng khói bụi và vệt tốc độ khi đang Chạy Nhanh!
      if (isSprintActive && len > 0.05) {
        sprintTrailTimer -= dt;
        if (sprintTrailTimer <= 0) {
          sprintTrailTimer = 0.05;
          particles.createSprintTrail(myFighter.root.position.x, myFighter.root.position.z, myFighter.root.rotation.y);
        }
      }

      if (len <= 0.05 && !myFighter.isPunching) {
        const opp = myRole === 'p1' ? fighterP2 : fighterP1;
        const dx = opp.root.position.x - myFighter.root.position.x;
        const dz = opp.root.position.z - myFighter.root.position.z;
        if (Math.hypot(dx, dz) < 3.8) {
          const targetRot = Math.atan2(dx, dz);
          let diff = targetRot - myFighter.root.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          myFighter.root.rotation.y += diff * Math.min(dt * 8, 1.0);
        }
      }
    }

    // LUÔN UPDATE CẢ 2 VÕ SĨ MỖI FRAME
    if (gameMode === 'AI') {
      fighterP1.update(dt, myMoveInput);
      const botInput = updateBotAI(dt);
      if (fighterP2.isSprinting && !fighterP2.isRagdoll) {
        if (Math.random() < 0.25) particles.createSprintTrail(fighterP2.root.position.x, fighterP2.root.position.z, fighterP2.root.rotation.y);
      }
      fighterP2.update(dt, botInput);
    } else if (gameMode === 'ONLINE') {
      myFighter.update(dt, myMoveInput);

      const opp = myRole === 'p1' ? fighterP2 : fighterP1;
      let remoteMoveVec = { x: 0, z: 0 };
      if (oppTargetState.hasTarget) {
        const dx = oppTargetState.x - opp.root.position.x;
        const dy = oppTargetState.y - opp.root.position.y;
        const dz = oppTargetState.z - opp.root.position.z;
        const lerpAmt = Math.min(dt * 18, 1.0);

        opp.root.position.x += dx * lerpAmt;
        opp.root.position.y += dy * lerpAmt;
        opp.root.position.z += dz * lerpAmt;

        let rotDiff = oppTargetState.rotY - opp.root.rotation.y;
        while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
        while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
        opp.root.rotation.y += rotDiff * lerpAmt;

        if (!oppTargetState.isRagdoll && !oppTargetState.isFallingOff && Math.hypot(dx, dz) > 0.02) {
          remoteMoveVec = { x: dx / Math.max(dt, 0.016), z: dz / Math.max(dt, 0.016) };
        }
        opp.isRagdoll = oppTargetState.isRagdoll;
        opp.isSprinting = oppTargetState.isSprinting;
        opp.isFallingOff = oppTargetState.isFallingOff;
      }
      if (opp.isSprinting && !opp.isRagdoll && Math.random() < 0.25) {
        particles.createSprintTrail(opp.root.position.x, opp.root.position.z, opp.root.rotation.y);
      }
      opp.update(dt, remoteMoveVec);

      ragdollMP.sendState({
        x: myFighter.root.position.x,
        y: myFighter.root.position.y,
        z: myFighter.root.position.z,
        rotY: myFighter.root.rotation.y,
        isPunching: myFighter.isPunching,
        isRagdoll: myFighter.isRagdoll,
        isSprinting: myFighter.isSprinting,
        isFallingOff: myFighter.isFallingOff
      });
    }

    checkCombat(dt);
  }

  // Camera Shake & LookAt
  if (screenShake > 0) {
    camera.position.x = currentCamPos.x + (Math.random() - 0.5) * screenShake;
    camera.position.y = currentCamPos.y + (Math.random() - 0.5) * screenShake;
    camera.position.z = currentCamPos.z;
    screenShake = Math.max(0, screenShake - dt * 1.5);
  } else {
    camera.position.copy(currentCamPos);
  }
  camera.lookAt(currentCamLookAt);

  particles.update(dt);
  renderer.render(scene, camera);
}
animate();
