import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { UPLOAD_ERRORS } from './storage.constants';

/**
 * Surfaces multer's file-size rejection (LIMIT_FILE_SIZE) as a clean UPLOAD_003
 * envelope. Multer throws a MulterError with `.code`; Nest's FileInterceptor
 * lets it bubble as a 500-ish payload. We normalize it to a 413. All other
 * HttpExceptions (including our own BadRequest UPLOAD_001/002/004) pass through
 * with their existing shape.
 */
@Catch()
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    const code = (exception as { code?: string })?.code;
    if (code === 'LIMIT_FILE_SIZE') {
      return res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        success: false,
        error: {
          code: UPLOAD_ERRORS.TOO_LARGE,
          message: 'File exceeds the maximum allowed size',
        },
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      return res
        .status(status)
        .json(
          typeof body === 'object'
            ? { success: false, error: body }
            : { success: false, error: { message: body } },
        );
    }

    // Unknown error — do not leak internals.
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: { message: 'Upload failed' },
    });
  }
}
