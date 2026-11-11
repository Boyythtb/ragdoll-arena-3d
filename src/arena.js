import * as THREE from 'three';

export function createArena() {
  const group = new THREE.Group();

  // 1. SÀN PHÒNG THI ĐẤU PARQUET ẤM ÁP
  const floorGeo = new THREE.PlaneGeometry(60, 60);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    roughness: 0.35,
    metalness: 0.02
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.5; // Đặt thấp hơn võ đài để tạo vực rớt đài
  floor.receiveShadow = true;
  group.add(floor);

  // Vân gỗ Parquet
  const woodCanvas = document.createElement('canvas');
  woodCanvas.width = 512;
  woodCanvas.height = 512;
  const wctx = woodCanvas.getContext('2d');
  wctx.fillStyle = '#fde68a';
  wctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 512; i += 28) {
    wctx.fillStyle = i % 56 === 0 ? 'rgba(217, 119, 6, 0.08)' : 'rgba(180, 83, 9, 0.04)';
    wctx.fillRect(0, i, 512, 26);
    wctx.strokeStyle = 'rgba(217, 119, 6, 0.14)';
    wctx.lineWidth = 1;
    wctx.strokeRect(0, i, 512, 28);
  }
  const woodTex = new THREE.CanvasTexture(woodCanvas);
  woodTex.wrapS = THREE.RepeatWrapping;
  woodTex.wrapT = THREE.RepeatWrapping;
  woodTex.repeat.set(10, 10);
  woodMat.map = woodTex;
  woodMat.needsUpdate = true;

  // 2. VÕ ĐÀI NỔI CHÍNH GIỮA (FLOATING WRESTLING RING 12x12)
  const ringSize = 13.5;
  const ringH = 1.6;

  // Khối đài nhô cao
  const ringGeo = new THREE.BoxGeometry(ringSize, ringH, ringSize);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x1e1b4b, // Deep Navy
    roughness: 0.3
  });
  const ringBase = new THREE.Mesh(ringGeo, ringMat);
  ringBase.position.y = -ringH / 2;
  ringBase.castShadow = true;
  ringBase.receiveShadow = true;
  group.add(ringBase);

  // Thảm võ đài Mint Green Pastel
  const canvasMatGeo = new THREE.PlaneGeometry(ringSize - 0.2, ringSize - 0.2);
  const canvasMat = new THREE.MeshStandardMaterial({
    color: 0x34d399,
    roughness: 0.4
  });
  const canvasMesh = new THREE.Mesh(canvasMatGeo, canvasMat);
  canvasMesh.rotation.x = -Math.PI / 2;
  canvasMesh.position.y = 0.01;
  canvasMesh.receiveShadow = true;
  group.add(canvasMesh);

  // Vòng tròn trung tâm võ đài
  const centerRingGeo = new THREE.RingGeometry(2.4, 2.7, 48);
  const centerRingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const centerRing = new THREE.Mesh(centerRingGeo, centerRingMat);
  centerRing.rotation.x = -Math.PI / 2;
  centerRing.position.y = 0.02;
  group.add(centerRing);

  // 3. 4 CỘT GÓC ĐÀI (CORNER POSTS)
  const postH = 2.4;
  const postR = 0.22;
  const postGeo = new THREE.CylinderGeometry(postR, postR, postH, 24);
  const postColors = [0xf43f5e, 0x0284c7, 0xf59e0b, 0x10b981];

  const half = (ringSize - 0.8) / 2;
  const postCoords = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half]
  ];

  postCoords.forEach(([px, pz], idx) => {
    const postMat = new THREE.MeshStandardMaterial({ color: postColors[idx], roughness: 0.2 });
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(px, postH / 2, pz);
    post.castShadow = true;
    group.add(post);

    // Đệm ốp góc đài an toàn
    const padGeo = new THREE.BoxGeometry(0.65, 1.8, 0.65);
    const padMat = new THREE.MeshStandardMaterial({ color: postColors[idx], roughness: 0.3 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(px, 1.0, pz);
    group.add(pad);
  });

  // 4. DÂY ĐÀI ĐÀN HỒI (ELASTIC ROPES 3 TẦNG)
  const ropeLevels = [0.6, 1.2, 1.8];
  ropeLevels.forEach((ry, rIdx) => {
    const ropeColor = rIdx === 1 ? 0xffffff : 0xf472b6;
    const ropeMat = new THREE.MeshStandardMaterial({ color: ropeColor, roughness: 0.3 });

    for (let i = 0; i < 4; i++) {
      const p1 = postCoords[i];
      const p2 = postCoords[(i + 1) % 4];

      const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const ropeGeo = new THREE.CylinderGeometry(0.045, 0.045, len, 16);
      const rope = new THREE.Mesh(ropeGeo, ropeMat);

      rope.position.set((p1[0] + p2[0]) / 2, ry, (p1[1] + p2[1]) / 2);
      if (p1[0] === p2[0]) {
        rope.rotation.x = Math.PI / 2;
      } else {
        rope.rotation.z = Math.PI / 2;
      }
      group.add(rope);
    }
  });

  return group;
}
