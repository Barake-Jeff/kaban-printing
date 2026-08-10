# NestJS Patterns & Conventions

> This file defines how every module, controller, service, and DTO must be structured.
> ORM: Sequelize via `@nestjs/sequelize` + `sequelize-typescript` — NOT TypeORM.
> Follow these patterns exactly. Do not invent alternatives.

---

## Module folder structure

Every module follows this exact layout:

```
modules/jobs/
  dto/
    create-job.dto.ts
    update-job-status.dto.ts
  models/
    job.model.ts            ← Sequelize model (NOT "entity")
  jobs.controller.ts
  jobs.service.ts
  jobs.module.ts
```

No exceptions. Guards, decorators, and interceptors live in `common/` and are shared.

---

## Module template

```typescript
// jobs.module.ts
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { Job } from './models/job.model';

@Module({
  imports: [SequelizeModule.forFeature([Job])],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],   // export only if another module needs this service
})
export class JobsModule {}
```

---

## Controller template

Controllers ONLY: receive request, validate (via pipes), call service, return response.
Never write database queries, business logic, or conditional branching in controllers.

```typescript
// jobs.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get('my')
  getMyJobs(@CurrentUser() user) {
    return this.jobsService.findByUser(user.id);
  }

  @Post()
  createJob(@Body() dto: CreateJobDto, @CurrentUser() user) {
    return this.jobsService.create(dto, user.id);
  }

  @Get(':id')
  getJob(@Param('id') id: string, @CurrentUser() user) {
    return this.jobsService.findOne(id, user.id);
  }
}
```

---

## Service template

Services contain ALL business logic. One service per module.
Inject models via `@InjectModel()`. Never use static methods.

```typescript
// jobs.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Job } from './models/job.model';
import { CreateJobDto } from './dto/create-job.dto';

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(Job)
    private readonly jobModel: typeof Job,
  ) {}

  async findByUser(userId: string): Promise<Job[]> {
    return this.jobModel.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
    });
  }

  async findOne(id: string, userId: string): Promise<Job> {
    const job = await this.jobModel.findOne({ where: { id } });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    if (job.userId !== userId) throw new ForbiddenException();
    return job;
  }

  async create(dto: CreateJobDto, userId: string): Promise<Job> {
    return this.jobModel.create({ ...dto, userId } as any);
  }
}
```

---

## Sequelize model template

Use `sequelize-typescript` decorators. Always use `underscored: true` via `@Table`.
Column names in MySQL are snake_case; TypeScript properties are camelCase (mapped via `field:`).

```typescript
// models/job.model.ts
import {
  Table, Column, Model, DataType, Default, ForeignKey, BelongsTo,
} from 'sequelize-typescript';
import { User } from '../../users/models/user.model';

export enum JobStatus {
  PENDING   = 'pending',
  PRINTING  = 'printing',
  READY     = 'ready',
  DELIVERED = 'delivered',
}

@Table({ tableName: 'jobs', timestamps: true, underscored: true })
export class Job extends Model {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  userId: string;

  @BelongsTo(() => User)
  user: User;

  @Column({ type: DataType.STRING(500), allowNull: true, field: 'file_name' })
  fileName: string;

  @Default('bw')
  @Column({ type: DataType.ENUM('bw', 'color'), allowNull: false, field: 'color_mode' })
  colorMode: string;

  @Default(JobStatus.PENDING)
  @Column({ type: DataType.ENUM(...Object.values(JobStatus)) })
  status: JobStatus;

  @Default(0)
  @Column({ type: DataType.DECIMAL(10, 2) })
  cost: number;
}
```

**Key Sequelize vs TypeORM differences:**

| TypeORM                               | Sequelize equivalent                           |
|---------------------------------------|------------------------------------------------|
| `@InjectRepository(Job)`              | `@InjectModel(Job)`                            |
| `private repo: Repository<Job>`       | `private model: typeof Job`                    |
| `repo.findOne({ where: ... })`        | `model.findOne({ where: ... })`                |
| `repo.create(data)` + `repo.save()`   | `model.create(data)` — saves immediately       |
| `repo.update({ id }, data)`           | `model.update(data, { where: { id } })` — args swapped |
| `getRepositoryToken(Job)`             | `getModelToken(Job)`                           |
| `TypeOrmModule.forFeature([Job])`     | `SequelizeModule.forFeature([Job])`            |
| `*.entity.ts`                         | `*.model.ts`                                   |
| `entities/`                           | `models/`                                      |

---

## DTO template

Every request body needs a DTO. Use class-validator for all validation.
Never use `any` type. Never skip validation decorators.

```typescript
// create-job.dto.ts
import {
  IsString, IsOptional, IsEnum, IsInt, IsPositive, Min, MaxLength,
} from 'class-validator';

export class CreateJobDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;

  @IsInt()
  @IsPositive()
  pages: number;

  @IsInt()
  @Min(1)
  copies: number;

  @IsEnum(['bw', 'color'])
  colorMode: 'bw' | 'color';

  @IsEnum(['single', 'double'])
  sides: 'single' | 'double';

  @IsEnum(['pickup', 'delivery'])
  deliveryType: 'pickup' | 'delivery';

  @IsEnum(['mpesa', 'pay_on_pickup'])
  paymentMethod: 'mpesa' | 'pay_on_pickup';
}
```

---

## Global response interceptor

Place in `common/interceptors/transform.interceptor.ts`.
This wraps every response in the standard envelope automatically.

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => ({
        statusCode: context.switchToHttp().getResponse().statusCode,
        message: 'Success',
        data,
      })),
    );
  }
}
```

Register in `main.ts`:
```typescript
app.useGlobalInterceptors(new TransformInterceptor());
```

---

## Global exception filter

Place in `common/filters/http-exception.filter.ts`.

```typescript
import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus,
} from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? (exception.getResponse() as any).message ?? exception.message
      : 'Internal server error';

    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message[0] : message,
      errors: Array.isArray(message) ? message : undefined,
    });
  }
}
```

Register in `main.ts`:
```typescript
app.useGlobalFilters(new GlobalExceptionFilter());
```

---

## main.ts — always use this exactly

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: config.get('FRONTEND_URL'),
    credentials: true,
  });

  await app.listen(config.get('PORT') ?? 3001);
}
bootstrap();
```

---

## AppModule — current state

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { FilesModule } from './modules/files/files.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PushModule } from './modules/push/push.module';
import { AdminModule } from './modules/admin/admin.module';
// models:
import { User } from './modules/users/models/user.model';
import { RefreshToken } from './modules/auth/models/refresh-token.model';
import { PushSubscription } from './modules/push/models/push-subscription.model';
import { NotificationLog } from './modules/notifications/models/notification-log.model';
import { File } from './modules/files/models/file.model';
import { Job } from './modules/jobs/models/job.model';
import { Payment } from './modules/payments/models/payment.model';
import { Setting } from './modules/admin/models/setting.model';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dialect: 'mysql',
        host:     config.get('DB_HOST'),
        port:     Number(config.get('DB_PORT') ?? 3306),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        models: [User, RefreshToken, PushSubscription, NotificationLog, File, Job, Payment, Setting],
        synchronize:   config.get('NODE_ENV') !== 'production',
        logging:       config.get('NODE_ENV') !== 'production' ? console.log : false,
      }),
    }),
    AuthModule,
    UsersModule,
    JobsModule,
    PaymentsModule,
    FilesModule,
    NotificationsModule,
    PushModule,
    AdminModule,
  ],
})
export class AppModule {}
```

---

## Guards

### JwtAuthGuard — `common/guards/jwt-auth.guard.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

### RolesGuard — `common/guards/roles.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../modules/users/models/user.model';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;
    const { user } = context.switchToHttp().getRequest();
    return required.includes(user.role);
  }
}
```

---

## Decorators

### @CurrentUser() — `common/decorators/current-user.decorator.ts`

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

### @Roles() — `common/decorators/roles.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../modules/users/models/user.model';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

---

## ConfigService usage

Never use `process.env` directly. Always inject ConfigService.

```typescript
constructor(private readonly config: ConfigService) {}

const key = this.config.get<string>('MINIO_ACCESS_KEY');
```

---

## Error throwing conventions

```typescript
throw new NotFoundException('Job not found');
throw new UnauthorizedException('Invalid credentials');
throw new ForbiddenException('You do not own this job');
throw new BadRequestException('Job is already paid');
// Always use NestJS built-in HTTP exceptions — never throw raw Error()
```

---

## Raw SQL (reports / aggregations)

Access the Sequelize instance from any injected model:

```typescript
const sequelize = (this.jobModel as any).sequelize;
const rows = await sequelize.query(
  'SELECT DATE(created_at) as date, SUM(cost) as revenue FROM jobs WHERE ...',
  { type: QueryTypes.SELECT }
);
```

Use `QueryTypes.SELECT` from `sequelize`. Avoid raw SQL everywhere except reporting aggregations.

---

## What the agent must never do

- Never use TypeORM — the project uses Sequelize
- Never use `synchronize: true` in production (only in development)
- Never import a service from another module without exporting it first
- Never use `@Body()` without a typed DTO
- Never catch exceptions silently — always rethrow or log
- Never write a controller method longer than 5 lines
- Never use `process.env` — always use `ConfigService`
- Never add `@Unique` to fields that may share the same value across records (e.g. houseNumber for staff)
