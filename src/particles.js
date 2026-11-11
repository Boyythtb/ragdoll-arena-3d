import * as THREE from 'three';

export class ParticleFX {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
  }

  // Bắn tia sao hoạt hình khi đấm trúng (Comic hit stars)
  createPunchStars(x, y, z, count = 12) {
    const colors = [0xfde047, 0xf43f5e, 0xffffff];
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.12, 6, 6);
      const col = colors[Math.floor(Math.random() * colors.length)];
      const mat = new THREE.MeshBasicMaterial({ color: col });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 6;
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vz: Math.sin(angle) * speed,
        vy: 2 + Math.random() * 4,
        life: 0.35 + Math.random() * 0.15,
        maxLife: 0.5,
        gravity: 14
      });
    }
  }

  // Hiệu ứng khói bụi và tia tốc độ khi Chạy Nhanh (Turbo Sprint Trail)
  createSprintTrail(x, z, rotY) {
    const backX = -Math.sin(rotY);
    const backZ = -Math.cos(rotY);

    // 1. Cụm khói bụi trắng bồng bềnh dưới chân
    for (let i = 0; i < 2; i++) {
      const puffGeo = new THREE.SphereGeometry(0.18 + Math.random() * 0.1, 8, 8);
      const puffMat = new THREE.MeshBasicMaterial({
        color: i === 0 ? 0xffffff : 0xfef08a,
        transparent: true,
        opacity: 0.85
      });
      const puff = new THREE.Mesh(puffGeo, puffMat);
      puff.position.set(
        x + backX * 0.4 + (Math.random() - 0.5) * 0.5,
        0.18 + Math.random() * 0.25,
        z + backZ * 0.4 + (Math.random() - 0.5) * 0.5
      );
      this.scene.add(puff);

      this.particles.push({
        mesh: puff,
        vx: backX * (1.5 + Math.random() * 2) + (Math.random() - 0.5) * 1.2,
        vz: backZ * (1.5 + Math.random() * 2) + (Math.random() - 0.5) * 1.2,
        vy: 1.2 + Math.random() * 1.5,
        life: 0.32,
        maxLife: 0.32,
        gravity: -1.5 // Khói bay nhẹ lên trên
      });
    }

    // 2. Tia chớp tốc độ vàng / xanh lướt theo sau
    if (Math.random() < 0.7) {
      const streakGeo = new THREE.BoxGeometry(0.06, 0.06, 0.55);
      const streakMat = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.5 ? 0xfbbf24 : 0x38bdf8,
        transparent: true,
        opacity: 0.9
      });
      const streak = new THREE.Mesh(streakGeo, streakMat);
      streak.position.set(
        x + backX * 0.5 + (Math.random() - 0.5) * 0.9,
        0.6 + Math.random() * 1.2,
        z + backZ * 0.5 + (Math.random() - 0.5) * 0.9
      );
      streak.rotation.y = rotY;
      this.scene.add(streak);

      this.particles.push({
        mesh: streak,
        vx: backX * 5.0,
        vz: backZ * 5.0,
        vy: 0,
        life: 0.22,
        maxLife: 0.22,
        gravity: 0
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      } else {
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.z += p.vz * dt;
        p.mesh.position.y += p.vy * dt;
        p.vy -= (p.gravity !== undefined ? p.gravity : 14) * dt;
        const ratio = Math.max(0.01, p.life / (p.maxLife || 0.4));
        p.mesh.scale.setScalar(ratio);
        if (p.mesh.material.transparent) {
          p.mesh.material.opacity = ratio * 0.85;
        }
      }
    }
  }
}
