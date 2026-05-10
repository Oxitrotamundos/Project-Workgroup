import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const log = req?.log;
    if (log && typeof log.child === 'function') {
      const params = req.params ?? {};
      const body = req.body ?? {};
      const ctx: Record<string, unknown> = {};

      if (req.user?.id) ctx.userId = String(req.user.id);
      if (req.user?.role) ctx.role = req.user.role;
      if (params.projectId) ctx.projectId = String(params.projectId);
      if (params.id) ctx.resourceId = String(params.id);
      if (body.projectId) ctx.projectId = String(body.projectId);

      if (Object.keys(ctx).length > 0) {
        req.log = log.child(ctx);
      }
    }

    return next.handle();
  }
}
