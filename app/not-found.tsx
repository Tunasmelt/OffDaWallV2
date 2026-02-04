import Link from 'next/link';
import Image from 'next/image';
import { getAllGenres } from '@/lib/genres';

export default function NotFound() {
  const genres = getAllGenres().slice(0, 6);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center">
          {/* Logo */}
          <Link href="/">
            <Image
              src="/logo-transparent-v2.png"
              alt="OffDaWall"
              width={240}
              height={80}
              className="h-16 w-auto mx-auto mb-8"
              priority
            />
          </Link>

          {/* 404 Error */}
          <div className="mb-8">
            <div 
              className="inline-block text-primary font-bold uppercase text-sm tracking-wider px-4 py-1 border-2 border-primary transform -rotate-2 mb-6"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              Error 404
            </div>
            
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-4">
              Page Not Found
            </h1>
            
            <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
              Looks like this track got lost in the mix. Let&apos;s get you back on beat.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link
                href="/"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 font-bold hover:bg-primary/90 transition-colors"
              >
                ← Back to Home
              </Link>
              <Link
                href="/#genres"
                className="inline-flex items-center gap-2 bg-card border-2 border-border px-6 py-3 font-bold hover:border-primary transition-colors"
              >
                Explore Genres
              </Link>
            </div>
          </div>

          {/* Suggested Genres */}
          <div className="mt-16 pt-16 border-t border-border">
            <h2 className="text-2xl font-black mb-8">Explore These Genres Instead</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {genres.map((genre) => (
                <Link
                  key={genre.slug}
                  href={`/genres/${genre.slug}`}
                  className="p-6 bg-card border border-border hover:border-primary transition-colors group"
                >
                  <div className="text-4xl mb-2">♪</div>
                  <div className="font-bold group-hover:text-primary transition-colors">
                    {genre.name}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
