import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://althy.ch', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://althy.ch/login', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://althy.ch/register', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  ]
}
