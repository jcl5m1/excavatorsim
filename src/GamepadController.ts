export interface GamepadState {
  // Joysticks (analog axes)
  leftStickX: number;      // Yaw rotation of main body
  leftStickY: number;      // Second arm segment angle
  rightStickX: number;     // First arm segment angle
  rightStickY: number;     // Bucket wrist angle
  
  // Triggers (analog)
  leftTrigger: number;     // Left tread forward
  rightTrigger: number;    // Right tread forward
  
  // Shoulder buttons (digital)
  leftBumper: boolean;     // Left tread backward
  rightBumper: boolean;    // Right tread backward
  
  // D-pad
  dpadUp: boolean;         // Rotate thumb up
  dpadDown: boolean;       // Rotate thumb down
  
  // Face buttons
  buttonY: boolean;        // Raise blade
  buttonA: boolean;        // Lower blade
}

export class GamepadController {
  private gamepad: Gamepad | null = null;
  private state: GamepadState;
  private connected: boolean = false;
  private deadzone: number = 0.15;

  constructor() {
    this.state = this.getDefaultState();
    this.setupEventListeners();
  }

  private getDefaultState(): GamepadState {
    return {
      leftStickX: 0,
      leftStickY: 0,
      rightStickX: 0,
      rightStickY: 0,
      leftTrigger: 0,
      rightTrigger: 0,
      leftBumper: false,
      rightBumper: false,
      dpadUp: false,
      dpadDown: false,
      buttonY: false,
      buttonA: false,
    };
  }

  private setupEventListeners(): void {
    window.addEventListener('gamepadconnected', (e) => {
      console.log('Gamepad connected:', e.gamepad);
      this.gamepad = e.gamepad;
      this.connected = true;
      this.updateGamepadStatus(true);
    });

    window.addEventListener('gamepaddisconnected', () => {
      console.log('Gamepad disconnected');
      this.gamepad = null;
      this.connected = false;
      this.state = this.getDefaultState();
      this.updateGamepadStatus(false);
    });
  }

  private updateGamepadStatus(connected: boolean): void {
    const statusElement = document.getElementById('gamepad-status');
    if (statusElement) {
      if (connected) {
        statusElement.textContent = 'Gamepad: Connected';
        statusElement.className = 'connected';
      } else {
        statusElement.textContent = 'Gamepad: Waiting for Input';
        statusElement.className = 'disconnected';
      }
    }
  }

  private applyDeadzone(value: number): number {
    return Math.abs(value) < this.deadzone ? 0 : value;
  }

  public update(): void {
    // Get latest gamepad state
    const gamepads = navigator.getGamepads();
    if (gamepads[0]) {
      this.gamepad = gamepads[0];
    }

    if (!this.gamepad) {
      return;
    }

    const gp = this.gamepad;

    // Axes (analog sticks)
    // Standard gamepad mapping: 0=left X, 1=left Y, 2=right X, 3=right Y
    this.state.leftStickX = -this.applyDeadzone(gp.axes[0] || 0);
    this.state.leftStickY = this.applyDeadzone(gp.axes[1] || 0);
    this.state.rightStickX = this.applyDeadzone(gp.axes[3] || 0);
    this.state.rightStickY = this.applyDeadzone(gp.axes[2] || 0);

    // Triggers (if available as axes, typically axes 6 and 7 or buttons 6 and 7)
    // Try axes first (for Xbox controllers)
    if (gp.axes.length > 6) {
      // Some gamepads report triggers as axes
      this.state.leftTrigger = Math.max(0, (gp.axes[6] || 0) + 1) / 2;
      this.state.rightTrigger = Math.max(0, (gp.axes[7] || 0) + 1) / 2;
    } else {
      // Fallback to buttons 6 and 7
      this.state.leftTrigger = gp.buttons[6]?.value || 0;
      this.state.rightTrigger = gp.buttons[7]?.value || 0;
    }

    // Shoulder buttons (bumpers)
    this.state.leftBumper = gp.buttons[4]?.pressed || false;
    this.state.rightBumper = gp.buttons[5]?.pressed || false;

    // D-pad (buttons 12-15 in standard mapping)
    this.state.dpadUp = gp.buttons[12]?.pressed || false;
    this.state.dpadDown = gp.buttons[13]?.pressed || false;

    // Face buttons
    this.state.buttonA = gp.buttons[0]?.pressed || false;  // A/Cross
    this.state.buttonY = gp.buttons[3]?.pressed || false;  // Y/Triangle
  }

  public getState(): GamepadState {
    return this.state;
  }

  public isConnected(): boolean {
    return this.connected;
  }
}
