const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://anatomy-studio.vercel.app';

export default function sitemap() {
  return [
    { url: `${BASE_URL}/`,          lastModified: new Date(), changeFrequency: 'monthly',  priority: 1.0 },
    { url: `${BASE_URL}/guide`,     lastModified: new Date(), changeFrequency: 'monthly',  priority: 0.8 },
    { url: `${BASE_URL}/materials`, lastModified: new Date(), changeFrequency: 'daily',    priority: 0.9 },
    { url: `${BASE_URL}/forum`,     lastModified: new Date(), changeFrequency: 'hourly',   priority: 0.7 },
  ];
}
