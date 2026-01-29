'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { getAllGenres } from '@/lib/genres';

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const genres = getAllGenres();

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-background/95 backdrop-blur"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu Panel */}
          <div className="absolute inset-y-0 right-0 w-full max-w-sm bg-card border-l border-border overflow-y-auto">
            <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between z-10">
              <Image
                src="/logo-transparent-v2.png"
                alt="OffDaWall"
                width={120}
                height={40}
                className="h-8 w-auto"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-4 space-y-6">
              {/* Navigation Links */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Navigation
                </h3>
                <div className="space-y-1">
                  <Link
                    href="/"
                    onClick={() => setIsOpen(false)}
                    className="block px-3 py-2 rounded hover:bg-muted transition-colors"
                  >
                    Home
                  </Link>
                  <Link
                    href="/#genres"
                    onClick={() => setIsOpen(false)}
                    className="block px-3 py-2 rounded hover:bg-muted transition-colors"
                  >
                    Genres
                  </Link>
                  <Link
                    href="/#about"
                    onClick={() => setIsOpen(false)}
                    className="block px-3 py-2 rounded hover:bg-muted transition-colors"
                  >
                    About
                  </Link>
                </div>
              </div>

              {/* Genre Links */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Explore Genres
                </h3>
                <div className="space-y-1">
                  {genres.map((genre) => (
                    <Link
                      key={genre.slug}
                      href={`/genres/${genre.slug}`}
                      onClick={() => setIsOpen(false)}
                      className="block px-3 py-2 rounded hover:bg-muted transition-colors"
                    >
                      {genre.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
