export class BusinessException extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'BusinessException';
  }
}

export class UnauthorizedException extends BusinessException {
  constructor(message: string = 'Unauthorized') {
    super(401, message);
    this.name = 'UnauthorizedException';
  }
}

export class ForbiddenException extends BusinessException {
  constructor(message: string = 'Forbidden') {
    super(403, message);
    this.name = 'ForbiddenException';
  }
}

export class NotFoundException extends BusinessException {
  constructor(message: string = 'Not Found') {
    super(404, message);
    this.name = 'NotFoundException';
  }
}

export class ValidationException extends BusinessException {
  constructor(message: string = 'Validation Failed', details?: any) {
    super(400, message, details);
    this.name = 'ValidationException';
  }
}
