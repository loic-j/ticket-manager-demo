import { SignJWT, generateKeyPair } from 'jose';
import { describe, expect, it } from 'vitest';
import { LocalTokenIssuer } from './local-token-issuer.js';

describe('LocalTokenIssuer', () => {
  it('issues access tokens its own verifier accepts', async () => {
    const issuer = await LocalTokenIssuer.create({ defaultAudience: 'https://svc.local' });
    const user = await issuer.verifier.verify(await issuer.token({ sub: 'user_42' }));
    expect(user.sub).toBe('user_42');
    expect(issuer.audience).toBe('https://svc.local');
  });

  it('rejects a wrong audience and a token that is not typed at+jwt', async () => {
    const issuer = await LocalTokenIssuer.create({ defaultAudience: 'https://svc.local' });
    await expect(
      issuer.verifier.verify(await issuer.token({ audience: 'https://other.local' })),
    ).rejects.toThrow();
    const { privateKey } = await generateKeyPair('ES384');
    const idToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES384' })
      .setIssuer(issuer.issuer)
      .setAudience(issuer.audience)
      .setSubject('u')
      .setExpirationTime('5m')
      .sign(privateKey);
    await expect(issuer.verifier.verify(idToken)).rejects.toThrow();
  });
});
