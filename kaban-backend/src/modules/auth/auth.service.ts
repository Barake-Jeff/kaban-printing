import {
  Injectable, Logger, UnauthorizedException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserRole } from '../users/models/user.model';
import { RefreshToken } from './models/refresh-token.model';
import { PasswordResetRequest, PasswordResetRequestStatus } from './models/password-reset-request.model';
import { CustomerRegisterDto } from './dto/customer-register.dto';
import { CustomerLoginDto } from './dto/customer-login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { normalizeKenyanPhone } from '../../common/utils/phone.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(RefreshToken)
    private readonly refreshTokenModel: typeof RefreshToken,
    @InjectModel(PasswordResetRequest)
    private readonly passwordResetRequestModel: typeof PasswordResetRequest,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: CustomerRegisterDto) {
    const phone = this.normalizePhone(dto.phone);
    const existing = await this.userModel.findOne({ where: { phone } });
    if (existing) throw new ConflictException('Phone number already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.userModel.create({
      name: dto.name, phone, houseNumber: dto.houseNumber,
      estate: dto.estate, passwordHash, role: UserRole.CUSTOMER,
    });
    return this.issueTokens(user);
  }

  async login(dto: CustomerLoginDto) {
    const phone = this.normalizePhone(dto.phone);
    const user = await this.userModel.findOne({ where: { phone } });

    // A single generic message covers "no such user", "wrong password", and
    // "right password but wrong portal" — distinguishing the last one would
    // leak which "kind" of account a phone number belongs to.
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash)) || user.role !== UserRole.CUSTOMER) {
      throw new UnauthorizedException('Invalid phone number or password');
    }
    if (!user.active) {
      throw new UnauthorizedException('Account is deactivated. Contact an administrator.');
    }
    return this.issueTokens(user);
  }

  async adminLogin(dto: AdminLoginDto) {
    const phone = this.normalizePhone(dto.phone);
    const user = await this.userModel.findOne({ where: { phone } });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash)) || user.role === UserRole.CUSTOMER) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.active) {
      throw new UnauthorizedException('Account is deactivated. Contact an administrator.');
    }
    return this.issueTokens(user);
  }

  async createStaff(dto: CreateStaffDto, requestingUser: User) {
    if (requestingUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can create staff accounts');
    }
    const phone = this.normalizePhone(dto.phone);
    const existing = await this.userModel.findOne({ where: { phone } });
    if (existing) throw new ConflictException('Phone number already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.userModel.create({
      name: dto.name, phone, houseNumber: 'N/A',
      estate: 'N/A', passwordHash, role: dto.role,
    });

    const { passwordHash: _, ...safeUser } = user.toJSON();
    return safeUser;
  }

  async refresh(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    // Look up regardless of `revoked` so we can tell "never existed" apart
    // from "already used" — the latter is a replay signal, not just an error.
    const stored = await this.refreshTokenModel.findOne({ where: { tokenHash } });
    if (!stored) throw new UnauthorizedException('Invalid or expired refresh token');

    if (stored.revoked) {
      // This token was already rotated out. Someone is presenting a used
      // token — treat it as theft and kill every other session for this user.
      await this.refreshTokenModel.update(
        { revoked: true },
        { where: { userId: stored.userId, revoked: false } },
      );
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userModel.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('Invalid or expired refresh token');
    if (!user.active) throw new UnauthorizedException('Account is deactivated. Contact an administrator.');

    // Rotate: the presented token is single-use — revoke it and issue a fresh pair.
    await stored.update({ revoked: true });
    const accessToken = this.issueAccessToken(user);
    const newRefreshToken = await this.issueRefreshToken(user);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.refreshTokenModel.update({ revoked: true }, { where: { tokenHash } });
    return { success: true };
  }

  // Interim flow: no self-service reset yet. This just queues a request for
  // an admin to handle via PATCH /admin/users/:id/password. Always returns
  // the same generic message so the response itself can't be used to check
  // whether a phone number is registered.
  async forgotPassword(dto: ForgotPasswordDto) {
    const phone = this.normalizePhone(dto.phone);
    const user = await this.userModel.findOne({ where: { phone } });

    if (user) {
      const existing = await this.passwordResetRequestModel.findOne({
        where: { userId: user.id, status: PasswordResetRequestStatus.PENDING },
      });
      if (!existing) {
        await this.passwordResetRequestModel.create({ userId: user.id });
        this.logger.log(`Password reset requested for userId=${user.id}`);
      }
    }

    return {
      success: true,
      message: 'If that phone number is registered, our team will reach out to help reset your password.',
    };
  }

  private async issueTokens(user: User) {
    const accessToken  = this.issueAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user);
    const { passwordHash, ...safeUser } = user.toJSON();
    return { accessToken, refreshToken, user: safeUser };
  }

  private issueAccessToken(user: User): string {
    return this.jwtService.sign(
      { sub: user.id, role: user.role, phone: user.phone },
      { secret: this.config.get('JWT_ACCESS_SECRET'), expiresIn: '1h' },
    );
  }

  private async issueRefreshToken(user: User): Promise<string> {
    // jti guarantees a unique token string even if issued for the same user
    // within the same second (iat has only second precision) — without it,
    // two refresh tokens minted back-to-back (e.g. login immediately
    // followed by a refresh call) can be byte-identical, which collides with
    // the UNIQUE constraint on token_hash.
    const token = this.jwtService.sign(
      { sub: user.id, jti: crypto.randomUUID() },
      { secret: this.config.get('JWT_REFRESH_SECRET'), expiresIn: '30d' },
    );
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.refreshTokenModel.create({ userId: user.id, tokenHash, expiresAt });
    return token;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Login DTOs deliberately carry no format rule, so this is the only thing
  // making "+254712345678" / "254 712 345 678" match a stored "0712345678".
  private normalizePhone(phone: string): string {
    return normalizeKenyanPhone(phone) as string;
  }
}
