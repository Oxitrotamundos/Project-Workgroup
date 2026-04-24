import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { FirebaseModule } from './firebase/firebase.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { ProjectMembersModule } from './project-members/project-members.module';
import { TasksModule } from './tasks/tasks.module';
import { TaskLinksModule } from './task-links/task-links.module';
import { WorkloadModule } from './workload/workload.module';
import { ApiKeysModule } from './api-keys/api-keys.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, envFilePath: '.env' }),
    FirebaseModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    ProjectMembersModule,
    TasksModule,
    TaskLinksModule,
    WorkloadModule,
    ApiKeysModule,
  ],
})
export class AppModule {}
