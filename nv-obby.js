/**
 * PlayVerse 2.0 — Roblox Obby «Sky Tower»
 * Полная копия управления Roblox R6 + классический obby с 10 препятствиями.
 */
(function () {
  "use strict";

  /* ═══════════════════════════════════════════════════════════════
   * КОНСТАНТЫ ROBLOX (workspace + Humanoid defaults)
   * ═══════════════════════════════════════════════════════════════ */
  const RBX = {
    GRAVITY: 196.2,           // workspace.Gravity (studs/s²)
    WALK_SPEED: 16,           // Humanoid.WalkSpeed (studs/s)
    JUMP_HEIGHT: 7.2,         // высота прыжка в studs
    JUMP_VEL: 53.15,          // sqrt(2 * g * h) — начальная скорость прыжка
    MAX_SLOPE: 0.85,          // макс. угол поверхности для ходьбы
    HIP_HEIGHT: 3,            // HumanoidRootPart над землёй (центр торса)
    ROOT_SIZE: { x: 2, y: 2, z: 1 },
    COYOTE_TIME: 0.12,        // окно прыжка после схода с платформы
    JUMP_BUFFER: 0.12,        // буфер нажатия прыжка до приземления
    AIR_CONTROL: 0.65,        // множитель управления в воздухе
    FRICTION_GROUND: 14,      // трение на земле
    FRICTION_AIR: 2,
    CAMERA_DIST: 12,          // дистанция камеры от HRP
    CAMERA_HEIGHT: 2.5,
    CAMERA_MIN_PITCH: -1.1,
    CAMERA_MAX_PITCH: 1.2,
    MOUSE_SENS: 0.0025,
    DEATH_Y: -30,
    TOTAL_STAGES: 10
  };

  /* R6 пропорции (studs) — как в Roblox */
  const R6 = {
    head: { x: 2, y: 1, z: 1, yOff: 1.5 },
    torso: { x: 2, y: 2, z: 1, yOff: 0 },
    arm: { x: 1, y: 2, z: 1, xOff: 1.5 },
    leg: { x: 1, y: 2, z: 1, xOff: 0.5, yOff: -2 }
  };

  let THREE = null;
  let running = false;
  let rafId = 0;
  let renderer = null;
  let scene = null;
  let camera = null;
  let clock = null;
  let player = null;
  let course = null;
  let animObstacles = [];
  let killMeshes = [];
  let checkpointZones = [];
  let stage = 1;
  let checkpoint = { x: 0, y: 5, z: 0 };
  let startTime = 0;
  let elapsed = 0;
  let won = false;
  let paused = true;
  let pointerLocked = false;

  const canvas = () => document.getElementById("nv-obby-canvas");
  const overlay = () => document.getElementById("nv-obby-overlay");
  const toastEl = () => document.getElementById("nv-obby-toast");

  /* ═══════════════════════════════════════════════════════════════
   * ТЕКСТУРЫ — Roblox stud / checkered / neon
   * ═══════════════════════════════════════════════════════════════ */
  function hexToRgb(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function createStudTexture(baseHex, studHex, size) {
    size = size || 64;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    const base = hexToRgb(baseHex);
    const stud = hexToRgb(studHex || baseHex);
    ctx.fillStyle = "rgb(" + base.r + "," + base.g + "," + base.b + ")";
    ctx.fillRect(0, 0, size, size);
    const step = size / 4;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const cx = col * step + step / 2;
        const cy = row * step + step / 2;
        const grad = ctx.createRadialGradient(cx - 2, cy - 2, 0, cx, cy, step * 0.38);
        grad.addColorStop(0, "rgb(" + Math.min(255, stud.r + 40) + "," + Math.min(255, stud.g + 40) + "," + Math.min(255, stud.b + 40) + ")");
        grad.addColorStop(1, "rgb(" + Math.max(0, stud.r - 30) + "," + Math.max(0, stud.g - 30) + "," + Math.max(0, stud.b - 30) + ")");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, step * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }

  function createCheckeredTexture(c1, c2, size) {
    size = size || 64;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    const cell = size / 8;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? c1 : c2;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  }

  function rbxMaterial(color, opts) {
    opts = opts || {};
    const tex = opts.checkered
      ? createCheckeredTexture(opts.c1 || "#fde047", opts.c2 || "#f59e0b")
      : createStudTexture(color, opts.stud || color);
    return new THREE.MeshStandardMaterial({
      map: tex,
      color: 0xffffff,
      roughness: opts.roughness != null ? opts.roughness : 0.55,
      metalness: opts.metalness || 0,
      emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
      emissiveIntensity: opts.emissiveIntensity || 0
    });
  }

  function makePart(w, h, d, mat) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /* ═══════════════════════════════════════════════════════════════
   * RobloxPlayerController — детальная физика игрока R6
   * ═══════════════════════════════════════════════════════════════ */
  class RobloxPlayerController {
    constructor(scene, colors) {
      this.scene = scene;
      colors = colors || { skin: "#fcd9b6", shirt: "#9333ea", pants: "#312e81" };

      /** @type {"Running"|"Jumping"|"Freefall"|"Landed"} */
      this.humanoidState = "Landed";

      /** HumanoidRootPart — центр физики (как Part в Roblox) */
      this.hrp = new THREE.Group();
      this.hrp.name = "HumanoidRootPart";
      this.hrp.position.set(0, 5, 0);

      /** Скорость в studs/s (Vector3) */
      this.velocity = new THREE.Vector3(0, 0, 0);

      /** Флаги */
      this.grounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.wantsJump = false;
      this.facingYaw = 0;

      /** Камера — yaw/pitch как в Roblox third person */
      this.camYaw = 0;
      this.camPitch = 0.25;

      /** Ввод */
      this.input = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        moveX: 0,
        moveZ: 0
      };

      /** Raycaster для земли */
      this.raycaster = new THREE.Raycaster();
      this.raycaster.far = 6;

      /** Коллайдер — Capsule-подобный AABB 2×5×2 */
      this.halfSize = new THREE.Vector3(1, 2.5, 1);

      /** Сборка R6 модели */
      this.model = new THREE.Group();
      this.model.name = "Character";
      this._buildR6(colors);
      this.hrp.add(this.model);
      this.model.position.y = -RBX.HIP_HEIGHT;
      scene.add(this.hrp);

      /** Анимация ног/рук */
      this.walkPhase = 0;
      this.leftLeg = null;
      this.rightLeg = null;
      this.leftArm = null;
      this.rightArm = null;
    }

    _buildR6(colors) {
      const skinMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.skin), roughness: 0.7 });
      const shirtMat = rbxMaterial(colors.shirt);
      const pantsMat = rbxMaterial(colors.pants);
      const armMat = rbxMaterial(colors.arms || colors.shirt);

      const head = makePart(R6.head.x, R6.head.y, R6.head.z, skinMat);
      head.position.y = R6.head.yOff + 1;
      this.model.add(head);

      const face = new THREE.Group();
      const eyeGeo = new THREE.SphereGeometry(0.12, 8, 8);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.35, R6.head.yOff + 1.05, 0.52);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.35;
      face.add(eyeL, eyeR);
      this.model.add(face);

      const torso = makePart(R6.torso.x, R6.torso.y, R6.torso.z, shirtMat);
      torso.position.y = R6.torso.yOff;
      this.model.add(torso);

      this.leftArm = makePart(R6.arm.x, R6.arm.y, R6.arm.z, armMat);
      this.leftArm.position.set(-R6.arm.xOff, 0, 0);
      this.rightArm = makePart(R6.arm.x, R6.arm.y, R6.arm.z, armMat);
      this.rightArm.position.set(R6.arm.xOff, 0, 0);
      this.model.add(this.leftArm, this.rightArm);

      this.leftLeg = makePart(R6.leg.x, R6.leg.y, R6.leg.z, pantsMat);
      this.leftLeg.position.set(-R6.leg.xOff, R6.leg.yOff, 0);
      this.rightLeg = makePart(R6.leg.x, R6.leg.y, R6.leg.z, pantsMat);
      this.rightLeg.position.set(R6.leg.xOff, R6.leg.yOff, 0);
      this.model.add(this.leftLeg, this.rightLeg);
    }

    /** Направление камеры на плоскости XZ (как Camera.CFrame.LookVector) */
    getCameraForward() {
      const f = new THREE.Vector3(
        -Math.sin(this.camYaw),
        0,
        -Math.cos(this.camYaw)
      );
      return f.normalize();
    }

    getCameraRight() {
      const f = this.getCameraForward();
      return new THREE.Vector3(f.z, 0, -f.x).normalize();
    }

    /** MoveDirection — как Humanoid.MoveDirection в Roblox (относительно камеры) */
    getMoveDirection() {
      let mx = this.input.moveX;
      let mz = this.input.moveZ;
      if (Math.abs(mx) < 0.05 && Math.abs(mz) < 0.05) {
        mx = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
        mz = (this.input.backward ? 1 : 0) - (this.input.forward ? 1 : 0);
      }
      if (Math.abs(mx) < 0.05 && Math.abs(mz) < 0.05) return new THREE.Vector3(0, 0, 0);

      const forward = this.getCameraForward();
      const right = this.getCameraRight();
      const dir = new THREE.Vector3();
      dir.addScaledVector(forward, -mz);
      dir.addScaledVector(right, mx);
      if (dir.lengthSq() > 0.001) dir.normalize();
      return dir;
    }

    /** Raycast вниз — GroundSensor (как ControllerManager.GroundSensor) */
    castGround(collisionMeshes) {
      const origin = this.hrp.position.clone();
      origin.y += 0.5;
      this.raycaster.set(origin, new THREE.Vector3(0, -1, 0));
      const hits = this.raycaster.intersectObjects(collisionMeshes, false);
      if (!hits.length) return null;
      const hit = hits[0];
      if (hit.distance > 4.5) return null;
      if (hit.face && hit.face.normal.y < RBX.MAX_SLOPE) return null;
      return hit;
    }

    /** AABB пересечение с kill-блоками */
    intersectsKill(killList) {
      const pos = this.hrp.position;
      const hs = this.halfSize;
      const box = new THREE.Box3(
        new THREE.Vector3(pos.x - hs.x, pos.y - hs.y, pos.z - hs.z),
        new THREE.Vector3(pos.x + hs.x, pos.y + hs.y, pos.z + hs.z)
      );
      for (let i = 0; i < killList.length; i++) {
        const km = killList[i];
        if (!km.visible && km.userData.blink) continue;
        km.updateMatrixWorld(true);
        const kb = new THREE.Box3().setFromObject(km);
        if (box.intersectsBox(kb)) return true;
      }
      return false;
    }

    /** Главный tick физики — вызывается каждый frame с delta (сек) */
    update(delta, collisionMeshes, killList) {
      if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= delta;
      if (this.coyoteTimer > 0) this.coyoteTimer -= delta;

      const groundHit = this.castGround(collisionMeshes);
      const wasGrounded = this.grounded;
      this.grounded = !!groundHit;

      if (this.grounded && !wasGrounded) {
        this.humanoidState = "Landed";
      }

      if (this.grounded) {
        this.coyoteTimer = RBX.COYOTE_TIME;
        if (this.velocity.y < 0) this.velocity.y = 0;
        const ny = groundHit.point.y + RBX.HIP_HEIGHT;
        if (this.hrp.position.y <= ny + 0.05) {
          this.hrp.position.y = ny;
        }
      } else {
        this.humanoidState = this.velocity.y > 0.5 ? "Jumping" : "Freefall";
      }

      /* Прыжок — Space / Humanoid.Jump = true */
      const canJump = this.grounded || this.coyoteTimer > 0;
      if ((this.wantsJump || this.jumpBufferTimer > 0) && canJump) {
        this.velocity.y = RBX.JUMP_VEL;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.wantsJump = false;
        this.humanoidState = "Jumping";
      }
      if (this.input.jump && !this.wantsJump) {
        this.jumpBufferTimer = RBX.JUMP_BUFFER;
      }
      this.wantsJump = this.input.jump;

      /* Гравитация workspace.Gravity */
      if (!this.grounded) {
        this.velocity.y -= RBX.GRAVITY * delta;
      }

      /* Движение — WalkSpeed по MoveDirection */
      const moveDir = this.getMoveDirection();
      const targetSpeed = RBX.WALK_SPEED;
      const control = this.grounded ? 1 : RBX.AIR_CONTROL;
      const friction = this.grounded ? RBX.FRICTION_GROUND : RBX.FRICTION_AIR;

      if (moveDir.lengthSq() > 0.001) {
        this.humanoidState = this.grounded ? "Running" : this.humanoidState;
        this.facingYaw = Math.atan2(moveDir.x, moveDir.z);
        this.model.rotation.y = this.facingYaw;
        const targetVx = moveDir.x * targetSpeed;
        const targetVz = moveDir.z * targetSpeed;
        this.velocity.x += (targetVx - this.velocity.x) * Math.min(1, friction * control * delta);
        this.velocity.z += (targetVz - this.velocity.z) * Math.min(1, friction * control * delta);
        this.walkPhase += delta * targetSpeed * 0.5;
      } else if (this.grounded) {
        this.velocity.x *= Math.max(0, 1 - friction * delta);
        this.velocity.z *= Math.max(0, 1 - friction * delta);
        if (Math.abs(this.velocity.x) < 0.05) this.velocity.x = 0;
        if (Math.abs(this.velocity.z) < 0.05) this.velocity.z = 0;
      }

      /* Применение скорости */
      this.hrp.position.x += this.velocity.x * delta;
      this.hrp.position.y += this.velocity.y * delta;
      this.hrp.position.z += this.velocity.z * delta;

      /* Простая коллизия AABB со статичными платформами */
      this._resolveCollisions(collisionMeshes);

      /* Анимация R6 — качание рук/ног при беге */
      const moving = moveDir.lengthSq() > 0.01 && this.grounded;
      const swing = moving ? Math.sin(this.walkPhase) * 0.5 : 0;
      if (this.leftLeg) this.leftLeg.rotation.x = swing;
      if (this.rightLeg) this.rightLeg.rotation.x = -swing;
      if (this.leftArm) this.leftArm.rotation.x = -swing * 0.6;
      if (this.rightArm) this.rightArm.rotation.x = swing * 0.6;

      return this.intersectsKill(killList);
    }

    _resolveCollisions(meshes) {
      const pos = this.hrp.position;
      const hs = this.halfSize;
      for (let i = 0; i < meshes.length; i++) {
        const m = meshes[i];
        if (m.userData.noCollide) continue;
        m.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(m);
        const px = pos.x;
        const py = pos.y;
        const pz = pos.z;
        const minX = box.min.x - hs.x;
        const maxX = box.max.x + hs.x;
        const minY = box.min.y;
        const maxY = box.max.y + hs.y * 2;
        const minZ = box.min.z - hs.z;
        const maxZ = box.max.z + hs.z;
        if (px > minX && px < maxX && py > minY && py < maxY && pz > minZ && pz < maxZ) {
          const overlapY = Math.min(maxY - py, py - minY);
          const overlapX = Math.min(maxX - px, px - minX);
          const overlapZ = Math.min(maxZ - pz, pz - minZ);
          if (overlapY < overlapX && overlapY < overlapZ && this.velocity.y <= 0) {
            pos.y = box.max.y + RBX.HIP_HEIGHT;
            this.velocity.y = 0;
            this.grounded = true;
          } else if (overlapX < overlapZ) {
            pos.x += px > (box.min.x + box.max.x) / 2 ? overlapX : -overlapX;
            this.velocity.x = 0;
          } else {
            pos.z += pz > (box.min.z + box.max.z) / 2 ? overlapZ : -overlapZ;
            this.velocity.z = 0;
          }
        }
      }
    }

    respawn(x, y, z) {
      this.hrp.position.set(x, y, z);
      this.velocity.set(0, 0, 0);
      this.grounded = false;
      this.humanoidState = "Landed";
    }

    updateCamera(cam) {
      const target = this.hrp.position.clone();
      target.y += RBX.CAMERA_HEIGHT;
      const offset = new THREE.Vector3(
        Math.sin(this.camYaw) * Math.cos(this.camPitch) * RBX.CAMERA_DIST,
        Math.sin(this.camPitch) * RBX.CAMERA_DIST,
        Math.cos(this.camYaw) * Math.cos(this.camPitch) * RBX.CAMERA_DIST
      );
      cam.position.copy(target).add(offset);
      cam.lookAt(target);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
   * ПОЛИГОН — 10 препятствий классического Roblox Obby
   * ═══════════════════════════════════════════════════════════════ */
  function buildCourse(scene) {
    const group = new THREE.Group();
    group.name = "ObbyCourse";
    const platforms = [];
    const kills = [];
    const anim = [];
    const zones = [];

    function plat(x, y, z, w, h, d, color, opts) {
      opts = opts || {};
      const mat = rbxMaterial(color, opts);
      const p = makePart(w, h, d, mat);
      p.position.set(x, y + h / 2, z);
      if (opts.kill) {
        p.userData.kill = true;
        mat.emissive = new THREE.Color("#ff0000");
        mat.emissiveIntensity = 0.6;
        kills.push(p);
      } else {
        platforms.push(p);
      }
      if (opts.checkpoint) {
        p.userData.checkpoint = opts.checkpoint;
        zones.push({ mesh: p, stage: opts.checkpoint, x: x, y: y + h + 3, z: z, r: Math.max(w, d) * 0.6 });
      }
      group.add(p);
      return p;
    }

    function sign(x, y, z, text, color) {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 64;
      const ctx = c.getContext("2d");
      ctx.fillStyle = color || "#fff";
      ctx.fillRect(0, 0, 256, 64);
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, 252, 60);
      ctx.fillStyle = "#111";
      ctx.font = "bold 28px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(text, 128, 42);
      const tex = new THREE.CanvasTexture(c);
      const sm = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 2),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true })
      );
      sm.position.set(x, y, z);
      group.add(sm);
    }

    /* 1. СТАРТ — зелёная платформа */
    plat(0, 0, 0, 24, 2, 24, "#4ade80", { checkpoint: 1 });
    sign(0, 6, -8, "START", "#bbf7d0");

    /* 2. Прыжок через пропасть */
    plat(0, 0, -32, 14, 2, 14, "#3b82f6", { checkpoint: 2 });
    plat(0, 0, -52, 14, 2, 14, "#ef4444");

    /* 3. Узкий жёлтый мост над лавой */
    plat(0, -0.5, -72, 3, 2, 40, "#facc15", { checkpoint: 3 });
    plat(0, -12, -72, 50, 2, 44, "#dc2626", { kill: true });

    /* 4. Камни через лаву */
    const stoneXs = [-8, 0, 8, 0, -8];
    for (let i = 0; i < 5; i++) {
      plat(stoneXs[i], 0, -95 - i * 10, 5, 2, 5, i % 2 ? "#8b5cf6" : "#06b6d4");
    }
    plat(0, 0, -148, 12, 2, 12, "#22c55e", { checkpoint: 4 });
    plat(0, -12, -120, 36, 2, 60, "#dc2626", { kill: true });

    /* 5. Движущаяся платформа */
    const mover = plat(0, 2, -168, 8, 2, 8, "#f97316", { checkpoint: 5 });
    mover.userData.anim = "moveX";
    mover.userData.baseX = 0;
    mover.userData.amp = 10;
    mover.userData.speed = 1.2;
    anim.push(mover);
    plat(-14, 0, -168, 8, 2, 8, "#64748b");
    plat(14, 0, -168, 8, 2, 8, "#64748b");

    /* 6. Вращающаяся kill-балка */
    plat(0, 0, -195, 20, 2, 20, "#a855f7", { checkpoint: 6 });
    const spinner = makePart(22, 2, 2, rbxMaterial("#ef4444", { emissive: "#ff0000", emissiveIntensity: 0.8 }));
    spinner.position.set(0, 4, -195);
    spinner.userData.anim = "spinY";
    spinner.userData.kill = true;
    kills.push(spinner);
    anim.push(spinner);
    group.add(spinner);

    /* 7. Исчезающие платформы */
    const blinkPlats = [];
    for (let i = 0; i < 6; i++) {
      const bp = plat(-10 + i * 4, 0, -218 - i * 2, 4, 2, 4, "#ec4899");
      bp.userData.anim = "blink";
      bp.userData.phase = i * 0.8;
      blinkPlats.push(bp);
      anim.push(bp);
    }
    plat(0, 0, -240, 12, 2, 12, "#14b8a6", { checkpoint: 7 });

    /* 8. Пандус + прыжок */
    const ramp = makePart(16, 2, 20, rbxMaterial("#eab308"));
    ramp.position.set(0, 2, -265);
    ramp.rotation.x = -0.35;
    platforms.push(ramp);
    group.add(ramp);
    plat(0, 4, -285, 10, 2, 10, "#6366f1", { checkpoint: 8 });
    plat(0, 4, -302, 10, 2, 10, "#6366f1");

    /* 9. Башня — подъём вверх */
    const towerSteps = [
      [0, 6, -318], [6, 9, -328], [0, 12, -338], [-6, 15, -348], [0, 18, -358]
    ];
    towerSteps.forEach(function (s, i) {
      plat(s[0], s[1], s[2], 8, 2, 8, ["#0ea5e9", "#22d3ee", "#34d399", "#a3e635", "#fbbf24"][i], i === 0 ? { checkpoint: 9 } : {});
    });
    plat(0, -12, -330, 40, 2, 50, "#dc2626", { kill: true });

    /* 10. ФИНИШ — золотая клетчатая платформа */
    plat(0, 20, -378, 22, 2, 22, "#fde047", { checkered: true, c1: "#fde047", c2: "#f59e0b", checkpoint: 10 });
    sign(0, 26, -378, "WIN!", "#fef08a");

    const flagPole = makePart(0.4, 12, 0.4, new THREE.MeshStandardMaterial({ color: 0x888888 }));
    flagPole.position.set(0, 26, -370);
    group.add(flagPole);
    const flag = makePart(6, 3, 0.2, new THREE.MeshStandardMaterial({ color: 0xef4444, side: THREE.DoubleSide }));
    flag.position.set(3, 30, -370);
    group.add(flag);

    scene.add(group);
    return {
      group: group,
      platforms: platforms.concat([ramp]),
      kills: kills,
      anim: anim,
      zones: zones
    };
  }

  function buildSky(scene) {
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 80, 450);

    const sun = new THREE.DirectionalLight(0xfff5e6, 1.15);
    sun.position.set(60, 120, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 400;
    sun.shadow.camera.left = -120;
    sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120;
    sun.shadow.camera.bottom = -120;
    scene.add(sun);

    const ambient = new THREE.AmbientLight(0xb8d4ff, 0.55);
    scene.add(ambient);

    const base = makePart(600, 2, 600, rbxMaterial("#5b21b6"));
    base.position.y = -14;
    base.receiveShadow = true;
    base.userData.noCollide = false;
    scene.add(base);

    for (let i = 0; i < 18; i++) {
      const cloud = makePart(12 + Math.random() * 20, 3, 8 + Math.random() * 10, new THREE.MeshStandardMaterial({
        color: 0xffffff, transparent: true, opacity: 0.85, roughness: 1
      }));
      cloud.position.set((Math.random() - 0.5) * 300, 40 + Math.random() * 30, -80 - Math.random() * 300);
      cloud.userData.noCollide = true;
      scene.add(cloud);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
   * UI / HUD
   * ═══════════════════════════════════════════════════════════════ */
  function showToast(msg) {
    const el = toastEl();
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { el.classList.remove("show"); }, 2200);
  }

  function updateHUD() {
    const stageEl = document.querySelector("#nv-obby-stage span");
    if (stageEl) stageEl.textContent = String(stage);
    const timerEl = document.querySelector("#nv-obby-timer span");
    if (timerEl) {
      const s = Math.floor(elapsed);
      timerEl.textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    }
    const dots = document.getElementById("nv-obby-dots");
    if (dots && !dots.childElementCount) {
      for (let i = 1; i <= RBX.TOTAL_STAGES; i++) {
        const d = document.createElement("span");
        d.className = "nv-obby-stage-dot";
        d.dataset.stage = String(i);
        dots.appendChild(d);
      }
    }
    if (dots) {
      dots.querySelectorAll(".nv-obby-stage-dot").forEach(function (d) {
        const n = parseInt(d.dataset.stage, 10);
        d.classList.toggle("done", n < stage);
        d.classList.toggle("current", n === stage);
      });
    }
  }

  function getPlayerColors() {
    let hue = 270;
    try {
      if (window.PVProfile && PVProfile.isLoggedIn && PVProfile.isLoggedIn() && PVProfile.currentUser) {
        const u = PVProfile.currentUser();
        if (u && typeof u.avatarHue === "number") hue = u.avatarHue;
        else if (u && u.username) {
          const s = u.username;
          for (let i = 0; i < s.length; i++) hue = (hue + s.charCodeAt(i) * 17) % 360;
        }
        return {
          skin: "#fcd9b6",
          shirt: "hsl(" + hue + ",55%,52%)",
          pants: "hsl(" + ((hue + 40) % 360) + ",45%,32%)"
        };
      }
    } catch (e) { /* ignore */ }
    return { skin: "#fcd9b6", shirt: "#9333ea", pants: "#312e81" };
  }

  /* ═══════════════════════════════════════════════════════════════
   * ВВОД — клавиатура, мышь, тач
   * ═══════════════════════════════════════════════════════════════ */
  const keyMap = {};
  let mouseDX = 0;
  let mouseDY = 0;

  function onKeyDown(e) {
    keyMap[e.code] = true;
    if (player) {
      player.input.forward = keyMap["KeyW"] || keyMap["ArrowUp"];
      player.input.backward = keyMap["KeyS"] || keyMap["ArrowDown"];
      player.input.left = keyMap["KeyA"] || keyMap["ArrowLeft"];
      player.input.right = keyMap["KeyD"] || keyMap["ArrowRight"];
      player.input.jump = keyMap["Space"];
    }
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.code) >= 0) e.preventDefault();
  }

  function onKeyUp(e) {
    keyMap[e.code] = false;
    if (player) {
      player.input.forward = keyMap["KeyW"] || keyMap["ArrowUp"];
      player.input.backward = keyMap["KeyS"] || keyMap["ArrowDown"];
      player.input.left = keyMap["KeyA"] || keyMap["ArrowLeft"];
      player.input.right = keyMap["KeyD"] || keyMap["ArrowRight"];
      player.input.jump = keyMap["Space"];
    }
  }

  function onMouseMove(e) {
    if (!running || !player) return;
    if (document.pointerLockElement === canvas()) {
      mouseDX += e.movementX || 0;
      mouseDY += e.movementY || 0;
    } else if (e.buttons === 1 || e.buttons === 2) {
      mouseDX += e.movementX || 0;
      mouseDY += e.movementY || 0;
    }
  }

  function onCanvasClick() {
    const c = canvas();
    if (c && !won && overlay() && !overlay().classList.contains("open")) {
      c.requestPointerLock?.();
    }
  }

  function setupMobileControls() {
    const joy = document.getElementById("nv-obby-joy");
    const knob = document.getElementById("nv-obby-joy-knob");
    const jumpBtn = document.getElementById("nv-obby-jump-m");
    if (!joy || !knob) return;

    let joyActive = false;
    let joyCx = 0;
    let joyCy = 0;

    function setJoy(nx, nz) {
      if (!player) return;
      player.input.moveX = nx;
      player.input.moveZ = nz;
    }

    joy.addEventListener("touchstart", function (e) {
      e.preventDefault();
      joyActive = true;
      const r = joy.getBoundingClientRect();
      joyCx = r.left + r.width / 2;
      joyCy = r.top + r.height / 2;
    }, { passive: false });

    joy.addEventListener("touchmove", function (e) {
      if (!joyActive) return;
      e.preventDefault();
      const t = e.touches[0];
      let dx = t.clientX - joyCx;
      let dy = t.clientY - joyCy;
      const max = 40;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      knob.style.transform = "translate(" + dx + "px," + dy + "px)";
      setJoy(dx / max, dy / max);
    }, { passive: false });

    function endJoy() {
      joyActive = false;
      knob.style.transform = "";
      setJoy(0, 0);
    }
    joy.addEventListener("touchend", endJoy);
    joy.addEventListener("touchcancel", endJoy);

    if (jumpBtn) {
      jumpBtn.addEventListener("touchstart", function (e) {
        e.preventDefault();
        if (player) player.input.jump = true;
      }, { passive: false });
      jumpBtn.addEventListener("touchend", function () {
        if (player) player.input.jump = false;
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════════
   * ИГРОВОЙ ЦИКЛ
   * ═══════════════════════════════════════════════════════════════ */
  function animateObstacles(t) {
    animObstacles.forEach(function (obj) {
      if (obj.userData.anim === "moveX") {
        obj.position.x = obj.userData.baseX + Math.sin(t * obj.userData.speed) * obj.userData.amp;
      } else if (obj.userData.anim === "spinY") {
        obj.rotation.y = t * 2.2;
      } else if (obj.userData.anim === "blink") {
        const on = Math.sin(t * 2.5 + obj.userData.phase) > 0;
        obj.visible = on;
        obj.userData.blink = true;
      }
    });
  }

  function checkCheckpoints() {
    if (!player || !checkpointZones.length) return;
    const px = player.hrp.position.x;
    const pz = player.hrp.position.z;
    checkpointZones.forEach(function (z) {
      const dx = px - z.x;
      const dz = pz - z.z;
      if (dx * dx + dz * dz < z.r * z.r && z.stage >= stage) {
        if (z.stage > stage) {
          stage = z.stage;
          checkpoint = { x: z.x, y: z.y, z: z.z };
          showToast("Чекпоинт " + stage + " ✓");
          updateHUD();
        }
        if (z.stage === RBX.TOTAL_STAGES && !won) {
          won = true;
          showToast("🏆 Победа! Obby пройден!");
          const ov = overlay();
          if (ov) {
            document.getElementById("nv-obby-overlay-title").textContent = "Победа!";
            document.getElementById("nv-obby-overlay-text").textContent =
              "Ты прошёл все 10 препятствий за " + document.querySelector("#nv-obby-timer span").textContent + "!";
            ov.classList.add("open");
          }
          document.exitPointerLock?.();
        }
      }
    });
  }

  function respawnPlayer() {
    if (!player) return;
    player.respawn(checkpoint.x, checkpoint.y, checkpoint.z);
    showToast("Упал! Чекпоинт " + stage);
  }

  function gameLoop() {
    if (!running) return;
    rafId = requestAnimationFrame(gameLoop);
    const delta = Math.min(clock.getDelta(), 0.05);
    if (paused) {
      if (player) player.updateCamera(camera);
      renderer.render(scene, camera);
      return;
    }
    elapsed = (performance.now() - startTime) / 1000;
    updateHUD();

    if (player) {
      player.camYaw -= mouseDX * RBX.MOUSE_SENS;
      player.camPitch = Math.max(RBX.CAMERA_MIN_PITCH, Math.min(RBX.CAMERA_MAX_PITCH, player.camPitch - mouseDY * RBX.MOUSE_SENS));
      mouseDX = 0;
      mouseDY = 0;

      const t = elapsed;
      animateObstacles(t);

      const hitKill = player.update(delta, course.platforms, killMeshes);
      if (hitKill || player.hrp.position.y < RBX.DEATH_Y) {
        respawnPlayer();
      }
      checkCheckpoints();
      player.updateCamera(camera);
    }

    renderer.render(scene, camera);
  }

  function loadThree() {
    return new Promise(function (resolve, reject) {
      if (window.THREE) { resolve(window.THREE); return; }
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      s.onload = function () { resolve(window.THREE); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function initGame() {
    const c = canvas();
    if (!c || !THREE) return;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.2, 600);
    renderer = new THREE.WebGLRenderer({ canvas: c, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    clock = new THREE.Clock();
    buildSky(scene);
    course = buildCourse(scene);
    animObstacles = course.anim;
    killMeshes = course.kills;
    checkpointZones = course.zones;

    stage = 1;
    checkpoint = { x: 0, y: 5, z: 0 };
    won = false;
    paused = true;
    startTime = performance.now();
    elapsed = 0;

    if (player && player.hrp) scene.remove(player.hrp);
    player = new RobloxPlayerController(scene, getPlayerColors());
    player.respawn(0, 5, 0);

    updateHUD();
  }

  function onResize() {
    if (!renderer || !camera) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function bindUI() {
    document.getElementById("nv-obby-back")?.addEventListener("click", function () {
      if (typeof showScreen === "function") showScreen("newverse");
    });
    document.getElementById("nv-obby-exit")?.addEventListener("click", function () {
      if (typeof showScreen === "function") showScreen("newverse");
    });
    document.getElementById("nv-obby-start")?.addEventListener("click", function () {
      overlay()?.classList.remove("open");
      won = false;
      paused = false;
      startTime = performance.now();
      if (player) player.respawn(0, 5, 0);
      stage = 1;
      checkpoint = { x: 0, y: 5, z: 0 };
      updateHUD();
      canvas()?.requestPointerLock?.();
    });
    canvas()?.addEventListener("click", onCanvasClick);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", onResize);
    document.addEventListener("pointerlockchange", function () {
      pointerLocked = document.pointerLockElement === canvas();
    });
    setupMobileControls();
  }

  window.startNVObby = function () {
    loadThree().then(function (T) {
      THREE = T;
      running = true;
      cancelAnimationFrame(rafId);
      overlay()?.classList.add("open");
      document.getElementById("nv-obby-overlay-title").textContent = "Roblox Obby — Sky Tower";
      document.getElementById("nv-obby-overlay-text").textContent =
        "Классический паркур как в Roblox! WASD — движение, пробел — прыжок, мышь — камера. 10 препятствий до финиша.";
      initGame();
      gameLoop();
    }).catch(function () {
      showToast("Не удалось загрузить 3D-движок");
    });
  };

  window.stopNVObby = function () {
    running = false;
    paused = true;
    cancelAnimationFrame(rafId);
    document.exitPointerLock?.();
    if (renderer) {
      renderer.dispose();
      renderer = null;
    }
    scene = null;
    camera = null;
    player = null;
    course = null;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindUI);
  } else {
    bindUI();
  }
})();
