export function ArtistSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-card border border-border overflow-hidden animate-pulse"
          style={{
            transform: `rotate(${i % 3 === 0 ? -2 : i % 3 === 1 ? 1 : -1}deg)`,
          }}
        >
          {/* Image placeholder */}
          <div className="aspect-square bg-muted" />
          
          {/* Content placeholder */}
          <div className="p-4 space-y-2">
            <div className="h-5 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted/60 rounded w-1/2" />
            <div className="flex gap-1 mt-2">
              <div className="h-5 bg-muted/60 rounded w-16" />
              <div className="h-5 bg-muted/60 rounded w-16" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
