'use client';

import type { Artist } from '@/lib/types';

interface CareerTimelineProps {
  artist: Artist;
}

export function CareerTimeline({ artist }: CareerTimelineProps) {
  if (!artist.lifeSpan?.begin) {
    return null;
  }

  const startYear = new Date(artist.lifeSpan.begin).getFullYear();
  const endYear = artist.lifeSpan.end ? new Date(artist.lifeSpan.end).getFullYear() : new Date().getFullYear();
  const yearsActive = endYear - startYear;
  const currentYear = new Date().getFullYear();
  const isActive = !artist.lifeSpan.end || endYear >= currentYear - 1;

  return (
    <section className="container mx-auto px-4 py-12 md:py-16 border-t border-border">
      <div className="max-w-4xl">
        {/* Section Header */}
        <div className="mb-12 relative">
          <div 
            className="absolute -top-6 left-0 text-primary font-bold uppercase text-xs tracking-wider transform -rotate-2"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            Timeline →
          </div>
          
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
            Career Journey
          </h2>
        </div>

        {/* Timeline Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-card border-2 border-border p-6">
            <div className="text-sm text-muted-foreground mb-2 uppercase tracking-wider">
              Started
            </div>
            <div className="text-4xl font-black text-foreground">
              {startYear}
            </div>
          </div>
          
          <div className="bg-card border-2 border-border p-6">
            <div className="text-sm text-muted-foreground mb-2 uppercase tracking-wider">
              Years Active
            </div>
            <div className="text-4xl font-black text-primary">
              {yearsActive}+
            </div>
          </div>
          
          <div className="bg-card border-2 border-border p-6">
            <div className="text-sm text-muted-foreground mb-2 uppercase tracking-wider">
              Status
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-primary' : 'bg-muted'}`} />
              <div className="text-2xl font-black text-foreground">
                {isActive ? 'Active' : 'Inactive'}
              </div>
            </div>
          </div>
        </div>

        {/* Visual Timeline */}
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-border" />
          
          <div className="space-y-8 ml-8">
            {/* Start point */}
            <div className="relative">
              <div className="absolute -left-10 top-1 w-4 h-4 bg-primary border-2 border-background rounded-full" />
              <div className="bg-card border border-border p-4">
                <div className="text-sm text-muted-foreground mb-1">
                  Career Started
                </div>
                <div className="text-xl font-bold">{startYear}</div>
              </div>
            </div>

            {/* Active years indicator */}
            <div className="relative">
              <div className="absolute -left-10 top-1 w-4 h-4 bg-muted border-2 border-background rounded-full" />
              <div className="bg-card border border-border p-4">
                <div className="text-sm text-muted-foreground mb-1">
                  Active Period
                </div>
                <div className="text-xl font-bold">{yearsActive} Years</div>
              </div>
            </div>

            {/* Current/End point */}
            <div className="relative">
              <div className={`absolute -left-10 top-1 w-4 h-4 border-2 border-background rounded-full ${isActive ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
              <div className="bg-card border border-border p-4">
                <div className="text-sm text-muted-foreground mb-1">
                  {isActive ? 'Currently' : 'Ended'}
                </div>
                <div className="text-xl font-bold">
                  {isActive ? `${currentYear} - Present` : endYear}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
