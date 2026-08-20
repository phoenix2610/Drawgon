import { Hash, LayoutGrid, Search, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FeedItem } from '@shared/community';
import { listCommunityFeed } from '@/lib/community-api';
import { PinCard } from '@/features/community/PinCard';
import { DrawgonLoader } from '@/components/DrawgonLoader';
import { DrawgonWordmark } from '@/components/DrawgonWordmark';
import { ThemeToggle } from '@/components/ThemeToggle';

export function CommunityFeedPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  // Debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setLoading(true);
      listCommunityFeed(query.trim() || undefined)
        .then(setItems)
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query]);

  const navLink =
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-200/70 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-50';

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <DrawgonWordmark to="/" />

          <div className="order-3 w-full sm:order-2 sm:w-auto sm:flex-1 sm:max-w-md">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search boards..."
                aria-label="Search boards"
                className="w-full rounded-full border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>

          <div className="order-2 flex items-center gap-1 sm:order-3">
            <Link to="/communities" className={navLink}>
              <Hash size={15} />
              Communities
            </Link>
            <Link to="/" className={navLink}>
              <LayoutGrid size={15} />
              My boards
            </Link>
            <ThemeToggle />
          </div>
        </div>

        {loading && <DrawgonLoader fullScreen={false} size={72} />}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 py-20 text-center dark:border-neutral-700">
            <Sparkles size={22} className="text-neutral-400" />
            <p className="text-neutral-500">
              {query
                ? `No boards match "${query}".`
                : 'No public boards yet. Publish one of yours to be the first.'}
            </p>
          </div>
        )}

        {/* CSS columns give the staggered Pinterest masonry without JS layout. */}
        {!loading && items.length > 0 && (
          <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
            {items.map((item) => (
              <PinCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
