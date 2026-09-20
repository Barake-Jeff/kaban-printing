import {
  Injectable, NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as bcrypt from 'bcrypt';
import { User } from './models/user.model';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateNotifPrefsDto } from './dto/update-notif-prefs.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {}

  async getMe(userId: string) {
    const user = await this.userModel.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash, ...safe } = user.toJSON() as any;
    return safe;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userModel.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Explicit allow-list rather than `user.update(dto)` — safety here must
    // not depend on the global ValidationPipe's whitelist config staying
    // correct elsewhere. Only set a key when the client actually sent it:
    // `{ houseNumber: dto.houseNumber }` would still be an own `undefined`
    // key when omitted, which Sequelize would write as NULL.
    const updates: Partial<Pick<User, 'name' | 'houseNumber' | 'estate'>> = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.houseNumber !== undefined) updates.houseNumber = dto.houseNumber;
    if (dto.estate !== undefined) updates.estate = dto.estate;
    await user.update(updates);

    const { passwordHash, ...safe } = user.toJSON() as any;
    return safe;
  }

  async updateNotifPrefs(userId: string, dto: UpdateNotifPrefsDto) {
    const user = await this.userModel.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await user.update({ notifSms: dto.notifSms, notifWhatsapp: dto.notifWhatsapp });
    const { passwordHash, ...safe } = user.toJSON() as any;
    return safe;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await user.update({ passwordHash });
    return { success: true };
  }
}
