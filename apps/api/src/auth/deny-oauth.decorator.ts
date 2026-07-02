import { SetMetadata } from '@nestjs/common';

export const DENY_OAUTH_KEY = 'denyOAuth';

// Marca una ruta/controller donde un principal via:'oauth' no debe entrar
// (rutas que acuñan credenciales o elevan privilegio). Lo aplica OAuthCapabilityGuard.
export const DenyOAuth = () => SetMetadata(DENY_OAUTH_KEY, true);
