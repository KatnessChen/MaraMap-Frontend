import Link from "next/link";
import { ArrowRight } from "lucide-react";

// --- API Data Interfaces ---
interface Post {
  id: string;
  event_date: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
}

interface ApiResponse {
  data: Post[];
  meta: { total: number; limit: number; page: number; last_page: number };
}

// --- Helper Functions ---
function getDisplayTitle(post: Post) {
  // Try to extract bracketed title e.g. [第221馬，台北國道馬...]
  const match = post.content.match(/^\[(.*?)\]/);
  if (match) return match[1];
  
  // Fallback to tags or default
  if (post.tags && post.tags.length > 0) return post.tags.slice(0, 2).join(" • ");
  
  // Last resort: first line of content
  const firstLine = post.content.split('\n')[0].trim();
  return firstLine || "MaraMap 運動日誌";
}

function getDisplayContent(post: Post) {
  // Remove the bracketed title from content if it exists to avoid duplication
  const match = post.content.match(/^\[(.*?)\]/);
  let text = post.content;
  if (match) {
      text = text.replace(match[0], '').trim();
  }
  return text;
}

function getGeoTag(post: Post) {
  // Format the date and category/tag for the top label
  const cat = post.category ? post.category.toUpperCase() : 'LOG';
  return `${cat} / ${post.event_date}`;
}

export default async function Home() {
  let posts: Post[] = [];
  
  // Fetch real data from the backend
  try {
    const res = await fetch('http://127.0.0.1:3000/api/v1/posts?page=1&limit=10', { 
      cache: 'no-store' 
    });
    if (res.ok) {
      const json: ApiResponse = await res.json();
      posts = json.data;
    }
  } catch (error) {
    console.error("Failed to fetch posts:", error);
  }

  return (
    <main className="min-h-screen relative overflow-x-hidden pb-24">
      {/* Background Topo - Fixed opacity & blending */}
      <div 
        className="fixed top-0 left-0 w-screen h-screen -z-10 pointer-events-none mix-blend-multiply opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 100 Q 150 200 400 50' fill='none' stroke='%231a1a1a' stroke-width='0.5'/%3E%3Cpath d='M0 200 Q 200 300 400 150' fill='none' stroke='%231a1a1a' stroke-width='0.5'/%3E%3Cpath d='M0 300 Q 250 400 400 250' fill='none' stroke='%231a1a1a' stroke-width='0.5'/%3E%3C/svg%3E")`
        }}
      />

      <div className="max-w-3xl mx-auto">
        {/* Header - Editorial Style */}
        <header className="px-6 py-12 md:py-20 border-b-2 border-ink flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="font-mono font-bold text-4xl md:text-5xl text-ink tracking-tight mb-4">
              Mara<span className="text-brand">Map</span>
            </h1>
            <p className="font-serif text-2xl font-bold text-ink-light tracking-wider leading-relaxed">
              以配速書寫地理，<br/>用腳步丈量歲月。
            </p>
          </div>
          <div className="font-mono text-sm uppercase tracking-widest text-ink-light flex flex-col gap-1">
            <span>Vol. 1</span>
            <span>Geospatial Log</span>
          </div>
        </header>

        {/* Highlights - High Contrast Data Blocks */}
        <section className="px-6 py-10 bg-ink text-paper grid grid-cols-2 gap-8 border-b-[6px] border-brand shadow-[0_10px_30px_rgba(0,0,0,0.1)]">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] md:text-xs uppercase tracking-[0.2em] text-white/50 mb-2">Davis&apos;s Records</span>
            <div className="font-mono text-6xl md:text-7xl font-bold leading-none text-white tracking-tighter">
              115<span className="text-base md:text-lg font-normal ml-2 text-brand tracking-normal">Marathons</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-[10px] md:text-xs uppercase tracking-[0.2em] text-white/50 mb-2">Rose&apos;s Records</span>
            <div className="font-mono text-6xl md:text-7xl font-bold leading-none text-white tracking-tighter">
              106<span className="text-base md:text-lg font-normal ml-2 text-brand tracking-normal">Marathons</span>
            </div>
          </div>
        </section>

        {/* Feed - Typographic Focus with Real Data */}
        <div className="px-6 pb-20 pt-8">
          {posts.length > 0 ? (
            posts.map((post) => (
              <Link 
                href={`/log/${post.id}`} 
                key={post.id} 
                className="group block py-10 md:py-12 border-b border-line transition-all hover:bg-[rgba(0,0,0,0.02)] -mx-6 px-6"
              >
                <div className="font-mono text-xs md:text-sm text-brand uppercase mb-4 flex items-center gap-3">
                  <span className="w-2 h-2 bg-brand rounded-full inline-block shadow-[0_0_8px_rgba(230,57,70,0.5)]"></span>
                  <span className="tracking-[0.15em]">{getGeoTag(post)}</span>
                </div>
                <h2 className="font-serif text-3xl md:text-4xl font-black leading-[1.3] tracking-tight mb-5 text-ink group-hover:text-brand transition-colors">
                  {getDisplayTitle(post)}
                </h2>
                <p className="font-sans text-lg md:text-xl text-ink-light leading-[1.8] text-justify line-clamp-4 font-medium whitespace-pre-wrap">
                  {getDisplayContent(post)}
                </p>
                <div className="mt-6 font-mono text-sm text-ink flex items-center gap-2 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                  READ LOG <ArrowRight size={16} />
                </div>
              </Link>
            ))
          ) : (
            <div className="py-20 text-center text-ink-light font-mono text-sm uppercase tracking-widest">
              No logs found or backend is offline.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
