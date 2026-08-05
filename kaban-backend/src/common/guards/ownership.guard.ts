import { Injectable, CanActivate, ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OWNERSHIP_KEY, OwnershipOptions } from '../decorators/check-ownership.decorator';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.getAllAndOverride<OwnershipOptions>(OWNERSHIP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!opts) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const id = req.params[opts.idParam];

    const resource = await opts.model.findByPk(id);
    if (!resource) throw new NotFoundException();

    const ownerField = opts.ownerField ?? 'userId';
    const isOwner = resource[ownerField] === user.id;
    const bypass = opts.bypassRoles?.includes(user.role) ?? false;
    if (!isOwner && !bypass) throw new NotFoundException();

    req.resource = resource;
    return true;
  }
}
