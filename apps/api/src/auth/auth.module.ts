import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { OAuthMetadataController } from './oauth-metadata.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { ProjectMembershipGuard } from './project-membership.guard';
import { OAuthCapabilityGuard } from './oauth-capability.guard';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [FirebaseModule],
  controllers: [AuthController, OAuthMetadataController],
  providers: [
    AuthService,
    AuthGuard,
    RolesGuard,
    ProjectMembershipGuard,
    OAuthCapabilityGuard,
  ],
  exports: [
    AuthGuard,
    RolesGuard,
    ProjectMembershipGuard,
    OAuthCapabilityGuard,
    FirebaseModule,
  ],
})
export class AuthModule {}
