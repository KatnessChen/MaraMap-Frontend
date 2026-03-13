import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

// --- API Data Interfaces ---
interface Media {
  lat: number | null;
  lng: number | null;
  uri: string;
  type: string;
  taken_at: number;
}

interface Post {
  id: string;
  event_date: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  media?: Media[];
}

// --- Helper Functions ---
function getDisplayTitle(post: Post) {
  const match = post.content.match(/^\[(.*?)\]/);
  if (match) return match[1];
  if (post.tags && post.tags.length > 0) return post.tags.slice(0, 2).join(" • ");
  const firstLine = post.content.split('\n')[0].trim();
  return firstLine || "MaraMap 運動日誌";
}

function getDisplayContent(post: Post) {
  const match = post.content.match(/^\[(.*?)\]/);
  let text = post.content;
  if (match) {
      text = text.replace(match[0], '').trim();
  }
  return text;
}

function extractCoordinates(media: Media[] | undefined) {
  if (!media || media.length === 0) return null;
  // Find the first media with valid coordinates
  const loc = media.find(m => m.lat !== null && m.lng !== null);
  if (loc) {
    return `${loc.lat?.toFixed(4)}° N, ${loc.lng?.toFixed(4)}° E`;
  }
  return null;
}

// Next.js dynamic route segment component
export default async function LogDetail({ params }: { params: { id: string } }) {
  // Await the params object before accessing its properties (Next.js 15 requirement)
  const { id } = await params;
  
  let post: Post | null = null;
  
  try {
    const res = await fetch(`http://127.0.0.1:3000/api/v1/posts/${id}`, { 
      cache: 'no-store' 
    });
    if (res.ok) {
      post = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch post detail:", error);
  }

  if (!post) {
    notFound();
  }

  const title = getDisplayTitle(post);
  const content = getDisplayContent(post);
  const coords = extractCoordinates(post.media);

  return (
    <main className="min-h-screen relative overflow-x-hidden pb-24 bg-paper">
      
      {/* Background Topo */}
      <div 
        className="fixed top-0 left-0 w-screen h-screen -z-10 pointer-events-none mix-blend-multiply opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 100 Q 150 200 400 50' fill='none' stroke='%231a1a1a' stroke-width='0.5'/%3E%3Cpath d='M0 200 Q 200 300 400 150' fill='none' stroke='%231a1a1a' stroke-width='0.5'/%3E%3Cpath d='M0 300 Q 250 400 400 250' fill='none' stroke='%231a1a1a' stroke-width='0.5'/%3E%3C/svg%3E")`
        }}
      />

      {/* Map Viewport (Abstract Simulation) */}
      <div className="w-full h-[40vh] md:h-[50vh] bg-paper-dark border-b-[6px] border-brand relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%231a1a1a' stroke-width='0.5' stroke-opacity='0.2'%3E%3Cpath d='M0 100h400M0 200h400M0 300h400M100 0v400M200 0v400M300 0v400'/%3E%3C/g%3E%3Cpath d='M80 320 Q 150 200 200 150 T 320 80' stroke='%23E63946' stroke-width='4' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='80' cy='320' r='6' fill='%231a1a1a'/%3E%3Ccircle cx='320' cy='80' r='6' fill='%23E63946'/%3E%3C/svg%3E")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        {coords && (
          <div className="absolute bottom-4 right-4 bg-ink text-white font-mono text-xs px-3 py-1 tracking-widest shadow-lg">
            {coords}
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto -mt-10 relative z-10">
        <div className="bg-paper p-6 md:p-12 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] border-t border-line">
          
          <Link href="/" className="inline-flex items-center gap-2 text-ink-light hover:text-brand font-mono text-sm uppercase tracking-widest mb-8 transition-colors">
            <ArrowLeft size={16} />
            Back to Log
          </Link>

          <header className="mb-12">
            <div className="font-mono text-xs md:text-sm text-brand uppercase tracking-[0.15em] mb-4 flex flex-wrap gap-2 items-center">
              <span>{post.category || 'LOG'}</span>
              <span className="text-line">•</span>
              <span>{post.event_date}</span>
            </div>
            <h1 className="font-serif text-4xl md:text-5xl font-black leading-[1.2] text-ink mb-6 tracking-tight">
              {title}
            </h1>
            
            {/* Tags array rendering */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-6">
                {post.tags.map((tag, idx) => (
                  <span key={idx} className="border border-line text-ink-light px-3 py-1 text-sm rounded-full bg-white">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </header>

          <article className="prose max-w-none">
            {/* Split content by double newlines to create paragraphs */}
            {content.split('\n\n').map((paragraph, index) => {
              const pText = paragraph.trim();
              if (!pText) return null;
              
              // First paragraph gets the drop-cap treatment
              if (index === 0) {
                return (
                  <p key={index} className="font-sans text-xl text-ink leading-loose text-justify mb-8">
                    <span className="float-left font-serif text-6xl md:text-[80px] leading-[0.8] pt-2 pr-3 pb-0 text-brand font-black">
                      {pText.charAt(0)}
                    </span>
                    {pText.slice(1)}
                  </p>
                );
              }

              // Rendering subsequent paragraphs
              return (
                <p key={index} className="font-sans text-lg md:text-xl text-ink-light leading-relaxed text-justify mb-6 whitespace-pre-wrap">
                  {pText}
                </p>
              );
            })}
          </article>

          {/* Photo Gallery */}
          {post.media && post.media.filter(m => m.type === 'photo').length > 0 && (
            <div className="mt-12 mb-8">
              <h3 className="font-mono text-xs md:text-sm text-ink-light uppercase tracking-widest mb-6 border-b border-line pb-2">
                Captured Moments ({post.media.filter(m => m.type === 'photo').length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {post.media.filter(m => m.type === 'photo').map((photo, idx) => (
                  <div key={idx} className="relative aspect-square overflow-hidden bg-paper-dark border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={photo.uri} 
                      alt={`Moment ${idx + 1}`} 
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Minimalist Data Dashboard Footer */}
          <div className="mt-16 pt-12 border-t border-line grid grid-cols-2 md:grid-cols-4 gap-6">
             <div className="flex flex-col">
              <span className="font-mono text-[10px] text-ink-light uppercase tracking-widest mb-1">AUTHOR</span>
              <span className="font-mono font-bold text-ink">Davis Chen</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[10px] text-ink-light uppercase tracking-widest mb-1">PHOTOS</span>
              <span className="font-mono font-bold text-ink">{post.media?.filter(m => m.type === 'photo').length || 0}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[10px] text-ink-light uppercase tracking-widest mb-1">SOURCE</span>
              <span className="font-mono font-bold text-ink">Facebook</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[10px] text-ink-light uppercase tracking-widest mb-1">ARCHIVED</span>
              <span className="font-mono font-bold text-ink">{new Date().getFullYear()}</span>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
