import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../app.module';
import { buildOpenApiDocument } from './openapi';

// Writes kaban-backend/openapi.json, the committed inventory of every route (OWASP API9).
// Run via `npm run openapi` (it builds first, so the @nestjs/swagger CLI plugin has added the
// DTO metadata). Preview mode wires up modules and controllers without instantiating
// providers, so no database or MinIO is needed — only a valid .env for env validation.
async function generate() {
  const app = await NestFactory.create(AppModule, { preview: true, logger: ['error'] });
  app.setGlobalPrefix('api'); // keep in step with main.ts

  const document = buildOpenApiDocument(app);
  const out = join(__dirname, '..', '..', 'openapi.json');
  writeFileSync(out, JSON.stringify(document, null, 2) + '\n');

  const operations = Object.values(document.paths).reduce((n, item) => n + Object.keys(item).length, 0);
  console.log(`Wrote ${out} (${operations} operations)`);
  await app.close();
}
generate();
