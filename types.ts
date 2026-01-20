
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface CharacterState {
  position: Vector3;
  rotation: number;
  isMoving: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
