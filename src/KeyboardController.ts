import { GamepadState } from './GamepadController';

export class KeyboardController {
  private state: GamepadState;
  private pressedKeys: Set<string> = new Set();
  
  // Analog value for keyboard controls (simulate analog stick)
  private analogValue: number = 1.0;
  
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
    window.addEventListener('keydown', (e) => {
      this.pressedKeys.add(e.key.toLowerCase());
    });

    window.addEventListener('keyup', (e) => {
      this.pressedKeys.delete(e.key.toLowerCase());
    });

    // Clear all keys when window loses focus
    window.addEventListener('blur', () => {
      this.pressedKeys.clear();
    });
  }

  public update(): void {
    // Reset state
    this.state = this.getDefaultState();

    // Left stick X-axis: A/D for yaw control
    if (this.pressedKeys.has('a')) {
      this.state.leftStickX = this.analogValue;
    }
    if (this.pressedKeys.has('d')) {
      this.state.leftStickX = -this.analogValue;
    }

    // Left stick Y-axis: W/S for second arm segment
    if (this.pressedKeys.has('w')) {
      this.state.leftStickY = this.analogValue;
    }
    if (this.pressedKeys.has('s')) {
      this.state.leftStickY = -this.analogValue;
    }

    // Right stick X-axis: Arrow Up/Down for first arm segment
    if (this.pressedKeys.has('arrowup')) {
      this.state.rightStickX = this.analogValue;
    }
    if (this.pressedKeys.has('arrowdown')) {
      this.state.rightStickX = -this.analogValue;
    }

    // Right stick Y-axis: Arrow Left/Right for bucket angle
    if (this.pressedKeys.has('arrowleft')) {
      this.state.rightStickY = -this.analogValue;
    }
    if (this.pressedKeys.has('arrowright')) {
      this.state.rightStickY = this.analogValue;
    }

    // Left tread: Z forward, X backward
    if (this.pressedKeys.has('z')) {
      this.state.leftTrigger = 1.0;
    }
    if (this.pressedKeys.has('x')) {
      this.state.leftBumper = true;
    }

    // Right tread: / forward, . backward
    if (this.pressedKeys.has('/')) {
      this.state.rightTrigger = 1.0;
    }
    if (this.pressedKeys.has('.')) {
      this.state.rightBumper = true;
    }

    // Thumb rotation: R up (open), F down (close)
    if (this.pressedKeys.has('r')) {
      this.state.dpadUp = true;
    }
    if (this.pressedKeys.has('f')) {
      this.state.dpadDown = true;
    }

    // Blade height: T raise (Y button), G lower (A button)
    if (this.pressedKeys.has('t')) {
      this.state.buttonY = true;
    }
    if (this.pressedKeys.has('g')) {
      this.state.buttonA = true;
    }
  }

  public getState(): GamepadState {
    return this.state;
  }
}
