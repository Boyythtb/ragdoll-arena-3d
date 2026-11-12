import * as THREE from 'three';

// 1. TẠO MODEL VỎ CHUỐI HOẠT HÌNH 3D (LOW-POLY CUTE)
function createBananaMesh() {
  const group = new THREE.Group();
  const bananaMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15, // Vàng chuối rực rỡ
    roughness: 0.35,
    metalness: 0.05
  });
  const tipMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.5 }); // Cuống xanh

  // 3 cánh vỏ chuối xòe cong trên sàn
  for (let i = 0; i < 3; i++) {
    const peelGeo = new THREE.BoxGeometry(0.12, 0.05, 0.42);
    const peel = new THREE.Mesh(peelGeo, bananaMat);
    const angle = (i * Math.PI * 2) / 3;
    peel.position.set(Math.cos(angle) * 0.16, 0.03, Math.sin(angle) * 0.16);
    peel.rotation.y = angle;
    peel.rotation.x = 0.25;
    peel.castShadow = true;
    group.add(peel);
  }

  // Cuống chuối nhỏ nhô lên
  const stemGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.15, 6);
  const stem = new THREE.Mesh(stemGeo, tipMat);
  stem.position.y = 0.12;
  group.add(stem);

  return group;
}

// 2. TẠO TIA SÉT 3D ZIGZAG (LOW-POLY LIGHTNING BOLT)
function createLightningMesh() {
  const group = new THREE.Group();
  const boltMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.95
  });

  // Khúc tia sét zigzag từ trên trời xuống
  const points = [
    new THREE.Vector3(0, 24, 0),
    new THREE.Vector3(0.5, 18, 0.2),
    new THREE.Vector3(-0.6, 12, -0.3),
    new THREE.Vector3(0.7, 6, 0.4),
    new THREE.Vector3(0, 0, 0)
  ];

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dist = p1.distanceTo(p2);
    const segGeo = new THREE.CylinderGeometry(0.18, 0.14, dist, 6);
    const seg = new THREE.Mesh(segGeo, boltMat);

    seg.position.lerpVectors(p1, p2, 0.5);
    seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
    group.add(seg);
  }

  group.visible = false;
  return group;
}

// 3. QUẢN LÝ TỔNG HỢP CÁC YẾU TỐ HỖN LOẠN (HAZARDS MANAGER)
export class HazardsManager {
  constructor(scene, sounds, particles) {
    this.scene = scene;
    this.sounds = sounds;
    this.particles = particles;

    // --- VỎ CHUỐI (BANANAS) ---
    this.bananas = [];
    for (let i = 0; i < 2; i++) {
      const mesh = createBananaMesh();
      mesh.visible = false;
      this.scene.add(mesh);
      this.bananas.push({
        mesh,
        active: false,
        x: 0,
        z: 0,
        spawnCooldown: 3 + i * 5
      });
    }

    // --- SÉT ĐÁNH (LIGHTNING) ---
    this.lightningTimer = 14.0; // Cứ ~16s xuất hiện một lần
    this.lightningWarningDuration = 1.5;
    this.lightningState = 'IDLE'; // 'IDLE', 'WARNING', 'STRIKING'
    this.lightningX = 0;
    this.lightningZ = 0;
    this.lightningStrikeTimer = 0;

    // Vòng tròn đỏ cảnh báo nguy hiểm
    const circleGeo = new THREE.RingGeometry(0.1, 2.3, 32);
    circleGeo.rotateX(-Math.PI / 2);
    this.warningCircle = new THREE.Mesh(
      circleGeo,
      new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide
      })
    );
    this.warningCircle.position.y = 0.03;
    this.warningCircle.visible = false;
    this.scene.add(this.warningCircle);

    // Tia sét 3D
    this.lightningMesh = createLightningMesh();
    this.scene.add(this.lightningMesh);

    // --- CƠN GIÓ VÕ ĐÀI (WIND GUST) ---
    this.windTimer = 18.0;
    this.windDuration = 0;
    this.windForce = { x: 0, z: 0 };
    this.isWindActive = false;
    this.onWindCallback = null;
    this.onLightningCallback = null;
  }

  spawnBanana(b) {
    // Spawn ngẫu nhiên trong sàn đấu (-4.2m đến 4.2m)
    b.x = (Math.random() - 0.5) * 8.4;
    b.z = (Math.random() - 0.5) * 8.4;
    b.mesh.position.set(b.x, 0.02, b.z);
    b.mesh.rotation.y = Math.random() * Math.PI * 2;
    b.mesh.visible = true;
    b.active = true;
  }

  reset() {
    this.bananas.forEach(b => {
      b.active = false;
      b.mesh.visible = false;
      b.spawnCooldown = 3 + Math.random() * 5;
    });
    this.lightningState = 'IDLE';
    this.warningCircle.visible = false;
    this.lightningMesh.visible = false;
    this.lightningTimer = 14.0;
    this.windTimer = 18.0;
    this.windDuration = 0;
    this.isWindActive = false;
  }

  update(dt, fighters) {
    // 1. UPDATE VỎ CHUỐI
    for (const b of this.bananas) {
      if (!b.active) {
        b.spawnCooldown -= dt;
        if (b.spawnCooldown <= 0) {
          this.spawnBanana(b);
        }
      } else {
        // Kiểm tra va chạm với các võ sĩ
        for (const f of fighters) {
          if (!f.isRagdoll && !f.isFallingOff && !f.isBeingHeld) {
            const dist = Math.hypot(f.root.position.x - b.x, f.root.position.z - b.z);
            if (dist < 0.72) {
              // GIẪM TRÚNG VỎ CHUỐI!
              b.active = false;
              b.mesh.visible = false;
              b.spawnCooldown = 12 + Math.random() * 6;

              this.sounds.playSlip();
              this.particles.createPunchStars(b.x, 0.8, b.z, 16);

              // Lực trượt té lộn nhào theo hướng di chuyển hiện tại
              const dirX = Math.sin(f.root.rotation.y) || (Math.random() - 0.5);
              const dirZ = Math.cos(f.root.rotation.y) || (Math.random() - 0.5);
              f.slipOnBanana({ x: dirX, z: dirZ });
              break;
            }
          }
        }
      }
    }

    // 2. UPDATE SÉT ĐÁNH (LIGHTNING)
    if (this.lightningState === 'IDLE') {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        // Chọn ngẫu nhiên vị trí quanh sàn đài (hoặc gần vị trí 1 người chơi cho kịch tính)
        this.lightningState = 'WARNING';
        this.lightningStrikeTimer = this.lightningWarningDuration;
        const targetFighter = fighters[Math.floor(Math.random() * fighters.length)];
        this.lightningX = Math.max(-4.5, Math.min(4.5, targetFighter.root.position.x + (Math.random() - 0.5) * 2.5));
        this.lightningZ = Math.max(-4.5, Math.min(4.5, targetFighter.root.position.z + (Math.random() - 0.5) * 2.5));

        this.warningCircle.position.set(this.lightningX, 0.03, this.lightningZ);
        this.warningCircle.visible = true;
        this.warningCircle.scale.setScalar(0.5);
        this.sounds.playThunderWarning();

        if (this.onLightningCallback) this.onLightningCallback('warning', { x: this.lightningX, z: this.lightningZ });
      }
    } else if (this.lightningState === 'WARNING') {
      this.lightningStrikeTimer -= dt;
      const progress = 1 - (this.lightningStrikeTimer / this.lightningWarningDuration);
      this.warningCircle.scale.setScalar(0.5 + progress * 0.5);
      // Nhấp nháy màu đỏ tăng dần
      this.warningCircle.material.opacity = 0.4 + Math.sin(progress * 25) * 0.35;

      if (this.lightningStrikeTimer <= 0) {
        // GIÁNG SÉT XUỐNG!
        this.lightningState = 'STRIKING';
        this.lightningStrikeTimer = 0.22;
        this.warningCircle.visible = false;

        this.lightningMesh.position.set(this.lightningX, 0, this.lightningZ);
        this.lightningMesh.visible = true;
        this.sounds.playLightning();
        this.particles.createPunchStars(this.lightningX, 1.2, this.lightningZ, 28);

        // Kiểm tra ai đứng trong vùng bán kính 2.3m
        for (const f of fighters) {
          if (!f.isFallingOff) {
            const dist = Math.hypot(f.root.position.x - this.lightningX, f.root.position.z - this.lightningZ);
            if (dist < 2.3) {
              const nx = dist > 0.05 ? (f.root.position.x - this.lightningX) / dist : (Math.random() - 0.5);
              const nz = dist > 0.05 ? (f.root.position.z - this.lightningZ) / dist : (Math.random() - 0.5);
              f.getZappedByLightning(nx, nz);
            }
          }
        }

        if (this.onLightningCallback) this.onLightningCallback('strike', { x: this.lightningX, z: this.lightningZ });
      }
    } else if (this.lightningState === 'STRIKING') {
      this.lightningStrikeTimer -= dt;
      if (this.lightningStrikeTimer <= 0) {
        this.lightningMesh.visible = false;
        this.lightningState = 'IDLE';
        this.lightningTimer = 13 + Math.random() * 8; // Đặt hẹn giờ cho lần sau
      }
    }

    // 3. UPDATE CƠN GIÓ VÕ ĐÀI (WIND GUST)
    this.windTimer -= dt;
    if (this.windTimer <= 0 && !this.isWindActive) {
      this.isWindActive = true;
      this.windDuration = 4.5;
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.6;
      this.windForce = { x: Math.cos(angle) * speed, z: Math.sin(angle) * speed };
      this.sounds.playWind();
      if (this.onWindCallback) this.onWindCallback('start', this.windForce);
    }

    if (this.isWindActive) {
      this.windDuration -= dt;
      // Thổi nhẹ các võ sĩ theo hướng gió
      for (const f of fighters) {
        if (!f.isFallingOff) {
          f.root.position.x += this.windForce.x * dt * 0.75;
          f.root.position.z += this.windForce.z * dt * 0.75;
        }
      }

      if (this.windDuration <= 0) {
        this.isWindActive = false;
        this.windTimer = 16 + Math.random() * 10;
        if (this.onWindCallback) this.onWindCallback('end', null);
      }
    }
  }
}
