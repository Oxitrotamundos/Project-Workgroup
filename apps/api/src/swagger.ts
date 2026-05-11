import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, OpenAPIObject } from '@nestjs/swagger';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Project-Workgroup API')
    .setVersion('1')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT/APIKey' },
      'bearer',
    )
    .build();
  return SwaggerModule.createDocument(app, config);
}

export function mountSwagger(app: INestApplication): OpenAPIObject {
  const doc = buildOpenApiDocument(app);
  SwaggerModule.setup('v1/docs', app, doc, {
    jsonDocumentUrl: 'v1/openapi.json',
  });
  return doc;
}
