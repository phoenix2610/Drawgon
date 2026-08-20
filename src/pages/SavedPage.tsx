import { Bookmark } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FeedItem } from '@shared/community';
import { listSavedBoards } from '@/lib/community-api';
import { PinCard } from '@/features/community/PinCard';
import { DrawgonLoader } from '@/components/DrawgonLoader';

export function SavedPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSavedBoards()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
        <Bookmark size={22} />
        Saved
      </h1>

      {loading && <DrawgonLoader fullScreen={false} size={72} />}

      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-300 py-20 text-center dark:border-neutral-700">
          <Bookmark size={24} className="text-neutral-400" />
          <p className="text-neutral-500">Nothing saved yet.</p>
          <Link
            to="/community"
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-hover"
          >
            Explore canvases
          </Link>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
          {items.map((item) => (
            <PinCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
