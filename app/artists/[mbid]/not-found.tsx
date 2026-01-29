import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          {/* Logo */}
          <div className="mb-8">
            <Image
              src="/logo-transparent-v2.png"
              alt="OffDaWall"
              width={240}
              height={80}
              className="h-16 w-auto mx-auto"
            />
          </div>

          {/* 404 Error */}
          <div className="mb-8">
            <div 
              className="inline-block text-primary font-bold uppercase text-sm tracking-wider px-4 py-1 border-2 border-primary transform -rotate-2 mb-6"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              Artist Not Found
            </div>
            
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-foreground mb-4">
              404
            </h1>
            
            <p className="text-xl text-muted-foreground leading-relaxed mb-8">
              We couldn't find this artist. They might not be in our database yet,
              or the link might be incorrect.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="px-6 py-3 bg-primary text-primary-foreground font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors"
            >
              Back to Home
            </Link>
            
            <Link
              href="/#genres"
              className="px-6 py-3 bg-card border-2 border-border font-bold uppercase tracking-wider hover:border-primary hover:text-primary transition-colors"
            >
              Explore Genres
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
