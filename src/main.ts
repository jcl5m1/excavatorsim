import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GamepadController } from './GamepadController';
import { KeyboardController } from './KeyboardController';
import { Excavator } from './Excavator';

class ExcavatorSimulator {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private world: CANNON.World;
  private excavator: Excavator;
  private gamepad: GamepadController;
  private keyboard: KeyboardController;
  private clock: THREE.Clock;
  private groundBody: CANNON.Body;

  // Camera orbit controls
  private cameraAngle: number = 0;
  private cameraElevation: number = Math.PI / 6; // ~30 degrees
  private cameraDistance: number = 8;
  private isDragging: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  constructor() {
    this.clock = new THREE.Clock();
    
    // Initialize Three.js
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 10, 50);

    // Setup camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(5, 3, 5);
    this.camera.lookAt(0, 0, 0);

    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    const container = document.getElementById('canvas-container');
    if (container) {
      container.appendChild(this.renderer.domElement);
    }

    // Setup lights
    this.setupLights();

    // Initialize Cannon.js physics world
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0),
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.defaultContactMaterial.friction = 0.4;

    // Create ground
    this.groundBody = this.createGround();

    // Create excavator
    this.excavator = new Excavator(this.world, new THREE.Vector3(0, 1, 0));
    this.scene.add(this.excavator.group);

    // Initialize gamepad and keyboard controllers
    this.gamepad = new GamepadController();
    this.keyboard = new KeyboardController();

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());

    // Setup mouse controls for camera
    this.setupMouseControls();

    // Start animation loop
    this.animate();
  }

  private setupMouseControls(): void {
    const canvas = this.renderer.domElement;

    canvas.addEventListener('mousedown', (event: MouseEvent) => {
      this.isDragging = true;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('mousemove', (event: MouseEvent) => {
      if (!this.isDragging) return;

      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;

      // Update camera angle and elevation (X is inverted for natural rotation)
      this.cameraAngle += deltaX * 0.01;
      this.cameraElevation = THREE.MathUtils.clamp(
        this.cameraElevation + deltaY * 0.01,
        0.1, // Min elevation (don't go below ground)
        Math.PI / 2 - 0.1 // Max elevation (don't go directly overhead)
      );

      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    });

    canvas.addEventListener('mouseup', () => {
      this.isDragging = false;
      canvas.style.cursor = 'grab';
    });

    canvas.addEventListener('mouseleave', () => {
      this.isDragging = false;
      canvas.style.cursor = 'grab';
    });

    // Set initial cursor
    canvas.style.cursor = 'grab';

    // Mouse wheel for zoom
    canvas.addEventListener('wheel', (event: WheelEvent) => {
      event.preventDefault();
      this.cameraDistance = THREE.MathUtils.clamp(
        this.cameraDistance + event.deltaY * 0.01,
        3, // Min distance
        20 // Max distance
      );
    });
  }

  private setupLights(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    this.scene.add(directionalLight);

    // Hemisphere light for better ambient lighting
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x8B7355, 0.3);
    this.scene.add(hemisphereLight);
  }

  private createGround(): CANNON.Body {
    // Visual ground
    const groundSize = 50;
    const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);
    const groundMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x8B7355,
      side: THREE.DoubleSide 
    });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    // Add grid helper
    const gridHelper = new THREE.GridHelper(
      groundSize,
      groundSize,
      0xff0000, // Center line color (red for x=0, z=0)
      0x888888  // Grid line color (white)
    );
    gridHelper.material.opacity = 0.5;
    gridHelper.material.transparent = true;
    gridHelper.position.y = 0.001; // Raise slightly to prevent z-fighting
    this.scene.add(gridHelper);

    // Physics ground
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({
      mass: 0, // Static body
      shape: groundShape,
      collisionFilterGroup: 2, // GROUND_GROUP
      collisionFilterMask: 1 // EXCAVATOR_GROUP
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(groundBody);

    return groundBody;
  }

  private handleControls(deltaTime: number): void {
    // Update both controllers
    this.gamepad.update();
    this.keyboard.update();
    
    // Merge states - keyboard takes priority if both are active
    const gamepadState = this.gamepad.getState();
    const keyboardState = this.keyboard.getState();
    
    // Merge analog values (add them together and clamp)
    const leftStickX = Math.max(-1, Math.min(1, gamepadState.leftStickX + keyboardState.leftStickX));
    const leftStickY = Math.max(-1, Math.min(1, gamepadState.leftStickY + keyboardState.leftStickY));
    const rightStickX = Math.max(-1, Math.min(1, gamepadState.rightStickX + keyboardState.rightStickX));
    const rightStickY = Math.max(-1, Math.min(1, gamepadState.rightStickY + keyboardState.rightStickY));
    const leftTrigger = Math.max(gamepadState.leftTrigger, keyboardState.leftTrigger);
    const rightTrigger = Math.max(gamepadState.rightTrigger, keyboardState.rightTrigger);
    
    // Merge button states (OR operation - either controller can activate)
    const leftBumper = gamepadState.leftBumper || keyboardState.leftBumper;
    const rightBumper = gamepadState.rightBumper || keyboardState.rightBumper;
    const dpadUp = gamepadState.dpadUp || keyboardState.dpadUp;
    const dpadDown = gamepadState.dpadDown || keyboardState.dpadDown;
    const buttonY = gamepadState.buttonY || keyboardState.buttonY;
    const buttonA = gamepadState.buttonA || keyboardState.buttonA;

    // Main body rotation (left stick X-axis)
    const rotationSpeed = 2.0 * deltaTime;
    this.excavator.setMainBodyRotation(leftStickX * rotationSpeed);

    // Second arm segment (left stick Y-axis)
    const arm2Speed = 1.0 * deltaTime;
    this.excavator.setArm2Angle(-leftStickY * arm2Speed);

    // First arm segment (right stick X-axis)
    const arm1Speed = 1.0 * deltaTime;
    this.excavator.setArm1Angle(rightStickX * arm1Speed);

    // Bucket wrist (right stick Y-axis)
    const bucketSpeed = 1.5 * deltaTime;
    this.excavator.setBucketAngle(-rightStickY * bucketSpeed);

    // Thumb rotation (D-pad up/down)
    const thumbSpeed = 1.0 * deltaTime;
    let thumbDelta = 0;
    if (dpadUp) {
      thumbDelta = -thumbSpeed;
    } else if (dpadDown) {
      thumbDelta = thumbSpeed;
    }
    this.excavator.setThumbAngle(thumbDelta);

    // Blade height (Y/A buttons)
    const bladeSpeed = 0.5 * deltaTime;
    let bladeDelta = 0;
    if (buttonY) {
      bladeDelta = -bladeSpeed;
    } else if (buttonA) {
      bladeDelta = bladeSpeed;
    }
    this.excavator.setBladeHeight(bladeDelta);

    // Tread movement
    let leftSpeed = 0;
    let rightSpeed = 0;

    // Left tread: LT forward, LB backward
    if (leftTrigger > 0) {
      leftSpeed = leftTrigger;
    }
    if (leftBumper) {
      leftSpeed = -1.0;
    }

    // Right tread: RT forward, RB backward
    if (rightTrigger > 0) {
      rightSpeed = rightTrigger;
    }
    if (rightBumper) {
      rightSpeed = -1.0;
    }

    // Store and apply tread forces
    this.excavator.setTreadForces(leftSpeed, rightSpeed);
    this.excavator.applyTreadForces(leftSpeed, rightSpeed);
  }

  private updateTelemetry(): void {
    // Display raw radian values
    const toRadians = (rad: number) => rad.toFixed(3);
    
    // Update joint angles with limit flashing
    const bodyYawEl = document.getElementById('body-yaw');
    const arm1El = document.getElementById('arm1-angle');
    const arm2El = document.getElementById('arm2-angle');
    const bucketEl = document.getElementById('bucket-angle');
    const thumbEl = document.getElementById('thumb-angle');
    
    if (bodyYawEl) bodyYawEl.textContent = `${toRadians(this.excavator.getMainBodyRotation())} rad`;
    
    if (arm1El) {
      arm1El.textContent = `${toRadians(this.excavator.getArm1Angle())} rad`;
      if (this.excavator.isArm1AtLimit()) {
        arm1El.classList.add('limit-flash');
      } else {
        arm1El.classList.remove('limit-flash');
      }
    }
    
    if (arm2El) {
      arm2El.textContent = `${toRadians(this.excavator.getArm2Angle())} rad`;
      if (this.excavator.isArm2AtLimit()) {
        arm2El.classList.add('limit-flash');
      } else {
        arm2El.classList.remove('limit-flash');
      }
    }
    
    if (bucketEl) {
      bucketEl.textContent = `${toRadians(this.excavator.getBucketAngle())} rad`;
      if (this.excavator.isBucketAtLimit()) {
        bucketEl.classList.add('limit-flash');
      } else {
        bucketEl.classList.remove('limit-flash');
      }
    }
    
    if (thumbEl) {
      thumbEl.textContent = `${toRadians(this.excavator.getThumbAngle())} rad`;
      if (this.excavator.isThumbAtLimit()) {
        thumbEl.classList.add('limit-flash');
      } else {
        thumbEl.classList.remove('limit-flash');
      }
    }
    
    // Update blade position
    const bladeHeightEl = document.getElementById('blade-height');
    if (bladeHeightEl) {
      bladeHeightEl.textContent = `${this.excavator.getBladeHeight().toFixed(2)}m`;
      if (this.excavator.isBladeAtLimit()) {
        bladeHeightEl.classList.add('limit-flash');
      } else {
        bladeHeightEl.classList.remove('limit-flash');
      }
    }
    
    // Update tread forces
    const leftTreadEl = document.getElementById('left-tread');
    const rightTreadEl = document.getElementById('right-tread');
    if (leftTreadEl) leftTreadEl.textContent = this.excavator.getLeftTreadForce().toFixed(2);
    if (rightTreadEl) rightTreadEl.textContent = this.excavator.getRightTreadForce().toFixed(2);
  }

  private updatePhysicsDebug(): void {
    // Update chassis velocity
    const velocity = this.excavator.getChassisVelocity();
    const linearVelEl = document.getElementById('linear-velocity');
    const angularVelEl = document.getElementById('angular-velocity');
    
    if (linearVelEl) {
      linearVelEl.textContent = `(${velocity.linear.x.toFixed(2)}, ${velocity.linear.y.toFixed(2)}, ${velocity.linear.z.toFixed(2)})`;
    }
    
    if (angularVelEl) {
      angularVelEl.textContent = `(${velocity.angular.x.toFixed(2)}, ${velocity.angular.y.toFixed(2)}, ${velocity.angular.z.toFixed(2)})`;
    }
    
    // Update collision list
    const collisionListEl = document.getElementById('collision-list');
    if (collisionListEl) {
      const collisions = this.excavator.getCollisionEvents();
      
      if (collisions.size === 0) {
        collisionListEl.innerHTML = '<div style="color: #888; font-style: italic;">No collisions detected</div>';
      } else {
        let html = '';
        collisions.forEach((data) => {
          const activeClass = data.isActive ? 'active' : '';
          html += `
            <div class="collision-event ${activeClass}">
              <strong>${data.partName}</strong>
              <div class="data-row">
                <span class="label">Normal:</span>
                <span class="value force-vector">(${data.contactNormal.x.toFixed(2)}, ${data.contactNormal.y.toFixed(2)}, ${data.contactNormal.z.toFixed(2)})</span>
              </div>
              <div class="data-row">
                <span class="label">Force:</span>
                <span class="value force-vector">(${data.appliedForce.x.toFixed(0)}, ${data.appliedForce.y.toFixed(0)}, ${data.appliedForce.z.toFixed(0)}) N</span>
              </div>
            </div>
          `;
        });
        collisionListEl.innerHTML = html;
      }
    }
    
    // Update collision stats
    const totalCollisionsEl = document.getElementById('total-collisions');
    const frameCollisionsEl = document.getElementById('frame-collisions');
    
    if (totalCollisionsEl) {
      totalCollisionsEl.textContent = this.excavator.getTotalCollisions().toString();
    }
    
    if (frameCollisionsEl) {
      frameCollisionsEl.textContent = this.excavator.getFrameCollisions().toString();
    }
  }

  private updateCamera(): void {
    // Follow camera that orbits around the excavator based on user input
    const excavatorPos = this.excavator.group.position;
    
    // Calculate camera position using spherical coordinates
    const x = excavatorPos.x + Math.cos(this.cameraAngle) * Math.cos(this.cameraElevation) * this.cameraDistance;
    const y = excavatorPos.y + Math.sin(this.cameraElevation) * this.cameraDistance;
    const z = excavatorPos.z + Math.sin(this.cameraAngle) * Math.cos(this.cameraElevation) * this.cameraDistance;
    
    this.camera.position.set(x, y, z);
    this.camera.lookAt(excavatorPos);
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());

    const deltaTime = this.clock.getDelta();
    const maxDeltaTime = 0.1; // Cap delta time to prevent physics explosions
    const dt = Math.min(deltaTime, maxDeltaTime);

    // Reset frame collision counter at start of frame
    this.excavator.resetFrameCollisions();

    // Update physics
    this.world.step(1 / 60, dt, 3);

    // Handle gamepad controls
    this.handleControls(dt);

    // Update excavator
    this.excavator.update(dt);

    // Update camera
    this.updateCamera();

    // Update telemetry display
    this.updateTelemetry();

    // Update physics debug display
    this.updatePhysicsDebug();

    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Initialize the simulator when the page loads
new ExcavatorSimulator();
