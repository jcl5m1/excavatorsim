import * as THREE from 'three';
import * as CANNON from 'cannon-es';

interface CollisionData {
  partName: string;
  timestamp: number;
  contactNormal: { x: number; y: number; z: number };
  appliedForce: { x: number; y: number; z: number };
  isActive: boolean;
}

export class Excavator {
  // Three.js meshes
  public group: THREE.Group;
  private chassis!: THREE.Mesh;
  private leftTread!: THREE.Mesh;
  private rightTread!: THREE.Mesh;
  private blade!: THREE.Mesh;
  private mainBody!: THREE.Group;
  private arm1!: THREE.Group;
  private arm2!: THREE.Mesh;
  private bucket!: THREE.Mesh;
  private thumb!: THREE.Mesh;

  // Physics bodies
  public physicsBody!: CANNON.Body;
  private bladeBody!: CANNON.Body;
  private mainBodyPhysics!: CANNON.Body;
  private arm1Part1Body!: CANNON.Body;
  private arm1Part2Body!: CANNON.Body;
  private arm2Body!: CANNON.Body;
  private bucketBody!: CANNON.Body;
  private thumbBody!: CANNON.Body;
  private world: CANNON.World;

  // Debug wireframes
  private debugWireframes: THREE.LineSegments[] = [];

  // Physics debug data
  private collisionEvents: Map<string, CollisionData> = new Map();
  private totalCollisions: number = 0;
  private frameCollisions: number = 0;

  // Control state
  private mainBodyRotation: number = 0;
  private arm1Angle: number = 0;
  private arm2Angle: number = 0.25;  // Set to MIN_ANGLE to be within valid range
  private bucketAngle: number = 0;
  private thumbAngle: number = -0.2;  // Set to MAX_ANGLE to be within valid range
  private bladeHeight: number = -0.2;  // Set to MAX_HEIGHT to be within valid range

  // Material colors
  private readonly COLOR_CHASSIS = 0x666666;
  private readonly COLOR_BODY_BASE = 0xff4824;
  private readonly COLOR_TREADS = 0x666666;
  private readonly COLOR_CABIN = 0x666666;
  private readonly COLOR_ARMS = 0xff4824;
  private readonly COLOR_BLADE = 0x666666;
  private readonly COLOR_BUCKET = 0xff4824;
  private readonly COLOR_THUMB = 0x666666;

  // Dimensions (in meters)
  private readonly BASE_WIDTH = 1.0;
  private readonly BASE_LENGTH = 2.0;
  private readonly BASE_HEIGHT = 0.2;
  private readonly TREAD_WIDTH = 0.25;
  private readonly TREAD_HEIGHT = 0.4;
  private readonly BLADE_WIDTH = 1.6;
  private readonly BLADE_HEIGHT = 0.4;

  private readonly ARM1_WIDTH = 0.3;
  private readonly ARM1_LENGTH = 2.8;
  private readonly ARM2_WIDTH = 0.2;
  private readonly ARM2_LENGTH = 1.5;
  private readonly BUCKET_SIZE = 0.5;

  // Position offsets and multipliers
  private readonly BLADE_FORWARD_OFFSET = 0.1;
  private readonly BODY_BASE_WIDTH_MULT = 1.4;
  private readonly BODY_BASE_HEIGHT_MULT = 1.0;
  private readonly BODY_BASE_LENGTH_MULT = 0.8;
  private readonly BODY_BASE_Y_OFFSET = 2.0;
  private readonly CABIN_WIDTH_MULT = 1.3;
  private readonly CABIN_HEIGHT_MULT = 2.;
  private readonly CABIN_LENGTH_MULT = 0.7;
  private readonly CABIN_Y_OFFSET = 1.7;
  private readonly CABIN_Z_OFFSET = 0.1;
  private readonly ARM1_Y_OFFSET = 0.2;
  private readonly ARM1_Z_OFFSET = 0.35;
  private readonly BUCKET_HEIGHT_MULT = 0.8;
  private readonly SCOOP_SIZE_MULT = 0.9;
  private readonly SCOOP_THICKNESS = 0.05;
  private readonly SCOOP_Y_OFFSET = 0.0;
  private readonly SCOOP_Z_OFFSET = 1.25;
  private readonly THUMB_WIDTH = 0.3;
  private readonly THUMB_LENGTH = 0.8;
  private readonly THUMB_DEPTH = 0.1;
  private readonly THUMB_Y_POS_MULT = 0.9;
  private readonly THUMB_Z_POS_MULT = -0.5;
  private readonly CABIN_OPACITY = 0.7;

  // Control limits
  private readonly ARM1_MIN_ANGLE = 0.0;
  private readonly ARM1_MAX_ANGLE = 1.25;
  private readonly ARM2_MIN_ANGLE = .25;
  private readonly ARM2_MAX_ANGLE = 2.25;
  private readonly BUCKET_MIN_ANGLE = -Math.PI / 2;
  private readonly BUCKET_MAX_ANGLE = 0.8;
  private readonly THUMB_MIN_ANGLE = -3.0;
  private readonly THUMB_MAX_ANGLE = -0.2;
  private readonly BLADE_MIN_HEIGHT = -0.5;
  private readonly BLADE_MAX_HEIGHT = -0.2;

  // Physics collision force settings (adjust these to tune collision response)
  private readonly COLLISION_FORCE_MULTIPLIER = 1000; // Base force in Newtons (lower = softer collision)
  private readonly PENETRATION_FORCE_MULTIPLIER = 2; // Additional force per meter of penetration (lower = less harsh)

  constructor(world: CANNON.World, position: THREE.Vector3) {
    this.world = world;
    this.group = new THREE.Group();
    this.group.position.copy(position);

    // Create visual components
    this.createChassis();
    this.createTreads();
    this.createBlade();
    this.createMainBody();
    this.createArm();

    // Create physics body
    this.createPhysics();
  }

  private createChassis(): void {
    const geometry = new THREE.BoxGeometry(this.BASE_WIDTH, this.BASE_HEIGHT, this.BASE_LENGTH);
    const material = new THREE.MeshPhongMaterial({ color: this.COLOR_CHASSIS });
    this.chassis = new THREE.Mesh(geometry, material);
    this.chassis.position.y = this.TREAD_HEIGHT;
    this.chassis.castShadow = true;
    this.chassis.receiveShadow = true;
    this.group.add(this.chassis);
  }

  private createTreads(): void {
    const geometry = new THREE.BoxGeometry(this.TREAD_WIDTH, this.TREAD_HEIGHT, this.BASE_LENGTH);
    const material = new THREE.MeshPhongMaterial({ color: this.COLOR_TREADS });

    // Left tread
    this.leftTread = new THREE.Mesh(geometry, material);
    this.leftTread.position.set(-this.BASE_WIDTH / 2 - this.TREAD_WIDTH / 2, this.TREAD_HEIGHT / 2, 0);
    this.leftTread.castShadow = true;
    this.group.add(this.leftTread);

    // Right tread
    this.rightTread = new THREE.Mesh(geometry, material);
    this.rightTread.position.set(this.BASE_WIDTH / 2 + this.TREAD_WIDTH / 2, this.TREAD_HEIGHT / 2, 0);
    this.rightTread.castShadow = true;
    this.group.add(this.rightTread);
  }

  private createBlade(): void {
    const geometry = new THREE.BoxGeometry(this.BLADE_WIDTH, this.BLADE_HEIGHT, this.BLADE_FORWARD_OFFSET);
    const material = new THREE.MeshPhongMaterial({ color: this.COLOR_BLADE });
    this.blade = new THREE.Mesh(geometry, material);
    this.blade.position.set(0, this.TREAD_HEIGHT + this.BLADE_HEIGHT / 2, this.BASE_LENGTH * 0.5 + this.BLADE_FORWARD_OFFSET);
    this.blade.castShadow = true;
    this.group.add(this.blade);
  }

  private createMainBody(): void {
    this.mainBody = new THREE.Group();
    
    // Rotating base (cabin)
    const baseGeometry = new THREE.BoxGeometry(
      this.BASE_WIDTH * this.BODY_BASE_WIDTH_MULT,
      this.BASE_WIDTH * this.BODY_BASE_HEIGHT_MULT,
      this.BASE_LENGTH * this.BODY_BASE_LENGTH_MULT
    );
    const baseMaterial = new THREE.MeshPhongMaterial({ color: this.COLOR_BODY_BASE });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.set(0, this.BASE_HEIGHT * this.BODY_BASE_Y_OFFSET, -this.BASE_LENGTH * this.BODY_BASE_LENGTH_MULT * 0.2);
    base.castShadow = true;
    this.mainBody.add(base);

    // Cabin/seat
    const cabinGeometry = new THREE.BoxGeometry(
      this.BASE_WIDTH * this.CABIN_WIDTH_MULT,
      this.BASE_WIDTH * this.CABIN_HEIGHT_MULT,
      this.BASE_LENGTH * this.CABIN_LENGTH_MULT
    );
    const cabinMaterial = new THREE.MeshPhongMaterial({ 
      color: this.COLOR_CABIN, 
      transparent: true, 
      opacity: this.CABIN_OPACITY 
    });
    const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
    cabin.position.set(0, this.BASE_WIDTH * this.CABIN_Y_OFFSET, -this.BASE_LENGTH * this.CABIN_Z_OFFSET);
    cabin.castShadow = true;
    this.mainBody.add(cabin);

    this.mainBody.position.set(0, this.TREAD_HEIGHT + this.BASE_HEIGHT, 0);
    this.group.add(this.mainBody);
  }

  private createArm(): void {
    const armMaterial = new THREE.MeshPhongMaterial({ color: this.COLOR_ARMS });
    
    // Arm1 is now a group containing two segments at 60 degree angle
    this.arm1 = new THREE.Group();
    this.arm1.position.set(0, this.ARM1_Y_OFFSET, this.BASE_LENGTH * this.ARM1_Z_OFFSET);
    this.mainBody.add(this.arm1);
    
    // First arm1 segment (half the original length)
    const arm1SegmentLength = this.ARM1_LENGTH / 2;
    const arm1Part1Geometry = new THREE.BoxGeometry(this.ARM1_WIDTH, arm1SegmentLength, this.ARM1_WIDTH);
    const arm1Part1 = new THREE.Mesh(arm1Part1Geometry, armMaterial);
    arm1Part1.castShadow = true;
    
    // Pivot point at base of first segment
    arm1Part1.geometry.translate(0, arm1SegmentLength / 2, 0);
    this.arm1.add(arm1Part1);
    
    // Second arm1 segment (attached at end of first segment, angled at 60 degrees)
    const arm1Part2Geometry = new THREE.BoxGeometry(this.ARM1_WIDTH, arm1SegmentLength, this.ARM1_WIDTH);
    const arm1Part2 = new THREE.Mesh(arm1Part2Geometry, armMaterial);
    arm1Part2.castShadow = true;
    
    // Pivot point at base of second segment
    arm1Part2.geometry.translate(0, arm1SegmentLength / 2, 0);
    arm1Part2.position.set(0, arm1SegmentLength, 0);
    arm1Part2.rotation.x = Math.PI / 3; // 60 degrees
    arm1Part1.add(arm1Part2);

    // Second arm segment (attached to end of second arm1 segment)
    const arm2Geometry = new THREE.BoxGeometry(this.ARM2_WIDTH, this.ARM2_LENGTH, this.ARM2_WIDTH);
    this.arm2 = new THREE.Mesh(arm2Geometry, armMaterial);
    this.arm2.castShadow = true;
    
    // Pivot point at base of second arm
    this.arm2.geometry.translate(0, this.ARM2_LENGTH / 2, 0);
    this.arm2.position.set(0, arm1SegmentLength, 0);
    arm1Part2.add(this.arm2);

    // Bucket (attached to end of second arm)
    const bucketGroup = new THREE.Group();
    
    // Bucket body
    const bucketGeometry = new THREE.BoxGeometry(
      this.BUCKET_SIZE,
      this.BUCKET_SIZE * this.BUCKET_HEIGHT_MULT,
      this.BUCKET_SIZE
    );
    const bucketMaterial = new THREE.MeshPhongMaterial({ color: this.COLOR_BUCKET });
    this.bucket = new THREE.Mesh(bucketGeometry, bucketMaterial);
    this.bucket.castShadow = true;
    this.bucket.geometry.translate(0, this.BUCKET_SIZE * this.BUCKET_HEIGHT_MULT / 2, this.BUCKET_SIZE/2);
    
    // Create bucket scoop shape
    const scoopGeometry = new THREE.BoxGeometry(
      this.BUCKET_SIZE * this.SCOOP_SIZE_MULT,
      this.SCOOP_THICKNESS,
      this.BUCKET_SIZE * this.SCOOP_SIZE_MULT
    );
    const scoop = new THREE.Mesh(scoopGeometry, bucketMaterial);
    scoop.position.set(
      0,
      -this.BUCKET_SIZE * this.SCOOP_Y_OFFSET,
      this.BUCKET_SIZE * this.SCOOP_Z_OFFSET
    );
    scoop.rotation.x = Math.PI / 3;
    scoop.castShadow = true;
    this.bucket.add(scoop);

    // Thumb gripper
    const thumbGeometry = new THREE.BoxGeometry(
      this.THUMB_WIDTH,
      this.THUMB_LENGTH,
      this.THUMB_DEPTH
    );
    const thumbMaterial = new THREE.MeshPhongMaterial({ color: this.COLOR_THUMB });
    this.thumb = new THREE.Mesh(thumbGeometry, thumbMaterial);
    this.thumb.castShadow = true;
    
    // Pivot at top of thumb
    this.thumb.geometry.translate(0, - this.THUMB_LENGTH/2, 0);
    this.thumb.position.set(
      0,
      this.ARM2_LENGTH * this.THUMB_Y_POS_MULT,
      -this.ARM2_WIDTH * this.THUMB_Z_POS_MULT
    );
    this.arm2.add(this.thumb);

    bucketGroup.add(this.bucket);
    bucketGroup.position.set(0, this.ARM2_LENGTH, 0);
    this.arm2.add(bucketGroup);
  }

  private createPhysics(): void {
    // Collision groups - excavator parts should not collide with each other
    const EXCAVATOR_GROUP = 1;
    const GROUND_GROUP = 2;
    
    // Calculate mass distribution: 2000 lbs = 907 kg, distributed by volume (excluding cabin)
    // Calculate volumes
    const chassisVolume = (this.BASE_WIDTH + this.TREAD_WIDTH * 2) * (this.BASE_HEIGHT + this.TREAD_HEIGHT) * this.BASE_LENGTH;
    const bladeVolume = this.BLADE_WIDTH * this.BLADE_HEIGHT * this.BLADE_FORWARD_OFFSET;
    const mainBodyVolume = (this.BASE_WIDTH * this.BODY_BASE_WIDTH_MULT) * (this.BASE_WIDTH * this.BODY_BASE_HEIGHT_MULT) * (this.BASE_LENGTH * this.BODY_BASE_LENGTH_MULT);
    const arm1SegmentLength = this.ARM1_LENGTH / 2;
    const arm1Part1Volume = this.ARM1_WIDTH * arm1SegmentLength * this.ARM1_WIDTH;
    const arm1Part2Volume = this.ARM1_WIDTH * arm1SegmentLength * this.ARM1_WIDTH;
    const arm2Volume = this.ARM2_WIDTH * this.ARM2_LENGTH * this.ARM2_WIDTH;
    const bucketVolume = this.BUCKET_SIZE * (this.BUCKET_SIZE * this.BUCKET_HEIGHT_MULT) * this.BUCKET_SIZE;
    const thumbVolume = this.THUMB_WIDTH * this.THUMB_LENGTH * this.THUMB_DEPTH;
    
    const totalVolume = chassisVolume + bladeVolume + mainBodyVolume + arm1Part1Volume + arm1Part2Volume + arm2Volume + bucketVolume + thumbVolume;
    const totalMass = 907; // 2000 lbs in kg
    
    // Distribute mass proportionally by volume
    const chassisMass = (chassisVolume / totalVolume) * totalMass;
    const bladeMass = (bladeVolume / totalVolume) * totalMass;
    const mainBodyMass = (mainBodyVolume / totalVolume) * totalMass;
    const arm1Part1Mass = (arm1Part1Volume / totalVolume) * totalMass;
    const arm1Part2Mass = (arm1Part2Volume / totalVolume) * totalMass;
    const arm2Mass = (arm2Volume / totalVolume) * totalMass;
    const bucketMass = (bucketVolume / totalVolume) * totalMass;
    const thumbMass = (thumbVolume / totalVolume) * totalMass;
    
    // Create compound shape for entire excavator chassis - must be wide enough to include treads
    const chassisShape = new CANNON.Box(new CANNON.Vec3(
      (this.BASE_WIDTH + this.TREAD_WIDTH * 2) / 2,
      (this.BASE_HEIGHT + this.TREAD_HEIGHT) / 2,
      this.BASE_LENGTH / 2
    ));

    this.physicsBody = new CANNON.Body({
      mass: chassisMass,
      position: new CANNON.Vec3(
        this.group.position.x,
        this.group.position.y + (this.BASE_HEIGHT + this.TREAD_HEIGHT) / 2,
        this.group.position.z
      ),
      shape: chassisShape,
      linearDamping: 0.3,
      angularDamping: 0.3,
      collisionFilterGroup: EXCAVATOR_GROUP,
      collisionFilterMask: GROUND_GROUP
    });

    this.world.addBody(this.physicsBody);

    // Create physics body for blade - kinematic, mass stored for force calculations
    const bladeShape = new CANNON.Box(new CANNON.Vec3(
      this.BLADE_WIDTH / 2,
      this.BLADE_HEIGHT / 2,
      this.BLADE_FORWARD_OFFSET / 2
    ));
    this.bladeBody = new CANNON.Body({
      mass: bladeMass,
      shape: bladeShape,
      collisionResponse: true,
      type: CANNON.Body.KINEMATIC,
      collisionFilterGroup: EXCAVATOR_GROUP,
      collisionFilterMask: GROUND_GROUP
    });
    this.world.addBody(this.bladeBody);

    // Create physics body for main body (cabin) - kinematic, mass stored for force calculations
    const mainBodyShape = new CANNON.Box(new CANNON.Vec3(
      this.BASE_WIDTH * this.BODY_BASE_WIDTH_MULT / 2,
      this.BASE_WIDTH * this.BODY_BASE_HEIGHT_MULT / 2,
      this.BASE_LENGTH * this.BODY_BASE_LENGTH_MULT / 2
    ));
    this.mainBodyPhysics = new CANNON.Body({
      mass: mainBodyMass,
      shape: mainBodyShape,
      collisionResponse: true,
      type: CANNON.Body.KINEMATIC,
      collisionFilterGroup: EXCAVATOR_GROUP,
      collisionFilterMask: GROUND_GROUP
    });
    this.world.addBody(this.mainBodyPhysics);

    // Create physics body for arm1 part 1 (first segment) - kinematic, mass stored for force calculations
    const arm1Part1Shape = new CANNON.Box(new CANNON.Vec3(
      this.ARM1_WIDTH / 2,
      arm1SegmentLength / 2,
      this.ARM1_WIDTH / 2
    ));
    this.arm1Part1Body = new CANNON.Body({
      mass: arm1Part1Mass,
      shape: arm1Part1Shape,
      collisionResponse: true,
      type: CANNON.Body.KINEMATIC,
      collisionFilterGroup: EXCAVATOR_GROUP,
      collisionFilterMask: GROUND_GROUP
    });
    this.world.addBody(this.arm1Part1Body);

    // Create physics body for arm1 part 2 (second segment at 60 degrees) - kinematic, mass stored for force calculations
    const arm1Part2Shape = new CANNON.Box(new CANNON.Vec3(
      this.ARM1_WIDTH / 2,
      arm1SegmentLength / 2,
      this.ARM1_WIDTH / 2
    ));
    this.arm1Part2Body = new CANNON.Body({
      mass: arm1Part2Mass,
      shape: arm1Part2Shape,
      collisionResponse: true,
      type: CANNON.Body.KINEMATIC,
      collisionFilterGroup: EXCAVATOR_GROUP,
      collisionFilterMask: GROUND_GROUP
    });
    this.world.addBody(this.arm1Part2Body);

    // Create physics body for arm2 - kinematic, mass stored for force calculations
    const arm2Shape = new CANNON.Box(new CANNON.Vec3(
      this.ARM2_WIDTH / 2,
      this.ARM2_LENGTH / 2,
      this.ARM2_WIDTH / 2
    ));
    this.arm2Body = new CANNON.Body({
      mass: arm2Mass,
      shape: arm2Shape,
      collisionResponse: true,
      type: CANNON.Body.KINEMATIC,
      collisionFilterGroup: EXCAVATOR_GROUP,
      collisionFilterMask: GROUND_GROUP
    });
    this.world.addBody(this.arm2Body);

    // Create physics body for bucket - kinematic, mass stored for force calculations
    const bucketShape = new CANNON.Box(new CANNON.Vec3(
      this.BUCKET_SIZE / 2,
      this.BUCKET_SIZE * this.BUCKET_HEIGHT_MULT / 2,
      this.BUCKET_SIZE / 2
    ));
    this.bucketBody = new CANNON.Body({
      mass: bucketMass,
      shape: bucketShape,
      collisionResponse: true,
      type: CANNON.Body.KINEMATIC,
      collisionFilterGroup: EXCAVATOR_GROUP,
      collisionFilterMask: GROUND_GROUP
    });
    this.world.addBody(this.bucketBody);

    // Create physics body for thumb - kinematic, mass stored for force calculations
    const thumbShape = new CANNON.Box(new CANNON.Vec3(
      this.THUMB_WIDTH / 2,
      this.THUMB_LENGTH / 2,
      this.THUMB_DEPTH / 2
    ));
    this.thumbBody = new CANNON.Body({
      mass: thumbMass,
      shape: thumbShape,
      collisionResponse: true,
      type: CANNON.Body.KINEMATIC,
      collisionFilterGroup: EXCAVATOR_GROUP,
      collisionFilterMask: GROUND_GROUP
    });
    this.world.addBody(this.thumbBody);

    // Create debug wireframes
    this.createDebugWireframes();

    // Add collision event listeners to make bodies respond to collisions
    this.setupCollisionHandlers();
    
    // Enable collision detection for kinematic bodies with ground
    this.world.addEventListener('postStep', () => {
      this.checkKinematicCollisions();
    });
  }

  private checkKinematicCollisions(): void {
    // Manually check for collisions with kinematic bodies since they don't auto-generate events with static bodies
    const kinematicBodies = [
      { body: this.bladeBody, name: 'Blade' },
      { body: this.mainBodyPhysics, name: 'Main Body' },
      { body: this.arm1Part1Body, name: 'Arm 1 Seg 1' },
      { body: this.arm1Part2Body, name: 'Arm 1 Seg 2' },
      { body: this.arm2Body, name: 'Arm 2' },
      { body: this.bucketBody, name: 'Bucket' },
      { body: this.thumbBody, name: 'Thumb' }
    ];

    // Check each kinematic body for ground penetration
    kinematicBodies.forEach(({ body, name }) => {
      // Get the lowest point of the body (assuming box shape)
      const shape = body.shapes[0] as CANNON.Box;
      const halfExtents = shape.halfExtents;
      
      // Calculate the world position of the bottom of the body
      const bottomOffset = new CANNON.Vec3(0, -halfExtents.y, 0);
      body.quaternion.vmult(bottomOffset, bottomOffset);
      const bottomY = body.position.y + bottomOffset.y;
      
      // Check if penetrating ground (y = 0)
      if (bottomY < 0.01) { // Small threshold for contact
        // Calculate penetration depth
        const penetration = Math.abs(bottomY);
        
        // Create a contact normal pointing up (away from ground)
        const contactNormal = new CANNON.Vec3(0, 1, 0);
        
        // Apply force proportional to penetration (using tunable constants)
        const forceMagnitude = this.COLLISION_FORCE_MULTIPLIER * (1 + penetration * this.PENETRATION_FORCE_MULTIPLIER);
        const force = contactNormal.scale(forceMagnitude);
        
        // Apply force to chassis
        const relativePos = body.position.vsub(this.physicsBody.position);
        this.physicsBody.applyForce(force, relativePos);
        
        // Track collision data
        this.totalCollisions++;
        this.frameCollisions++;
        this.collisionEvents.set(name, {
          partName: name,
          timestamp: Date.now(),
          contactNormal: { x: contactNormal.x, y: contactNormal.y, z: contactNormal.z },
          appliedForce: { x: force.x, y: force.y, z: force.z },
          isActive: true
        });
      }
    });
  }

  private setupCollisionHandlers(): void {
    // When kinematic parts collide, transfer the reaction force from the collision to the chassis
    // Use the contact normal from the physics engine to apply force in the correct direction
    const reactionForceMultiplier = 5000; // Force multiplier

    // Helper to apply collision force to chassis and track collision data
    const applyCollisionForce = (event: any, partBody: CANNON.Body, partName: string) => {
      // Get contact information from the collision
      const contact = event.contact;
      if (!contact) return;
      
      // Get the contact normal (direction of collision force)
      // The normal points from body A to body B, we want the reaction force on our excavator part
      let contactNormal = new CANNON.Vec3();
      if (contact.bi === partBody) {
        // If our part is body A, use normal as-is (points away from ground into our part)
        contactNormal.copy(contact.ni);
      } else {
        // If our part is body B, reverse the normal
        contactNormal.copy(contact.ni);
        contactNormal.negate();
      }
      
      // Scale the force based on the collision normal
      const force = contactNormal.scale(reactionForceMultiplier);
      
      // Apply force at the part's position relative to chassis
      const relativePos = partBody.position.vsub(this.physicsBody.position);
      this.physicsBody.applyForce(force, relativePos);

      // Track collision data for debug display
      this.totalCollisions++;
      this.frameCollisions++;
      this.collisionEvents.set(partName, {
        partName,
        timestamp: Date.now(),
        contactNormal: { x: contactNormal.x, y: contactNormal.y, z: contactNormal.z },
        appliedForce: { x: force.x, y: force.y, z: force.z },
        isActive: true
      });
    };

    // Set up collision listeners for all excavator parts
    this.bladeBody.addEventListener('collide', (event: any) => {
      applyCollisionForce(event, this.bladeBody, 'Blade');
    });
    
    this.mainBodyPhysics.addEventListener('collide', (event: any) => {
      applyCollisionForce(event, this.mainBodyPhysics, 'Main Body');
    });
    
    this.arm1Part1Body.addEventListener('collide', (event: any) => {
      applyCollisionForce(event, this.arm1Part1Body, 'Arm 1 Seg 1');
    });
    
    this.arm1Part2Body.addEventListener('collide', (event: any) => {
      applyCollisionForce(event, this.arm1Part2Body, 'Arm 1 Seg 2');
    });
    
    this.arm2Body.addEventListener('collide', (event: any) => {
      applyCollisionForce(event, this.arm2Body, 'Arm 2');
    });
    
    this.bucketBody.addEventListener('collide', (event: any) => {
      applyCollisionForce(event, this.bucketBody, 'Bucket');
    });
    
    this.thumbBody.addEventListener('collide', (event: any) => {
      applyCollisionForce(event, this.thumbBody, 'Thumb');
    });
  }

  private createDebugWireframes(): void {
    const debugMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });

    // Helper function to create wireframe for a box shape
    const createBoxWireframe = (halfExtents: CANNON.Vec3): THREE.LineSegments => {
      const geometry = new THREE.BoxGeometry(
        halfExtents.x * 2,
        halfExtents.y * 2,
        halfExtents.z * 2
      );
      const edges = new THREE.EdgesGeometry(geometry);
      return new THREE.LineSegments(edges, debugMaterial);
    };

    // Create wireframe for chassis
    const chassisWireframe = createBoxWireframe(new CANNON.Vec3(
      (this.BASE_WIDTH + this.TREAD_WIDTH * 2) / 2,
      (this.BASE_HEIGHT + this.TREAD_HEIGHT) / 2,
      this.BASE_LENGTH / 2
    ));
    this.group.add(chassisWireframe);
    this.debugWireframes.push(chassisWireframe);

    // Create wireframe for blade
    const bladeWireframe = createBoxWireframe(new CANNON.Vec3(
      this.BLADE_WIDTH / 2,
      this.BLADE_HEIGHT / 2,
      this.BLADE_FORWARD_OFFSET / 2
    ));
    this.group.add(bladeWireframe);
    this.debugWireframes.push(bladeWireframe);

    // Create wireframe for main body
    const mainBodyWireframe = createBoxWireframe(new CANNON.Vec3(
      this.BASE_WIDTH * this.BODY_BASE_WIDTH_MULT / 2,
      this.BASE_WIDTH * this.BODY_BASE_HEIGHT_MULT / 2,
      this.BASE_LENGTH * this.BODY_BASE_LENGTH_MULT / 2
    ));
    this.group.add(mainBodyWireframe);
    this.debugWireframes.push(mainBodyWireframe);

    // Create wireframe for arm1 part 1
    const arm1SegmentLength = this.ARM1_LENGTH / 2;
    const arm1Part1Wireframe = createBoxWireframe(new CANNON.Vec3(
      this.ARM1_WIDTH / 2,
      arm1SegmentLength / 2,
      this.ARM1_WIDTH / 2
    ));
    this.group.add(arm1Part1Wireframe);
    this.debugWireframes.push(arm1Part1Wireframe);

    // Create wireframe for arm1 part 2
    const arm1Part2Wireframe = createBoxWireframe(new CANNON.Vec3(
      this.ARM1_WIDTH / 2,
      arm1SegmentLength / 2,
      this.ARM1_WIDTH / 2
    ));
    this.group.add(arm1Part2Wireframe);
    this.debugWireframes.push(arm1Part2Wireframe);

    // Create wireframe for arm2
    const arm2Wireframe = createBoxWireframe(new CANNON.Vec3(
      this.ARM2_WIDTH / 2,
      this.ARM2_LENGTH / 2,
      this.ARM2_WIDTH / 2
    ));
    this.group.add(arm2Wireframe);
    this.debugWireframes.push(arm2Wireframe);

    // Create wireframe for bucket
    const bucketWireframe = createBoxWireframe(new CANNON.Vec3(
      this.BUCKET_SIZE / 2,
      this.BUCKET_SIZE * this.BUCKET_HEIGHT_MULT / 2,
      this.BUCKET_SIZE / 2
    ));
    this.group.add(bucketWireframe);
    this.debugWireframes.push(bucketWireframe);

    // Create wireframe for thumb
    const thumbWireframe = createBoxWireframe(new CANNON.Vec3(
      this.THUMB_WIDTH / 2,
      this.THUMB_LENGTH / 2,
      this.THUMB_DEPTH / 2
    ));
    this.group.add(thumbWireframe);
    this.debugWireframes.push(thumbWireframe);
  }

  public update(deltaTime: number): void {
    // Update visual position from physics
    this.group.position.set(
      this.physicsBody.position.x,
      this.physicsBody.position.y - (this.BASE_HEIGHT + this.TREAD_HEIGHT) / 2,
      this.physicsBody.position.z
    );
    this.group.quaternion.set(
      this.physicsBody.quaternion.x,
      this.physicsBody.quaternion.y,
      this.physicsBody.quaternion.z,
      this.physicsBody.quaternion.w
    );

    // Apply joint rotations
    this.mainBody.rotation.y = this.mainBodyRotation;
    this.arm1.rotation.x = this.arm1Angle;
    this.arm2.rotation.x = this.arm2Angle;
    this.bucket.rotation.x = this.bucketAngle;
    this.thumb.rotation.x = this.thumbAngle;
    
    // Update blade position
    this.blade.position.y = this.TREAD_HEIGHT + this.BLADE_HEIGHT / 2 + this.bladeHeight;

    // Update physics bodies to match visual positions
    this.updatePhysicsBodies();

    // Update debug wireframes to match physics bodies
    this.updateDebugWireframes();
  }

  private updateDebugWireframes(): void {
    // Update chassis wireframe
    this.debugWireframes[0].position.set(
      this.physicsBody.position.x - this.group.position.x,
      this.physicsBody.position.y - this.group.position.y,
      this.physicsBody.position.z - this.group.position.z
    );
    this.debugWireframes[0].quaternion.set(
      this.physicsBody.quaternion.x,
      this.physicsBody.quaternion.y,
      this.physicsBody.quaternion.z,
      this.physicsBody.quaternion.w
    );

    // Update blade wireframe
    this.debugWireframes[1].position.set(
      this.bladeBody.position.x - this.group.position.x,
      this.bladeBody.position.y - this.group.position.y,
      this.bladeBody.position.z - this.group.position.z
    );
    this.debugWireframes[1].quaternion.set(
      this.bladeBody.quaternion.x,
      this.bladeBody.quaternion.y,
      this.bladeBody.quaternion.z,
      this.bladeBody.quaternion.w
    );

    // Update main body wireframe
    this.debugWireframes[2].position.set(
      this.mainBodyPhysics.position.x - this.group.position.x,
      this.mainBodyPhysics.position.y - this.group.position.y,
      this.mainBodyPhysics.position.z - this.group.position.z
    );
    this.debugWireframes[2].quaternion.set(
      this.mainBodyPhysics.quaternion.x,
      this.mainBodyPhysics.quaternion.y,
      this.mainBodyPhysics.quaternion.z,
      this.mainBodyPhysics.quaternion.w
    );

    // Update arm1 part 1 wireframe
    this.debugWireframes[3].position.set(
      this.arm1Part1Body.position.x - this.group.position.x,
      this.arm1Part1Body.position.y - this.group.position.y,
      this.arm1Part1Body.position.z - this.group.position.z
    );
    this.debugWireframes[3].quaternion.set(
      this.arm1Part1Body.quaternion.x,
      this.arm1Part1Body.quaternion.y,
      this.arm1Part1Body.quaternion.z,
      this.arm1Part1Body.quaternion.w
    );

    // Update arm1 part 2 wireframe
    this.debugWireframes[4].position.set(
      this.arm1Part2Body.position.x - this.group.position.x,
      this.arm1Part2Body.position.y - this.group.position.y,
      this.arm1Part2Body.position.z - this.group.position.z
    );
    this.debugWireframes[4].quaternion.set(
      this.arm1Part2Body.quaternion.x,
      this.arm1Part2Body.quaternion.y,
      this.arm1Part2Body.quaternion.z,
      this.arm1Part2Body.quaternion.w
    );

    // Update arm2 wireframe
    this.debugWireframes[5].position.set(
      this.arm2Body.position.x - this.group.position.x,
      this.arm2Body.position.y - this.group.position.y,
      this.arm2Body.position.z - this.group.position.z
    );
    this.debugWireframes[5].quaternion.set(
      this.arm2Body.quaternion.x,
      this.arm2Body.quaternion.y,
      this.arm2Body.quaternion.z,
      this.arm2Body.quaternion.w
    );

    // Update bucket wireframe
    this.debugWireframes[6].position.set(
      this.bucketBody.position.x - this.group.position.x,
      this.bucketBody.position.y - this.group.position.y,
      this.bucketBody.position.z - this.group.position.z
    );
    this.debugWireframes[6].quaternion.set(
      this.bucketBody.quaternion.x,
      this.bucketBody.quaternion.y,
      this.bucketBody.quaternion.z,
      this.bucketBody.quaternion.w
    );

    // Update thumb wireframe
    this.debugWireframes[7].position.set(
      this.thumbBody.position.x - this.group.position.x,
      this.thumbBody.position.y - this.group.position.y,
      this.thumbBody.position.z - this.group.position.z
    );
    this.debugWireframes[7].quaternion.set(
      this.thumbBody.quaternion.x,
      this.thumbBody.quaternion.y,
      this.thumbBody.quaternion.z,
      this.thumbBody.quaternion.w
    );
  }

  private updatePhysicsBodies(): void {
    // Helper to get world position and quaternion
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();

    // Update blade physics body
    this.blade.getWorldPosition(worldPos);
    this.blade.getWorldQuaternion(worldQuat);
    this.bladeBody.position.set(worldPos.x, worldPos.y, worldPos.z);
    this.bladeBody.quaternion.set(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w);

    // Update main body physics - use the first child (the base mesh) for position
    const mainBodyBase = this.mainBody.children[0];
    mainBodyBase.getWorldPosition(worldPos);
    mainBodyBase.getWorldQuaternion(worldQuat);
    this.mainBodyPhysics.position.set(worldPos.x, worldPos.y, worldPos.z);
    this.mainBodyPhysics.quaternion.set(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w);

    // Update arm1 part 1 physics body
    const arm1Part1 = this.arm1.children[0] as THREE.Mesh;
    arm1Part1.getWorldPosition(worldPos);
    arm1Part1.getWorldQuaternion(worldQuat);
    // Offset to center of arm1 part 1 in world space (geometry is translated)
    const arm1SegmentLength = this.ARM1_LENGTH / 2;
    const arm1Part1Offset = new THREE.Vector3(0, arm1SegmentLength / 2, 0);
    arm1Part1Offset.applyQuaternion(worldQuat);
    worldPos.add(arm1Part1Offset);
    this.arm1Part1Body.position.set(worldPos.x, worldPos.y, worldPos.z);
    this.arm1Part1Body.quaternion.set(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w);

    // Update arm1 part 2 physics body
    const arm1Part2 = arm1Part1.children[0] as THREE.Mesh;
    arm1Part2.getWorldPosition(worldPos);
    arm1Part2.getWorldQuaternion(worldQuat);
    // Offset to center of arm1 part 2 in world space (geometry is translated)
    const arm1Part2Offset = new THREE.Vector3(0, arm1SegmentLength / 2, 0);
    arm1Part2Offset.applyQuaternion(worldQuat);
    worldPos.add(arm1Part2Offset);
    this.arm1Part2Body.position.set(worldPos.x, worldPos.y, worldPos.z);
    this.arm1Part2Body.quaternion.set(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w);

    // Update arm2 physics body
    this.arm2.getWorldPosition(worldPos);
    this.arm2.getWorldQuaternion(worldQuat);
    // Offset to center of arm2 in world space
    const arm2Offset = new THREE.Vector3(0, this.ARM2_LENGTH / 2, 0);
    arm2Offset.applyQuaternion(worldQuat);
    worldPos.add(arm2Offset);
    this.arm2Body.position.set(worldPos.x, worldPos.y, worldPos.z);
    this.arm2Body.quaternion.set(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w);

    // Update bucket physics body
    this.bucket.getWorldPosition(worldPos);
    this.bucket.getWorldQuaternion(worldQuat);
    // Bucket geometry is already translated, so position should be correct
    const bucketOffset = new THREE.Vector3(0, this.BUCKET_SIZE * this.BUCKET_HEIGHT_MULT / 2, this.BUCKET_SIZE / 2);
    bucketOffset.applyQuaternion(worldQuat);
    worldPos.add(bucketOffset);
    this.bucketBody.position.set(worldPos.x, worldPos.y, worldPos.z);
    this.bucketBody.quaternion.set(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w);

    // Update thumb physics body
    this.thumb.getWorldPosition(worldPos);
    this.thumb.getWorldQuaternion(worldQuat);
    // Thumb geometry is translated, account for that
    const thumbOffset = new THREE.Vector3(0, -this.THUMB_LENGTH / 2, 0);
    thumbOffset.applyQuaternion(worldQuat);
    worldPos.add(thumbOffset);
    this.thumbBody.position.set(worldPos.x, worldPos.y, worldPos.z);
    this.thumbBody.quaternion.set(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w);
  }

  // Control methods
  public setMainBodyRotation(delta: number): void {
    this.mainBodyRotation += delta;
  }

  public setArm1Angle(delta: number): void {
    const oldAngle = this.arm1Angle;
    this.arm1Angle = THREE.MathUtils.clamp(this.arm1Angle + delta, this.ARM1_MIN_ANGLE, this.ARM1_MAX_ANGLE);
    // Only flag as at limit if input was provided but angle didn't change due to clamping
    this.arm1AtLimit = delta !== 0 && this.arm1Angle === oldAngle;
  }

  public setArm2Angle(delta: number): void {
    const oldAngle = this.arm2Angle;
    this.arm2Angle = THREE.MathUtils.clamp(this.arm2Angle + delta, this.ARM2_MIN_ANGLE, this.ARM2_MAX_ANGLE);
    this.arm2AtLimit = delta !== 0 && this.arm2Angle === oldAngle;
  }

  public setBucketAngle(delta: number): void {
    const oldAngle = this.bucketAngle;
    this.bucketAngle = THREE.MathUtils.clamp(this.bucketAngle + delta, this.BUCKET_MIN_ANGLE, this.BUCKET_MAX_ANGLE);
    this.bucketAtLimit = delta !== 0 && this.bucketAngle === oldAngle;
  }

  public setThumbAngle(delta: number): void {
    const oldAngle = this.thumbAngle;
    this.thumbAngle = THREE.MathUtils.clamp(this.thumbAngle + delta, this.THUMB_MIN_ANGLE, this.THUMB_MAX_ANGLE);
    this.thumbAtLimit = delta !== 0 && this.thumbAngle === oldAngle;
  }

  public setBladeHeight(delta: number): void {
    const oldHeight = this.bladeHeight;
    this.bladeHeight = THREE.MathUtils.clamp(this.bladeHeight + delta, this.BLADE_MIN_HEIGHT, this.BLADE_MAX_HEIGHT);
    this.bladeAtLimit = delta !== 0 && this.bladeHeight === oldHeight;
  }

  public applyTreadForces(leftSpeed: number, rightSpeed: number): void {
    const forceStrength = 1500;
    const torqueStrength = 200;

    // Get forward direction in world space
    const forward = new CANNON.Vec3(0, 0, 1);
    this.physicsBody.quaternion.vmult(forward, forward);

    // Calculate average speed for forward movement
    const avgSpeed = (leftSpeed + rightSpeed) / 2;
    const force = forward.scale(avgSpeed * forceStrength);

    // Apply force at center of mass
    this.physicsBody.applyForce(force);

    // Calculate differential for turning
    const diff = rightSpeed - leftSpeed;
    const torque = new CANNON.Vec3(0, diff * torqueStrength, 0);
    this.physicsBody.applyTorque(torque);
  }

  // Getter methods for telemetry display
  public getMainBodyRotation(): number {
    return this.mainBodyRotation;
  }

  public getArm1Angle(): number {
    return this.arm1Angle;
  }

  public getArm2Angle(): number {
    return this.arm2Angle;
  }

  public getBucketAngle(): number {
    return this.bucketAngle;
  }

  public getThumbAngle(): number {
    return this.thumbAngle;
  }

  public getBladeHeight(): number {
    return this.bladeHeight;
  }

  // Store tread forces for display
  private leftTreadForce: number = 0;
  private rightTreadForce: number = 0;

  public getLeftTreadForce(): number {
    return this.leftTreadForce;
  }

  public getRightTreadForce(): number {
    return this.rightTreadForce;
  }

  public setTreadForces(leftSpeed: number, rightSpeed: number): void {
    this.leftTreadForce = leftSpeed;
    this.rightTreadForce = rightSpeed;
  }

  // Track limit states for visual feedback
  private arm1AtLimit: boolean = false;
  private arm2AtLimit: boolean = false;
  private bucketAtLimit: boolean = false;
  private thumbAtLimit: boolean = false;
  private bladeAtLimit: boolean = false;

  public isArm1AtLimit(): boolean {
    return this.arm1AtLimit;
  }

  public isArm2AtLimit(): boolean {
    return this.arm2AtLimit;
  }

  public isBucketAtLimit(): boolean {
    return this.bucketAtLimit;
  }

  public isThumbAtLimit(): boolean {
    return this.thumbAtLimit;
  }

  public isBladeAtLimit(): boolean {
    return this.bladeAtLimit;
  }

  // Physics debug data getters
  public getCollisionEvents(): Map<string, CollisionData> {
    return this.collisionEvents;
  }

  public getTotalCollisions(): number {
    return this.totalCollisions;
  }

  public getFrameCollisions(): number {
    return this.frameCollisions;
  }

  public resetFrameCollisions(): void {
    this.frameCollisions = 0;
    // Mark old collision events as inactive (older than 100ms)
    const now = Date.now();
    this.collisionEvents.forEach((data, key) => {
      if (now - data.timestamp > 100) {
        data.isActive = false;
      }
    });
  }

  public getChassisVelocity(): { linear: { x: number; y: number; z: number }; angular: { x: number; y: number; z: number } } {
    return {
      linear: {
        x: this.physicsBody.velocity.x,
        y: this.physicsBody.velocity.y,
        z: this.physicsBody.velocity.z
      },
      angular: {
        x: this.physicsBody.angularVelocity.x,
        y: this.physicsBody.angularVelocity.y,
        z: this.physicsBody.angularVelocity.z
      }
    };
  }
}
