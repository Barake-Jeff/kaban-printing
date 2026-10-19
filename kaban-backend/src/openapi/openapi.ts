import { INestApplication, Type } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ModulesContainer, Reflector } from '@nestjs/core';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { MpesaCallbackGuard } from '../modules/payments/mpesa-callback.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

const { version } = require('../../package.json');

const BEARER = 'bearer';
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/**
 * The OpenAPI document for the whole API (OWASP API9: inventory). Served as Swagger UI outside
 * production and committed as kaban-backend/openapi.json by `npm run openapi`.
 *
 * Request bodies come from the DTOs via the @nestjs/swagger CLI plugin (nest-cli.json).
 * Auth and roles are NOT hand-annotated: they are read back from each route's @UseGuards and
 * @Roles metadata, so the document always shows what is actually enforced.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('PrintEase API')
    .setVersion(version)
    .setDescription([
      'Generated from the code — do not edit by hand (`npm run openapi`).',
      '',
      'Successful responses are wrapped by `TransformInterceptor` as `{ statusCode, message, data }`;',
      'errors are `{ statusCode, message, errors? }`. Each operation lists the guards that protect it.',
    ].join('\n'))
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, BEARER)
    .build();

  const document = SwaggerModule.createDocument(app, config);
  annotateAccess(app, document);
  return sortDocument(document);
}

type Access = { tag: string; security: Array<Record<string, string[]>>; roles?: string[]; notes: string[] };

/** Builds `<Controller>_<method>` → access info, matching @nestjs/swagger's default operationId. */
function collectAccess(app: INestApplication): Map<string, Access> {
  const reflector = new Reflector();
  const access = new Map<string, Access>();

  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype as Type<unknown>;
      if (!controller?.prototype) continue;
      const tag = controller.name.replace(/Controller$/, '');

      for (const methodName of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = controller.prototype[methodName];
        if (methodName === 'constructor' || typeof handler !== 'function') continue;

        const guards: unknown[] = [
          ...(Reflect.getMetadata(GUARDS_METADATA, controller) ?? []),
          ...(Reflect.getMetadata(GUARDS_METADATA, handler) ?? []),
        ];
        const has = (guard: unknown) => guards.includes(guard);
        // Same override rule RolesGuard uses: a method-level @Roles replaces the class-level one.
        const roles = reflector.getAllAndOverride<string[]>(ROLES_KEY, [handler, controller]);

        const notes: string[] = [];
        if (has(JwtAuthGuard)) notes.push('Requires a signed-in user (bearer access token).');
        else notes.push('**Public**: no sign-in required.');
        if (roles?.length) {
          notes.push(has(RolesGuard)
            ? `Roles: ${roles.join(', ')}.`
            : `⚠️ @Roles(${roles.join(', ')}) is set but RolesGuard is not applied, so it is NOT enforced.`);
        }
        if (has(OwnershipGuard)) notes.push('Owner only (staff bypass).');
        if (has(MpesaCallbackGuard)) notes.push('Daraja only: secret URL token + Safaricom source IPs.');

        access.set(`${controller.name}_${methodName}`, {
          tag,
          security: has(JwtAuthGuard) ? [{ [BEARER]: [] }] : [],
          roles: roles?.length && has(RolesGuard) ? roles : undefined,
          notes,
        });
      }
    }
  }
  return access;
}

function annotateAccess(app: INestApplication, document: OpenAPIObject) {
  const access = collectAccess(app);
  for (const pathItem of Object.values(document.paths)) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      const info = op?.operationId && access.get(op.operationId);
      if (!op || !info) continue;
      op.tags = [info.tag];
      op.security = info.security;
      if (info.roles) op['x-roles'] = info.roles;
      op.description = [op.description, ...info.notes].filter(Boolean).join('\n\n');
    }
  }
}

/** Stable key order so regenerating the snapshot only produces a diff when the API changes. */
function sortDocument(document: OpenAPIObject): OpenAPIObject {
  const sortKeys = <T extends object>(obj: T): T =>
    Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))) as T;

  document.paths = sortKeys(document.paths);
  if (document.components?.schemas) document.components.schemas = sortKeys(document.components.schemas);
  const tags = new Set<string>();
  for (const item of Object.values(document.paths)) {
    for (const method of HTTP_METHODS) item[method]?.tags?.forEach(t => tags.add(t));
  }
  document.tags = [...tags].sort().map(name => ({ name }));
  return document;
}
