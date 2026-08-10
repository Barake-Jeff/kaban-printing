import { SetMetadata } from '@nestjs/common';
import { ModelCtor } from 'sequelize-typescript';
import { UserRole } from '../../modules/users/models/user.model';

export const OWNERSHIP_KEY = 'ownership';

export interface OwnershipOptions {
  model: ModelCtor;
  idParam: string;
  ownerField?: string;
  bypassRoles?: UserRole[];
}

export const CheckOwnership = (opts: OwnershipOptions) => SetMetadata(OWNERSHIP_KEY, opts);
