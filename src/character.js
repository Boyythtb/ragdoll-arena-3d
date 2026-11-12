import * as THREE from 'three';

export class RagdollCharacter {
  constructor(scene, colorHex = 0x0284c7, isPlayer = true) {
    this.scene = scene;
    this.colorHex = colorHex;
    this.isPlayer = isPlayer;

    this.root = new THREE.Group();
    this.scene.add(this.root);

    // Trạng thái đấm, chạy nhanh & uốn dẻo
    this.isPunching = false;
    this.isSprinting = false;
    this.punchTime = 0;
    this.punchCooldown = 0;
    this.isRagdoll = false;
    this.ragdollTimer = 0;
    this.isFallingOff = false; // Khi rơi khỏi sàn xuống đất

    // TÍNH NĂNG MỚI: TÚM / VÁC & NÉM ĐỐI THỦ
    this.isHoldingEnemy = false;
    this.grabbedEnemy = null;
    this.isBeingHeld = false;
    this.heldBy = null;
    this.struggleCount = 0; // Đếm số lần spam nút đánh để thoát

    // BỊ SÉT ĐÁNH (ZAPPED)
    this.isZapped = false;
    this.zappedTimer = 0;

    // Vận tốc 3D & gia tốc
    this.velocity = new THREE.Vector3();
    this.angularVelocity = new THREE.Vector3();
    this.walkCycle = 0;
    this.wobblePhase = Math.random() * Math.PI * 2;
    this.tiltX = 0;
    this.tiltZ = 0;

    // Scale bóp méo hoạt hình (Squash & Stretch)
    this.squashY = 1.0;
    this.squashXZ = 1.0;

    this.buildMeshes();
  }

  buildMeshes() {
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: this.colorHex,
      roughness: 0.28,
      metalness: 0.08
    });
    const mat = this.bodyMat;
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xfde047, // Da mặt vàng hoạt hình đáng yêu
      roughness: 0.4
    });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x1e1b4b });

    // Cụm thân người (Torso Group để uốn lượn uốn dẻo)
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.y = 1.25;
    this.root.add(this.torsoGroup);

    // 1. Thân người tròn múp múp
    const torsoGeo = new THREE.CapsuleGeometry(0.56, 0.68, 8, 16);
    this.torso = new THREE.Mesh(torsoGeo, mat);
    this.torso.castShadow = true;
    this.torsoGroup.add(this.torso);

    // 2. Đầu to tròn (Bobblehead Mascot)
    this.headPivot = new THREE.Group();
    this.headPivot.position.y = 0.96;
    this.torsoGroup.add(this.headPivot);

    const headGeo = new THREE.SphereGeometry(0.52, 24, 24);
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.head.castShadow = true;
    this.headPivot.add(this.head);

    // Băng đô thể thao trên đầu
    const bandGeo = new THREE.CylinderGeometry(0.53, 0.53, 0.16, 24);
    const bandMat = new THREE.MeshStandardMaterial({
      color: this.isPlayer ? 0xf43f5e : 0x0284c7,
      roughness: 0.3
    });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.y = 0.16;
    this.head.add(band);

    // Mắt to tròn hoạt hình ngộ nghĩnh
    this.eyes = [];
    for (const side of [-1, 1]) {
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 14), whiteMat);
      eyeWhite.position.set(side * 0.19, 0.06, 0.43);
      this.head.add(eyeWhite);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), blackMat);
      pupil.position.set(side * 0.20, 0.06, 0.52);
      this.head.add(pupil);
      this.eyes.push({ eyeWhite, pupil });
    }

    // Má hồng kute
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.65 });
    for (const side of [-1, 1]) {
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), blushMat);
      blush.position.set(side * 0.31, -0.08, 0.42);
      blush.rotation.y = side * 0.45;
      this.head.add(blush);
    }

    // 3. Hai tay đấm uốn dẻo lò xo (Rubber Hose Arms)
    this.leftArmPivot = this.createArm(mat, -1);
    this.rightArmPivot = this.createArm(mat, 1);
    this.torsoGroup.add(this.leftArmPivot);
    this.torsoGroup.add(this.rightArmPivot);

    // 4. Hai chân lon ton
    this.leftLegPivot = this.createLeg(mat, -1);
    this.rightLegPivot = this.createLeg(mat, 1);
    this.root.add(this.leftLegPivot);
    this.root.add(this.rightLegPivot);
  }

  createArm(mat, side) {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.70, 0.32, 0);

    // Bắp tay cao su
    const upperGeo = new THREE.CapsuleGeometry(0.16, 0.42, 6, 12);
    const upper = new THREE.Mesh(upperGeo, mat);
    upper.position.y = -0.25;
    upper.castShadow = true;
    armPivot.add(upper);

    // Khối găng tay boxing to tròn nổi bật
    const gloveGeo = new THREE.SphereGeometry(0.28, 16, 16);
    const gloveMat = new THREE.MeshStandardMaterial({
      color: side === 1 ? 0xf43f5e : 0xfb7185,
      roughness: 0.25
    });
    const glove = new THREE.Mesh(gloveGeo, gloveMat);
    glove.position.y = -0.60;
    glove.castShadow = true;
    armPivot.add(glove);

    if (side === 1) {
      this.rightGlove = glove;
    } else {
      this.leftGlove = glove;
    }

    return armPivot;
  }

  createLeg(mat, side) {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.34, 0.72, 0);

    const legGeo = new THREE.CapsuleGeometry(0.18, 0.42, 6, 12);
    const leg = new THREE.Mesh(legGeo, mat);
    leg.position.y = -0.24;
    leg.castShadow = true;
    legPivot.add(leg);

    // Giày thể thao trắng đế bánh mì
    const shoeGeo = new THREE.BoxGeometry(0.28, 0.18, 0.42);
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const shoe = new THREE.Mesh(shoeGeo, shoeMat);
    shoe.position.set(0, -0.52, 0.09);
    shoe.castShadow = true;
    legPivot.add(shoe);

    return legPivot;
  }

  setColor(hex) {
    this.colorHex = hex;
    if (this.bodyMat) {
      this.bodyMat.color.setHex(hex);
    }
  }

  // TUNG CÚ ĐẤM SMASH LAO NGƯỜI
  punch() {
    if (this.isPunching || this.isRagdoll || this.isFallingOff || this.punchCooldown > 0) return;
    this.isPunching = true;
    this.punchTime = 0;
    this.punchCooldown = 0.28;

    // Lao người về phía trước một lực hoạt hình nhẹ (Punch Lunge)
    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.root.rotation.y);
    this.velocity.addScaledVector(forward, 4.5);
  }

  // NHẬN ĐÒN SMASH -> CHUYỂN TRẠNG THÁI RAGDOLL UỐN DẺO
  takeHit(impactVec) {
    if (this.isBeingHeld && this.heldBy) {
      this.heldBy.isHoldingEnemy = false;
      this.heldBy.grabbedEnemy = null;
      this.isBeingHeld = false;
      this.heldBy = null;
    }
    if (this.isHoldingEnemy && this.grabbedEnemy) {
      this.grabbedEnemy.isBeingHeld = false;
      this.grabbedEnemy.heldBy = null;
      this.isHoldingEnemy = false;
      this.grabbedEnemy = null;
    }

    this.isRagdoll = true;
    this.isPunching = false;
    this.ragdollTimer = 1.3; // 1.3s uốn éo, lăn lộn hài hước
    this.velocity.copy(impactVec);

    // Tạo vận tốc xoay nhào lộn tưng tưng ngẫu nhiên
    this.angularVelocity.set(
      (Math.random() - 0.5) * 16,
      (Math.random() - 0.5) * 18,
      (Math.random() - 0.5) * 16
    );

    // Squash nén dẹp hoạt hình khi bị đấm trúng
    this.squashY = 0.65;
    this.squashXZ = 1.35;
  }

  // 1. TÚM & VÁC ĐỐI THỦ LÊN ĐẦU
  liftAndHold(target) {
    if (this.isHoldingEnemy || this.isBeingHeld || this.isRagdoll || this.isFallingOff) return;
    this.isHoldingEnemy = true;
    this.grabbedEnemy = target;

    target.isBeingHeld = true;
    target.heldBy = this;
    target.struggleCount = 0;
    target.isRagdoll = false;
    target.isFallingOff = false;
    target.velocity.set(0, 0, 0);

    // Giơ 2 cánh tay thẳng lên trời vác đối thủ
    this.leftArmPivot.rotation.x = -Math.PI + 0.25;
    this.rightArmPivot.rotation.x = -Math.PI + 0.25;
  }

  // 2. NÉM ĐỐI THỦ BAY VĂNG ĐI
  throwEnemy() {
    if (!this.isHoldingEnemy || !this.grabbedEnemy) return;
    const target = this.grabbedEnemy;

    this.isHoldingEnemy = false;
    this.grabbedEnemy = null;
    target.isBeingHeld = false;
    target.heldBy = null;
    target.struggleCount = 0;

    // Hướng ném vọt về phía trước mặt
    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.root.rotation.y);
    const throwVec = forward.clone().multiplyScalar(13.5);
    throwVec.y = 5.6;

    target.takeHit(throwVec);

    // Người ném giật lùi nhẹ theo phản lực
    this.velocity.addScaledVector(forward, -2.5);
  }

  // 3. NGƯỜI BỊ VÁC VÙNG VẪY THOÁT RA (STRUGGLE BREAK FREE)
  struggleBreak() {
    if (!this.isBeingHeld || !this.heldBy) return;
    const carrier = this.heldBy;

    this.isBeingHeld = false;
    this.heldBy = null;
    this.struggleCount = 0;
    carrier.isHoldingEnemy = false;
    carrier.grabbedEnemy = null;

    // Thoát xuống đất: Đẩy người vác lùi lại và choáng nhẹ
    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), carrier.root.rotation.y);
    carrier.velocity.addScaledVector(forward, -4.5);
    carrier.takeHit(new THREE.Vector3(-forward.x * 3.5, 2.0, -forward.z * 3.5));

    // Mình tiếp đất an toàn
    this.root.position.y = 0;
    this.velocity.set(forward.x * 2.0, 1.5, forward.z * 2.0);
  }

  // 4. TRƯỢT VỎ CHUỐI
  slipOnBanana(dir) {
    if (this.isHoldingEnemy && this.grabbedEnemy) {
      this.throwEnemy();
    }
    this.isRagdoll = true;
    this.isPunching = false;
    this.ragdollTimer = 1.45;

    // Hai chân hất tung lên trời
    this.leftLegPivot.rotation.x = -2.2;
    this.rightLegPivot.rotation.x = -2.2;

    this.velocity.set(dir.x * 12.0, 4.2, dir.z * 12.0);
    this.angularVelocity.set(12.0, 18.0, 0);

    this.squashY = 0.6;
    this.squashXZ = 1.4;
  }

  // 5. BỊ SÉT ĐÁNH (ZAPPED)
  getZappedByLightning(nx, nz) {
    if (this.isHoldingEnemy && this.grabbedEnemy) {
      this.throwEnemy();
    }
    this.isZapped = true;
    this.zappedTimer = 1.6;
    if (this.bodyMat) {
      this.bodyMat.color.setHex(0x334155); // Đen thui hoạt hình
    }

    this.isRagdoll = true;
    this.ragdollTimer = 1.6;
    // Nổ văng bổng lên trời
    this.velocity.set(nx * 14.0, 8.5, nz * 14.0);
    this.angularVelocity.set((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22);
  }

  update(dt, moveInput = { x: 0, z: 0 }) {
    if (this.punchCooldown > 0) {
      this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    }

    // HỒI PHỤC MÀU DA SAU KHI BỊ SÉT ĐÁNH
    if (this.isZapped) {
      this.zappedTimer -= dt;
      if (this.zappedTimer <= 0) {
        this.isZapped = false;
        this.setColor(this.colorHex);
      }
    }

    // NẾU ĐANG BỊ VÁC TRÊN ĐẦU ĐỐI THỦ
    if (this.isBeingHeld) {
      // Chân tay quẫy đạp bất lực trên không trung
      this.leftLegPivot.rotation.x = Math.sin(Date.now() * 0.012) * 1.2;
      this.rightLegPivot.rotation.x = -Math.sin(Date.now() * 0.012) * 1.2;
      this.leftArmPivot.rotation.z = Math.sin(Date.now() * 0.015) * 1.1;
      this.rightArmPivot.rotation.z = -Math.sin(Date.now() * 0.015) * 1.1;
      return;
    }

    // 1. TRẠNG THÁI RƠI KHỎI VÕ ĐÀI XUỐNG ĐẤT (RING OUT FALL)
    if (this.isFallingOff) {
      this.velocity.y -= 26 * dt; // Trọng lực rơi
      this.root.position.addScaledVector(this.velocity, dt);

      // Nhào lộn xoay tít mù khi rớt đài
      this.torsoGroup.rotation.x += this.angularVelocity.x * dt;
      this.torsoGroup.rotation.y += this.angularVelocity.y * dt;
      this.torsoGroup.rotation.z += this.angularVelocity.z * dt;

      // Chạm sàn gỗ dưới đáy (-2.4m)
      if (this.root.position.y <= -2.4) {
        this.root.position.y = -2.4;
        if (Math.abs(this.velocity.y) > 2) {
          this.velocity.y = -this.velocity.y * 0.35; // Nảy nhẹ trên sàn
        } else {
          this.velocity.set(0, 0, 0);
        }
      }
      return;
    }

    // 2. TRẠNG THÁI RAGDOLL UỐN DẺO (BỊ ĐẤM VĂNG / TÉ NGÃ)
    if (this.isRagdoll) {
      this.ragdollTimer -= dt;
      this.root.position.addScaledVector(this.velocity, dt);

      // Ma sát trượt trên sàn và sức cản không khí
      this.velocity.x *= 0.94;
      this.velocity.z *= 0.94;
      this.velocity.y -= 22 * dt; // Trọng lực

      // Nếu vẫn còn nằm trong phạm vi võ đài (mặt sàn võ đài y = 0, mép dây = 5.85)
      const onRing = Math.abs(this.root.position.x) <= 5.85 && Math.abs(this.root.position.z) <= 5.85;
      if (onRing) {
        if (this.root.position.y < 0) {
          this.root.position.y = 0;
          if (Math.abs(this.velocity.y) > 2.5) {
            this.velocity.y = -this.velocity.y * 0.45; // Nảy tưng tưng trên thảm
            this.squashY = 0.7;
            this.squashXZ = 1.3;
          } else {
            this.velocity.y = 0;
          }
        }
      } else {
        // Đã văng qua dây ra ngoài mép đài -> Rơi tự do xuống vực!
        this.isFallingOff = true;
        return;
      }

      // Xoay nhào lộn tưng tửng của cơ thể uốn dẻo
      this.torsoGroup.rotation.x += this.angularVelocity.x * dt;
      this.torsoGroup.rotation.y += this.angularVelocity.y * dt;
      this.torsoGroup.rotation.z += this.angularVelocity.z * dt;
      this.angularVelocity.multiplyScalar(0.92);

      // Chân tay vung vẩy bất lực
      this.leftArmPivot.rotation.z = Math.sin(this.ragdollTimer * 15) * 1.4;
      this.rightArmPivot.rotation.z = -Math.sin(this.ragdollTimer * 15) * 1.4;
      this.leftLegPivot.rotation.x = Math.sin(this.ragdollTimer * 12) * 1.1;
      this.rightLegPivot.rotation.x = -Math.sin(this.ragdollTimer * 12) * 1.1;

      // Mắt quay mòng mòng chóng mặt
      this.headPivot.rotation.z = Math.sin(this.ragdollTimer * 18) * 0.5;

      // Hồi phục: bò dậy đứng lên vui nhộn
      if (this.ragdollTimer <= 0) {
        this.isRagdoll = false;
        this.velocity.set(0, 0, 0);
        this.angularVelocity.set(0, 0, 0);
        this.torsoGroup.rotation.set(0, 0, 0);
        this.headPivot.rotation.set(0, 0, 0);
        this.leftArmPivot.rotation.set(0.15, 0, 0);
        this.rightArmPivot.rotation.set(0.15, 0, 0);
        this.leftLegPivot.rotation.set(0, 0, 0);
        this.rightLegPivot.rotation.set(0, 0, 0);
      }
      return;
    }

    // 3. DI CHUYỂN BÌNH THƯỜNG VỚI HIỆU ỨNG WOBBLE UỐN LƯỢN
    if (this.isHoldingEnemy) {
      moveInput.x *= 0.65;
      moveInput.z *= 0.65;
    }

    this.root.position.x += this.velocity.x * dt;
    this.root.position.z += this.velocity.z * dt;
    this.velocity.x *= 0.85;
    this.velocity.z *= 0.85;

    // ĐỒNG BỘ VỊ TRÍ ĐỐI THỦ ĐANG BỊ MÌNH VÁC TRÊN ĐẦU
    if (this.isHoldingEnemy && this.grabbedEnemy) {
      const carrierPos = this.root.position;
      const fwd = new THREE.Vector3(0, 0, 0.25).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.root.rotation.y);
      this.grabbedEnemy.root.position.set(
        carrierPos.x + fwd.x,
        carrierPos.y + 2.18 + Math.abs(Math.sin(this.walkCycle)) * 0.08,
        carrierPos.z + fwd.z
      );
      this.grabbedEnemy.root.rotation.y = this.root.rotation.y + Math.PI / 2;
      this.grabbedEnemy.torsoGroup.rotation.z = Math.sin(this.walkCycle) * 0.22;
    }

    const isMoving = Math.abs(moveInput.x) > 0.05 || Math.abs(moveInput.z) > 0.05;
    if (isMoving) {
      const cycleSpeed = this.isSprinting ? 26 : 15;
      this.walkCycle += dt * cycleSpeed;
      const targetAngle = Math.atan2(moveInput.x, moveInput.z);

      // Xoay hướng êm ái
      let diff = targetAngle - this.root.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.root.rotation.y += diff * Math.min(dt * 18, 1.0);

      // Nghiêng người theo hướng chạy (Chạy nhanh thì chúi người lao tới mạnh hơn)
      const targetLeanX = this.isSprinting ? 0.38 : (Math.sin(this.walkCycle) * 0.18 + 0.18);
      this.tiltX = THREE.MathUtils.lerp(this.tiltX, targetLeanX, dt * 12);
      this.tiltZ = THREE.MathUtils.lerp(this.tiltZ, Math.cos(this.walkCycle) * (this.isSprinting ? 0.28 : 0.22), dt * 12);

      this.torsoGroup.rotation.x = this.tiltX;
      this.torsoGroup.rotation.z = this.tiltZ;

      // Bước chân lon ton nhịp nhàng (Chạy nhanh guồng chân siêu tốc)
      const strideAmp = this.isSprinting ? 1.05 : 0.75;
      this.torsoGroup.position.y = 1.25 + Math.abs(Math.sin(this.walkCycle)) * (this.isSprinting ? 0.18 : 0.12);
      this.leftLegPivot.rotation.x = Math.sin(this.walkCycle) * strideAmp;
      this.rightLegPivot.rotation.x = -Math.sin(this.walkCycle) * strideAmp;

      // Đầu lúc lắc theo nhịp chạy
      this.headPivot.rotation.z = -this.tiltZ * 0.7;
      this.headPivot.rotation.x = this.isSprinting ? -0.25 + Math.sin(this.walkCycle * 2) * 0.15 : Math.sin(this.walkCycle * 2) * 0.12;

      // Tay: Nếu đang Vác đối thủ hoặc Chạy Nhanh -> GIƠ 2 TAY LÊN TRỜI!
      if (this.isHoldingEnemy) {
        this.leftArmPivot.rotation.x = -Math.PI + 0.32;
        this.rightArmPivot.rotation.x = -Math.PI + 0.32;
        this.leftArmPivot.rotation.z = -0.22;
        this.rightArmPivot.rotation.z = 0.22;
      } else if (!this.isPunching) {
        if (this.isSprinting) {
          this.leftArmPivot.rotation.x = -Math.PI + 0.3 + Math.sin(this.walkCycle * 0.7) * 0.28;
          this.rightArmPivot.rotation.x = -Math.PI + 0.3 - Math.sin(this.walkCycle * 0.7) * 0.28;
          this.leftArmPivot.rotation.z = -0.26;
          this.rightArmPivot.rotation.z = 0.26;
        } else {
          this.leftArmPivot.rotation.x = -Math.sin(this.walkCycle) * 0.7;
          this.rightArmPivot.rotation.x = Math.sin(this.walkCycle) * 0.7;
          this.leftArmPivot.rotation.z = 0;
          this.rightArmPivot.rotation.z = 0;
        }
      }
    } else {
      // Đứng thở nhún nhảy đáng yêu khi nghỉ (Nếu đang bật Chạy nhanh vẫn giơ 2 tay lên trời hào hứng!)
      this.wobblePhase += dt * 3.5;
      this.tiltX = THREE.MathUtils.lerp(this.tiltX, 0, dt * 8);
      this.tiltZ = THREE.MathUtils.lerp(this.tiltZ, 0, dt * 8);

      this.torsoGroup.rotation.x = Math.sin(this.wobblePhase) * 0.04;
      this.torsoGroup.rotation.z = Math.cos(this.wobblePhase * 0.8) * 0.05;
      this.torsoGroup.position.y = 1.25 + Math.sin(this.wobblePhase * 2) * 0.04;

      this.headPivot.rotation.z = Math.sin(this.wobblePhase * 1.2) * 0.06;
      this.headPivot.rotation.x = 0;

      this.leftLegPivot.rotation.x = 0;
      this.rightLegPivot.rotation.x = 0;

      if (this.isHoldingEnemy) {
        this.leftArmPivot.rotation.x = -Math.PI + 0.32;
        this.rightArmPivot.rotation.x = -Math.PI + 0.32;
        this.leftArmPivot.rotation.z = -0.22;
        this.rightArmPivot.rotation.z = 0.22;
      } else if (!this.isPunching) {
        if (this.isSprinting) {
          this.leftArmPivot.rotation.x = -Math.PI + 0.3 + Math.sin(this.wobblePhase * 2) * 0.15;
          this.rightArmPivot.rotation.x = -Math.PI + 0.3 - Math.sin(this.wobblePhase * 2) * 0.15;
          this.leftArmPivot.rotation.z = -0.24;
          this.rightArmPivot.rotation.z = 0.24;
        } else {
          this.leftArmPivot.rotation.x = 0.18 + Math.sin(this.wobblePhase) * 0.05;
          this.rightArmPivot.rotation.x = 0.18 + Math.sin(this.wobblePhase) * 0.05;
          this.leftArmPivot.rotation.z = 0;
          this.rightArmPivot.rotation.z = 0;
        }
      }
    }

    // 4. ANIMATION ĐẤM SMASH UỐN DẺO CỰC LỰC
    if (this.isPunching) {
      this.rightArmPivot.rotation.z = 0;
      this.punchTime += dt;
      const duration = 0.28;
      const progress = this.punchTime / duration;

      if (progress < 0.45) {
        // Vung nắm đấm ra trước cực căng
        const pNorm = progress / 0.45;
        this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(0.18, -Math.PI / 2 - 0.2, pNorm);
        this.rightArmPivot.position.z = THREE.MathUtils.lerp(0, 0.60, pNorm);
        if (this.rightGlove) this.rightGlove.scale.set(1.4, 1.4, 1.4);
        this.torsoGroup.rotation.y = THREE.MathUtils.lerp(0, 0.45, pNorm);
      } else if (progress <= 1.0) {
        // Thu tay về
        const pNorm = (progress - 0.45) / 0.55;
        this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(-Math.PI / 2 - 0.2, 0.18, pNorm);
        this.rightArmPivot.position.z = THREE.MathUtils.lerp(0.60, 0, pNorm);
        if (this.rightGlove) this.rightGlove.scale.lerp(new THREE.Vector3(1, 1, 1), pNorm);
        this.torsoGroup.rotation.y = THREE.MathUtils.lerp(0.45, 0, pNorm);
      } else {
        this.isPunching = false;
        this.rightArmPivot.position.z = 0;
        this.rightArmPivot.rotation.x = 0.18;
        if (this.rightGlove) this.rightGlove.scale.set(1, 1, 1);
        this.torsoGroup.rotation.y = 0;
      }
    }

    // 5. PHỤC HỒI SQUASH & STRETCH
    this.squashY = THREE.MathUtils.lerp(this.squashY, 1.0, dt * 10);
    this.squashXZ = THREE.MathUtils.lerp(this.squashXZ, 1.0, dt * 10);
    this.torsoGroup.scale.set(this.squashXZ, this.squashY, this.squashXZ);
  }
}
