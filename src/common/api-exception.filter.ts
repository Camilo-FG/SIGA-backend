import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : null;
    const message = raw && typeof raw === 'object' && 'message' in raw ? (raw as { message: string | string[] }).message : exception instanceof HttpException ? exception.message : 'Ocurrió un error interno.';
    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message : [message],
      error: HttpStatus[status] ?? 'Error',
    });
  }
}
