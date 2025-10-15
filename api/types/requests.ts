/**
 * API Request Types for Room Operations
 */

export interface CreateRoomRequestBody {
  name: string;
  host_user_id: string;
}

export interface JoinRoomRequestBody {
  room_code: string;
  user_id?: string | null;
  nickname?: string | null;
}

/**
 * Validation helpers
 */
export function validateRoomName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Room name is required' };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Room name cannot be empty' };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: 'Room name must be 50 characters or less' };
  }

  return { valid: true };
}

export function validateRoomCode(code: string): { valid: boolean; error?: string } {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'Room code is required' };
  }

  const cleanCode = code.trim().toUpperCase();
  const codePattern = /^[A-Z0-9]{6}$/;

  if (!codePattern.test(cleanCode)) {
    return { valid: false, error: 'Room code must be 6 alphanumeric characters' };
  }

  return { valid: true };
}

export function validateNickname(nickname: string): { valid: boolean; error?: string } {
  if (!nickname || typeof nickname !== 'string') {
    return { valid: false, error: 'Nickname is required for anonymous users' };
  }

  const trimmed = nickname.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Nickname cannot be empty' };
  }

  if (trimmed.length > 30) {
    return { valid: false, error: 'Nickname must be 30 characters or less' };
  }

  // Basic sanitization - no special characters except spaces, dashes, underscores
  const nicknamePattern = /^[a-zA-Z0-9\s\-_]+$/;
  if (!nicknamePattern.test(trimmed)) {
    return { valid: false, error: 'Nickname can only contain letters, numbers, spaces, dashes, and underscores' };
  }

  return { valid: true };
}
