import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { AuthModule } from '../auth/auth.module';

@Module({ imports: [AuthModule], controllers: [McpController] })
export class McpModule {}
