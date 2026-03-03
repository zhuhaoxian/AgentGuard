export interface CreateUserDto {
  username: string;
  password: string;
  email?: string;
  role?: 'ADMIN' | 'USER';
}

export interface UpdateUserDto {
  email?: string;
  role?: 'ADMIN' | 'USER';
  status?: number;
}

export interface LoginDto {
  username: string;
  password: string;
}

export interface ChangePasswordDto {
  oldPassword: string;
  newPassword: string;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string | null;
  role: string;
  status: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginResponse {
  token: string;
  user: UserResponse;
}
