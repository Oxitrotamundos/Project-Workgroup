import { NestFactory } from '@nestjs/core';
import { readFileSync } from 'node:fs';
import { AppModule } from '../app.module';
import { buildOpenApiDocument } from '../swagger';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const fresh = JSON.stringify(buildOpenApiDocument(app), null, 2);
  await app.close();
  const committed = readFileSync('openapi.json', 'utf8').trim();
  if (fresh.trim() !== committed) {
    console.error(
      'OpenAPI drift: run "npm run api:openapi:dump" and commit the result.',
    );
    process.exit(1);
  }
  console.log('OpenAPI in sync.');
}
main();
