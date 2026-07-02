import { json } from 'express';
import type { FirebaseService } from '../firebase/firebase.service';
import type { AuthService } from '../auth/auth.service';

interface Deps {
  firebase: FirebaseService;
  auth: AuthService;
  firebaseWebConfig: Record<string, string>;
}

// Página de login autocontenida: Firebase Web SDK → signInWithPopup → POST del ID token.
function loginPage(uid: string, cfg: Record<string, string>): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>KTP — iniciar sesión</title></head>
<body><button id="go">Entrar con Google</button><p id="err"></p>
<script type="module">
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
const app = initializeApp(${JSON.stringify(cfg)});
const auth = getAuth(app);
document.getElementById('go').onclick = async () => {
  try {
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    const idToken = await cred.user.getIdToken();
    const r = await fetch(location.pathname + '/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      credentials: 'same-origin', body: JSON.stringify({ idToken }),
    });
    if (r.redirected) { location.href = r.url; return; }
    if (!r.ok) { document.getElementById('err').textContent = await r.text(); return; }
    const body = await r.json().catch(() => ({}));
    if (body.redirect) location.href = body.redirect;
  } catch (e) { document.getElementById('err').textContent = String(e); }
};
</script></body></html>`;
}

export function mountOidcInteractions(
  expressApp: any,
  provider: any,
  deps: Deps,
): void {
  // Parser JSON acotado a la interacción: Nest registra su body-parser global en init() (tras
  // app.listen()), que corre DESPUÉS de estos .use() de bootstrap; sin esto req.body sería undefined.
  expressApp.use('/oauth/interaction', json());

  // GET: sirve login o auto-consent según el prompt (el uid queda atado por la cookie de interacción).
  expressApp.get('/oauth/interaction/:uid', async (req: any, res: any) => {
    try {
      const details = await provider.interactionDetails(req, res);
      if (details.prompt.name === 'login') {
        res.set('content-type', 'text/html');
        res.end(loginPage(details.uid, deps.firebaseWebConfig));
        return;
      }
      // consent: se maneja en una task posterior.
      res.status(501).end('consent not implemented');
    } catch (err: any) {
      res.status(500).end(`interaction error: ${err?.message ?? err}`);
    }
  });

  // POST del ID token: valida Firebase, resuelve user.id y finaliza el login.
  // CSRF: interactionDetails exige la cookie de interacción firmada (SameSite=Lax por defecto), así que
  // un POST cross-site no la lleva y esto lanza → 401; además el ID token es un bearer no forjable.
  expressApp.post(
    '/oauth/interaction/:uid/login',
    async (req: any, res: any) => {
      try {
        await provider.interactionDetails(req, res); // valida el uid atado por cookie
        const idToken = req.body?.idToken;
        if (!idToken) {
          res.status(400).end('missing idToken');
          return;
        }
        // Checkpoint de seguridad explícito: verifica el ID token al finalizar el login.
        await deps.firebase.verifyIdToken(idToken);
        const user = await deps.auth.syncFromToken(idToken); // upsert by firebaseUid → user.id
        const redirectTo = await provider.interactionResult(
          req,
          res,
          { login: { accountId: user.id.toString() } },
          { mergeWithLastSubmission: false },
        );
        res.json({ redirect: redirectTo });
      } catch (err: any) {
        res.status(401).end(`login failed: ${err?.message ?? err}`);
      }
    },
  );
}
