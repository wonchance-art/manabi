const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://anatomy-studio.vercel.app';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/guide', '/materials', '/forum', '/viewer/'],
        disallow: ['/admin', '/profile', '/vocab', '/materials/add', '/api/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
