import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { AppModule } from '../app.module';
import { buildOpenApiDocument } from '../swagger';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const doc = buildOpenApiDocument(app);
  writeFileSync('openapi.json', JSON.stringify(doc, null, 2));
  await app.close();
  console.log('wrote apps/api/openapi.json');
}
main();
