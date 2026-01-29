import Image from 'next/image';

export default function Loading() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <Image
          src="/logo-transparent-v2.png"
          alt="OffDaWall"
          width={240}
          height={80}
          className="h-16 w-auto mx-auto mb-8 animate-pulse"
          priority
        />
        <div className="flex items-center gap-2 justify-center">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </main>
  );
}
