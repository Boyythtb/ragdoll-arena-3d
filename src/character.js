import * as THREE from 'three';

export class RagdollCharacter {
  constructor(scene, colorHex = 0x0284c7, isPlayer = true) {
    this.scene = scene;
    this.colorHex = colorHex;
    this.isPlayer = isPlayer;

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.isPunching = false;
    this.punchTime = 0;
    this.isRagdoll = false;
    this.ragdollTimer = 0;

    // Vận tốc & trạng thái
    this.velocity = new THREE.Vector3();
    this.walkCycle = 0;

    this.buildMeshes();
  }

  buildMeshes() {
    const mat = new THREE.MeshStandardMaterial({
      color: this.colorHex,
      roughness: 0.3,
      metalness: 0.1
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xfde047, // Da mặt vàng hoạt hình đáng yêu
      roughness: 0.4
    });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x1e1b4b });

    // 1. Thân người tròn múp múp
    const torsoGeo = new THREE.CapsuleGeometry(0.55, 0.65, 8, 16);
    this.torso = new THREE.Mesh(torsoGeo, mat);
    this.torso.position.y = 1.25;
    this.torso.castShadow = true;
    this.root.add(this.torso);

    // 2. Đầu to tròn (Chibi Mascot)
    const headGeo = new THREE.SphereGeometry(0.5, 24, 24);
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.head.position.y = 0.95;
    this.head.castShadow = true;
    this.torso.add(this.head);

    // Băng đô thể thao trên đầu
    const bandGeo = new THREE.CylinderGeometry(0.51, 0.51, 0.16, 24);
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.y = 0.15;
    this.head.add(band);

    // Mắt to tròn biểu cảm
    for (const side of [-1, 1]) {
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), whiteMat);
      eyeWhite.position.set(side * 0.18, 0.05, 0.42);
      this.head.add(eyeWhite);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), blackMat);
      pupil.position.set(side * 0.19, 0.05, 0.50);
      this.head.add(pupil);
    }

    // 3. Hai tay đấm cao su uốn dẻo
    this.leftArm = this.createArm(mat, -1);
    this.rightArm = this.createArm(mat, 1);
    this.torso.add(this.leftArm);
    this.torso.add(this.rightArm);

    // 4. Hai chân lon ton
    this.leftLeg = this.createLeg(mat, -1);
    this.rightLeg = this.createLeg(mat, 1);
    this.root.add(this.leftLeg);
    this.root.add(this.rightLeg);
  }

  createArm(mat, side) {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.68, 0.35, 0);

    // Bắp tay
    const upperGeo = new THREE.CapsuleGeometry(0.16, 0.4, 6, 12);
    const upper = new THREE.Mesh(upperGeo, mat);
    upper.position.y = -0.25;
    upper.castShadow = true;
    armPivot.add(upper);

    // Găng tay đấm boxing to tròn
    const gloveGeo = new THREE.SphereGeometry(0.26, 16, 16);
    const gloveMat = new THREE.MeshStandardMaterial({
      color: side === 1 ? 0xf43f5e : 0xfb7185,
      roughness: 0.2
    });
    const glove = new THREE.Mesh(gloveGeo, gloveMat);
    glove.position.y = -0.58;
    glove.castShadow = true;
    armPivot.add(glove);

    return armPivot;
  }

  createLeg(mat, side) {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.32, 0.75, 0);

    const legGeo = new THREE.CapsuleGeometry(0.18, 0.45, 6, 12);
    const leg = new THREE.Mesh(legGeo, mat);
    leg.position.y = -0.25;
    leg.castShadow = true;
    legPivot.add(leg);

    // Giày thể thao trắng
    const shoeGeo = new THREE.BoxGeometry(0.26, 0.16, 0.38);
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const shoe = new THREE.Mesh(shoeGeo, shoeMat);
    shoe.position.set(0, -0.52, 0.08);
    legPivot.add(shoe);

    return legPivot;
  }

  // KÍCH HOẠT CÚ ĐẤM SMASH
  punch() {
    if (this.isPunching || this.isRagdoll) return;
    this.isPunching = true;
    this.punchTime = 0;
  }

  // BỊ ĐÁNH TRÚNG / Té NGÃ RAGDOLL UỐN DẺO
  takeHit(impactVec) {
    this.isRagdoll = true;
    this.ragdollTimer = 1.4; // 1.4 giây uốn éo trước khi đứng dậy
    this.velocity.copy(impactVec);
  }

  update(dt, moveInput = { x: 0, z: 0 }) {
    if (this.isRagdoll) {
      // Hiệu ứng té ngã uốn dẻo vui nhộn (Ragdoll Flop)
      this.ragdollTimer -= dt;
      this.root.position.addScaledVector(this.velocity, dt);
      this.velocity.multiplyScalar(0.92); // Ma sát không khí
      this.velocity.y -= 18 * dt; // Trọng lực rơi

      if (this.root.position.y < 0.3) {
        this.root.position.y = 0.3;
        this.velocity.y = -this.velocity.y * 0.4; // Nảy sàn
      }

      // Xoay uốn éo thân mình tưng tưng
      this.torso.rotation.x = Math.sin(this.ragdollTimer * 12) * 1.2;
      this.torso.rotation.z = Math.cos(this.ragdollTimer * 10) * 0.8;
      this.head.rotation.z = Math.sin(this.ragdollTimer * 16) * 0.6;

      if (this.ragdollTimer <= 0) {
        this.isRagdoll = false;
        this.torso.rotation.set(0, 0, 0);
        this.head.rotation.set(0, 0, 0);
      }
      return;
    }

    // DI CHUYỂN BÌNH THƯỜNG
    const isMoving = Math.abs(moveInput.x) > 0.05 || Math.abs(moveInput.z) > 0.05;
    if (isMoving) {
      this.walkCycle += dt * 14;
      const angle = Math.atan2(moveInput.x, moveInput.z);
      this.root.rotation.y = angle;

      // Nhấp nhô bước chạy hoạt hình
      this.torso.position.y = 1.25 + Math.sin(this.walkCycle * 2) * 0.08;
      this.leftLeg.rotation.x = Math.sin(this.walkCycle) * 0.6;
      this.rightLeg.rotation.x = -Math.sin(this.walkCycle) * 0.6;

      if (!this.isPunching) {
        this.leftArm.rotation.x = -Math.sin(this.walkCycle) * 0.5;
        this.rightArm.rotation.x = Math.sin(this.walkCycle) * 0.5;
      }
    } else {
      // Thở nhịp nhàng khi đứng yên
      this.walkCycle += dt * 3;
      this.torso.position.y = 1.25 + Math.sin(this.walkCycle) * 0.03;
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      if (!this.isPunching) {
        this.leftArm.rotation.x = 0.15;
        this.rightArm.rotation.x = 0.15;
      }
    }

    // ANIMATION TUNG CÚ ĐẤM
    if (this.isPunching) {
      this.punchTime += dt;
      const progress = this.punchTime / 0.28; // Cú đấm diễn ra trong 0.28s

      if (progress < 0.5) {
        // Vung tay phải ra trước cực mạnh
        this.rightArm.rotation.x = -Math.PI / 2 + Math.sin(progress * Math.PI) * 0.6;
        this.rightArm.position.z = Math.sin(progress * Math.PI) * 0.4;
      } else if (progress <= 1.0) {
        // Thu tay về
        this.rightArm.rotation.x = THREE.MathUtils.lerp(-Math.PI / 2, 0.15, (progress - 0.5) * 2);
        this.rightArm.position.z = THREE.MathUtils.lerp(0.4, 0, (progress - 0.5) * 2);
      } else {
        this.isPunching = false;
        this.rightArm.position.z = 0;
      }
    }
  }

  // Tọa độ bao găng tay phải khi đấm để kiểm tra va chạm
  getPunchHitbox() {
    const worldPos = new THREE.Vector3();
    this.rightArm.getWorldPosition(worldPos);
    // Hướng nhìn nhân vật
    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.root.rotation.y);
    return worldPos.add(forward.multiplyScalar(0.75));
  }
}
