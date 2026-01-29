import { Metadata } from 'next';

const siteConfig = {
  name: 'OffDaWall',
  description: 'Discover underground hip-hop artists across every subgenre. From trap to boom bap, drill to cloud rap.',
  url: 'https://offdawall.app',
  ogImage: '/og-image.png',
};

export function generateSEOMetadata({
  title,
  description,
  path = '',
  image,
  noIndex = false,
}: {
  title: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}): Metadata {
  const pageTitle = title === siteConfig.name ? title : `${title} | ${siteConfig.name}`;
  const pageDescription = description || siteConfig.description;
  const pageUrl = `${siteConfig.url}${path}`;
  const pageImage = image || siteConfig.ogImage;

  return {
    title: pageTitle,
    description: pageDescription,
    ...(noIndex && { robots: 'noindex, nofollow' }),
    openGraph: {
      type: 'website',
      url: pageUrl,
      title: pageTitle,
      description: pageDescription,
      siteName: siteConfig.name,
      images: [
        {
          url: pageImage,
          width: 1200,
          height: 630,
          alt: pageTitle,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: pageDescription,
      images: [pageImage],
    },
    alternates: {
      canonical: pageUrl,
    },
  };
}

export function generateArtistMetadata(
  artistName: string,
  bio?: string,
  image?: string,
  mbid?: string
): Metadata {
  return generateSEOMetadata({
    title: artistName,
    description: bio 
      ? `${bio.slice(0, 155)}...`
      : `Explore ${artistName}'s complete discography, biography, and related artists on OffDaWall.`,
    path: mbid ? `/artists/${mbid}` : `/artists/${artistName.toLowerCase().replace(/\s+/g, '-')}`,
    image,
  });
}

export function generateGenreMetadata(genreName: string, description: string, slug?: string): Metadata {
  return generateSEOMetadata({
    title: `${genreName} Artists`,
    description: `${description} Discover top and upcoming ${genreName} artists.`,
    path: slug ? `/genres/${slug}` : `/genres/${genreName.toLowerCase().replace(/\s+/g, '-')}`,
  });
}
