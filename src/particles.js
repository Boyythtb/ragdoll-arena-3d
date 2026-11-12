import * as THREE from 'three';

export class ParticleFX {
  constructor(scene) {
    this.scene = scene;
    this.activeParticles = [];

    // TỐI ƯU HÓA BỘ NHỚ: OBJECT POOLING CHUYÊN DỤNG (KHÔNG CẤP PHÁT MỚI TRONG VÒNG LẶP RENDER)
    this.starPool = [];
    this.puffPool = [];
    this.streakPool = [];

    // Shared Geometries & Materials (Dùng chung cho toàn bộ Particle)
    const starGeo = new THREE.SphereGeometry(0.13, 5, 5);
    const starMats = [
      new THREE.MeshBasicMaterial({ color: 0xfde047 }),
      new THREE.MeshBasicMaterial({ color: 0xf43f5e }),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    ];

    for (let i = 0; i < 40; i++) {
      const mat = starMats[i % starMats.length];
      const mesh = new THREE.Mesh(starGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.starPool.push({
        mesh,
        active: false,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 0.5, gravity: 14
      });
    }

    const puffGeo = new THREE.SphereGeometry(0.22, 6, 6);
    const puffMats = [
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.85 })
    ];

    for (let i = 0; i < 45; i++) {
      const mat = puffMats[i % puffMats.length].clone();
      const mesh = new THREE.Mesh(puffGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.puffPool.push({
        mesh,
        active: false,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 0.35, gravity: -1.5,
        baseScale: 1.0
      });
    }

    const streakGeo = new THREE.BoxGeometry(0.06, 0.06, 0.55);
    const streakMats = [
      new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.9 }),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 })
    ];

    for (let i = 0; i < 25; i++) {
      const mat = streakMats[i % streakMats.length].clone();
      const mesh = new THREE.Mesh(streakGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.streakPool.push({
        mesh,
        active: false,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 0.22, gravity: 0
      });
    }
  }

  // Bắn tia sao hoạt hình khi đấm trúng (Comic hit stars - Lấy từ Pool)
  createPunchStars(x, y, z, count = 12) {
    let spawned = 0;
    for (let i = 0; i < this.starPool.length && spawned < count; i++) {
      const p = this.starPool[i];
      if (!p.active) {
        p.active = true;
        p.mesh.visible = true;
        p.mesh.position.set(x, y, z);
        p.mesh.scale.setScalar(1.0);

        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 6;
        p.vx = Math.cos(angle) * speed;
        p.vz = Math.sin(angle) * speed;
        p.vy = 2 + Math.random() * 4;
        p.life = 0.35 + Math.random() * 0.15;
        p.maxLife = p.life;
        p.gravity = 14;

        this.activeParticles.push(p);
        spawned++;
      }
    }
  }

  // Khói bụi và vệt tốc độ Chạy Nhanh (Turbo Sprint Trail - Lấy từ Pool)
  createSprintTrail(x, z, rotY) {
    const backX = -Math.sin(rotY);
    const backZ = -Math.cos(rotY);

    // 1. Cụm khói bụi bồng bềnh dưới chân
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < this.puffPool.length; i++) {
        const p = this.puffPool[i];
        if (!p.active) {
          p.active = true;
          p.mesh.visible = true;
          p.mesh.position.set(
            x + backX * 0.4 + (Math.random() - 0.5) * 0.5,
            0.18 + Math.random() * 0.25,
            z + backZ * 0.4 + (Math.random() - 0.5) * 0.5
          );
          p.baseScale = 0.8 + Math.random() * 0.5;
          p.mesh.scale.setScalar(p.baseScale);
          p.mesh.material.opacity = 0.85;

          p.vx = backX * (1.5 + Math.random() * 2) + (Math.random() - 0.5) * 1.2;
          p.vz = backZ * (1.5 + Math.random() * 2) + (Math.random() - 0.5) * 1.2;
          p.vy = 1.2 + Math.random() * 1.5;
          p.life = 0.32;
          p.maxLife = 0.32;
          p.gravity = -1.5;

          this.activeParticles.push(p);
          break;
        }
      }
    }

    // 2. Vệt tốc độ vàng / xanh lướt theo sau
    if (Math.random() < 0.7) {
      for (let i = 0; i < this.streakPool.length; i++) {
        const p = this.streakPool[i];
        if (!p.active) {
          p.active = true;
          p.mesh.visible = true;
          p.mesh.position.set(
            x + backX * 0.5 + (Math.random() - 0.5) * 0.8,
            0.6 + Math.random() * 1.0,
            z + backZ * 0.5 + (Math.random() - 0.5) * 0.8
          );
          p.mesh.rotation.y = rotY;
          p.mesh.scale.setScalar(1.0);
          p.mesh.material.opacity = 0.9;

          p.vx = backX * 5.0;
          p.vz = backZ * 5.0;
          p.vy = 0;
          p.life = 0.22;
          p.maxLife = 0.22;
          p.gravity = 0;

          this.activeParticles.push(p);
          break;
        }
      }
    }
  }

  update(dt) {
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        this.activeParticles.splice(i, 1);
      } else {
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.z += p.vz * dt;
        p.mesh.position.y += p.vy * dt;
        p.vy -= p.gravity * dt;

        const ratio = Math.max(0.01, p.life / p.maxLife);
        const scale = (p.baseScale || 1.0) * ratio;
        p.mesh.scale.setScalar(scale);

        if (p.mesh.material.transparent) {
          p.mesh.material.opacity = ratio * 0.85;
        }
      }
    }
  }
}
