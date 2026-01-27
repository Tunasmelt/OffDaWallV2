export default function Loading() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="h-12 w-48 bg-muted animate-pulse" />
            <div className="h-8 w-32 bg-muted animate-pulse" />
          </div>
        </div>
      </header>

      {/* Hero Skeleton */}
      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="grid md:grid-cols-[300px,1fr] lg:grid-cols-[400px,1fr] gap-12">
            {/* Image Skeleton */}
            <div className="aspect-square bg-muted animate-pulse" />
            
            {/* Info Skeleton */}
            <div className="space-y-6">
              <div className="h-20 bg-muted animate-pulse w-3/4" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 bg-muted animate-pulse" />
                ))}
              </div>
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 w-20 bg-muted animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bio Skeleton */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-4xl">
          <div className="h-10 bg-muted animate-pulse w-48 mb-8" />
          <div className="space-y-3">
            <div className="h-6 bg-muted animate-pulse w-full" />
            <div className="h-6 bg-muted animate-pulse w-full" />
            <div className="h-6 bg-muted animate-pulse w-3/4" />
          </div>
        </div>
      </section>

      {/* Timeline Skeleton */}
      <section className="container mx-auto px-4 py-12 md:py-16 border-t border-border">
        <div className="max-w-4xl">
          <div className="h-10 bg-muted animate-pulse w-64 mb-12" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
