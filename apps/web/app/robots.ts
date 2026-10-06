import type { MetadataRoute } from 'next';
import { siteUrl } from '@/site/i18n';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/dev/', '/demo/', '/onboarding/', '/firmar/', '/inicio', '/obras', '/pagos', '/cuenta', '/notificaciones', '/red', '/perfil', '/sync', '/ar'] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
