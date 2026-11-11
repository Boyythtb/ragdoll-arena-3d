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
        life: 0.35 + Math.random() * 0.15
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
        p.vy -= 14 * dt;
        p.mesh.scale.setScalar(p.life * 2.8);
      }
    }
  }
}
