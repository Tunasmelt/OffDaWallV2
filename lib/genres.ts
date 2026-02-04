import type { Genre } from './types';

// Hip-hop genre taxonomy with MusicBrainz tags
export const HIPHOP_GENRES: Genre[] = [
  {
    slug: 'trap',
    name: 'Trap',
    description: 'Hard-hitting 808s, hi-hats, and dark atmospheres from the South',
    tags: ['trap', 'trap music', 'southern hip hop'],
  },
  {
    slug: 'drill',
    name: 'Drill',
    description: 'Aggressive, gritty sound from Chicago and UK streets',
    tags: ['drill', 'chicago drill', 'uk drill', 'brooklyn drill'],
  },
  {
    slug: 'boom-bap',
    name: 'Boom Bap',
    description: 'Classic East Coast sound with hard drums and soulful samples',
    tags: ['boom bap', 'east coast hip hop', 'golden age hip hop'],
  },
  {
    slug: 'cloud-rap',
    name: 'Cloud Rap',
    description: 'Ethereal, atmospheric production with dreamy vocals',
    tags: ['cloud rap', 'alternative hip hop', 'experimental hip hop'],
  },
  {
    slug: 'west-coast',
    name: 'West Coast',
    description: 'G-funk grooves and laid-back California vibes',
    tags: ['west coast hip hop', 'g-funk', 'gangsta rap'],
  },
  {
    slug: 'southern',
    name: 'Southern Hip Hop',
    description: 'Dirty South energy, crunk, and bounce from the region',
    tags: ['southern hip hop', 'dirty south', 'crunk', 'bounce'],
  },
  {
    slug: 'underground',
    name: 'Underground',
    description: 'Independent, raw, and uncompromising hip-hop',
    tags: ['underground hip hop', 'backpack rap', 'independent hip hop'],
  },
  {
    slug: 'conscious',
    name: 'Conscious',
    description: 'Socially aware lyrics with political and philosophical themes',
    tags: ['conscious hip hop', 'political hip hop', 'alternative hip hop'],
  },
  {
    slug: 'phonk',
    name: 'Phonk',
    description: 'Memphis-inspired sound with cowbells, samples, and dark vibes',
    tags: ['phonk', 'memphis rap', 'underground hip hop'],
  },
  {
    slug: 'experimental',
    name: 'Experimental',
    description: 'Pushing boundaries with avant-garde production and flows',
    tags: ['experimental hip hop', 'abstract hip hop', 'art rap'],
  },
];

export const TAXONOMY_CACHE_TAG = 'genres:taxonomy';

export function getGenreBySlug(slug: string): Genre | undefined {
  return HIPHOP_GENRES.find(genre => genre.slug === slug);
}

export function getAllGenres(): Genre[] {
  return HIPHOP_GENRES;
}
