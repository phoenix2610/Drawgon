import {
  ArrowLeft,
  Check,
  FileImage,
  FileText,
  Globe,
  Lock,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Editor } from "@tldraw/tldraw";
import {
  deleteBoard,
  getBoard,
  publishBoard,
  updateBoardVisibility,
} from "@/lib/boards-api";
import { listCommunities, setBoardCommunities } from "@/lib/communities-api";
import { BoardCanvas } from "@/features/canvas/BoardCanvas";
import { ShareTray } from "@/features/share/ShareTray";
import { BoardTitle } from "@/features/canvas/BoardTitle";
import { VoiceBar } from "@/features/voice/VoiceBar";
import { DrawgonLoader } from "@/components/DrawgonLoader";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Board, BoardPostMedia } from "@shared/board";
import type { CommunitySummary } from "@shared/community";

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [visibilityConfirmOpen, setVisibilityConfirmOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishForm, setPublishForm] = useState({
    postTitle: "",
    details: "",
    tags: "",
  });
  const [postMedia, setPostMedia] = useState<BoardPostMedia[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([
    "thumbnail",
    "cover-image",
  ]);
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [communitySearch, setCommunitySearch] = useState("");
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!boardId) return;
    getBoard(boardId)
      .then(setBoard)
      .catch(() => setError("Board not found."));
  }, [boardId]);

  useEffect(() => {
    if (!publishOpen) return;

    listCommunities()
      .then((items) => {
        setCommunities(items);
        setSelectedCommunities(
          board?.communityId ? [board.communityId] : [...selectedCommunities],
        );
      })
      .catch(() => setCommunities([]));
  }, [board, publishOpen]);

  const filteredCommunities = communities.filter((community) => {
    const query = communitySearch.trim().toLowerCase();
    if (!query) return true;
    return (
      community.name.toLowerCase().includes(query) ||
      community.slug.toLowerCase().includes(query)
    );
  });

  function openPublishDialog() {
    if (!board) return;
    setPublishForm({
      postTitle: board.title,
      details: "",
      tags: "",
    });
    setPostMedia([]);
    setSelectedFiles(["thumbnail", "cover-image"]);
    setSelectedCommunities([]);
    setCommunitySearch("");
    setPublishOpen(true);
  }

  async function handlePublish() {
    if (
      !board ||
      publishing ||
      selectedCommunities.length === 0 ||
      !publishForm.postTitle.trim()
    )
      return;
    setPublishing(true);
    try {
      const publishedPost = await publishBoard(board.id, {
        postTitle: publishForm.postTitle,
        postDetails: publishForm.details,
        postTags: publishForm.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        postMedia,
      });
      const selectedSlugs = communities
        .filter((community) => selectedCommunities.includes(community.id))
        .map((community) => community.slug);
      await setBoardCommunities(publishedPost.id, selectedSlugs);
      setPublishOpen(false);
    } finally {
      setPublishing(false);
    }
  }

  async function confirmVisibilityChange() {
    if (!board) return;
    setVisibilityConfirmOpen(false);
    const updated = await updateBoardVisibility(
      board.id,
      board.visibility === "public" ? "private" : "public",
    );
    setBoard(updated);
  }

  function toggleCommunitySelection(communityId: string) {
    setSelectedCommunities((current) =>
      current.includes(communityId)
        ? current.filter((id) => id !== communityId)
        : [...current, communityId],
    );
  }

  async function handleMediaChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const media = await Promise.all(
      files.map(
        (file) =>
          new Promise<BoardPostMedia>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                name: file.name,
                type: file.type,
                url: String(reader.result),
              });
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    );
    setPostMedia((current) => [...current, ...media]);
    event.target.value = "";
  }

  function openVisibilityConfirmation() {
    if (!board) return;
    setVisibilityConfirmOpen(true);
  }

  async function handleDelete() {
    if (!board || deleting) return;
    if (!window.confirm(`Delete “${board.title}”? This cannot be undone.`))
      return;
    setDeleting(true);
    try {
      await deleteBoard(board.id);
      navigate("/");
    } finally {
      setDeleting(false);
    }
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-neutral-500">{error}</p>
        <Link to="/" className="text-sm underline">
          Back to boards
        </Link>
      </div>
    );
  }

  if (!board) {
    return <DrawgonLoader label="Loading board..." />;
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <div className="flex items-center gap-1">
          <Link
            to="/"
            aria-label="Back to my boards"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-200/70 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50"
          >
            <ArrowLeft size={16} />
          </Link>
          <BoardTitle
            boardId={board.id}
            title={board.title}
            onRenamed={(title) => setBoard({ ...board, title })}
          />
          <span className="text-neutral-300 dark:text-neutral-700">|</span>
          <button
            type="button"
            onClick={openPublishDialog}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-hover"
          >
            <Globe size={13} />
            Publish
          </button>
          <button
            type="button"
            onClick={openVisibilityConfirmation}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-200/70 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-50"
          >
            {board.visibility === "public" ? (
              <Globe size={13} />
            ) : (
              <Lock size={13} />
            )}
            {board.visibility === "public" ? "Public" : "Private"}
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            aria-label="Delete board"
            title="Delete board"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition hover:bg-red-100 hover:text-red-600 disabled:opacity-50 dark:text-neutral-500 dark:hover:bg-red-500/15 dark:hover:text-red-400"
          >
            <Trash2 size={15} />
          </button>
        </div>
        <ThemeToggle />
      </div>
      <div className="relative flex-1 overflow-hidden">
        <BoardCanvas
          boardId={board.id}
          initialSnapshot={board.snapshot}
          onEditorReady={setEditor}
        />
        <VoiceBar boardId={board.id} />
      </div>
      <ShareTray editor={editor} title={board.title} />

      {publishOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-neutral-950/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-5xl rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mb-0 flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand">
                  Publish board
                </p>
                <h2 className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                  Create a new post
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPublishOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-200/70 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50"
                aria-label="Close publish dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-0 md:grid-cols-2">
              <div className="border-b border-neutral-200 p-5 dark:border-neutral-800 md:border-b-0 md:border-r">
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-200">
                      Board name
                    </span>
                    <input
                      value={board.title}
                      readOnly
                      placeholder="Board name"
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-200">
                      Post title
                    </span>
                    <input
                      value={publishForm.postTitle}
                      onChange={(e) =>
                        setPublishForm({
                          ...publishForm,
                          postTitle: e.target.value,
                        })
                      }
                      placeholder="What is this post about?"
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-200">
                      Details
                    </span>
                    <textarea
                      value={publishForm.details}
                      onChange={(e) =>
                        setPublishForm({
                          ...publishForm,
                          details: e.target.value,
                        })
                      }
                      rows={5}
                      placeholder="Write the context, question, or story behind your board..."
                      className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                    />
                  </label>

                  <div>
                    <span className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-200">
                      Tags
                    </span>
                    <div className="flex flex-wrap gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-2 dark:border-neutral-700 dark:bg-neutral-900">
                      {["branding", "storyboard", "moodboard", "concept"].map(
                        (tag) => (
                          <button
                            key={tag}
                            type="button"
                            className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:border-brand hover:text-brand dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                          >
                            <Plus size={12} />
                            {tag}
                          </button>
                        ),
                      )}
                    </div>
                    <input
                      value={publishForm.tags}
                      onChange={(e) =>
                        setPublishForm({ ...publishForm, tags: e.target.value })
                      }
                      placeholder="Add tags separated by commas"
                      className="mt-2 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                    />
                  </div>

                  <div>
                    <span className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-200">
                      Extra media
                    </span>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 py-3 text-sm text-neutral-600 transition hover:border-brand hover:text-brand dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                      <FileImage size={16} />
                      <span>Add images, video, or other files</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*,audio/*,.pdf,.txt"
                        onChange={(event) => void handleMediaChange(event)}
                        className="sr-only"
                      />
                    </label>
                    {postMedia.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {postMedia.map((media, index) => (
                          <div
                            key={`${media.name}-${index}`}
                            className="flex items-center justify-between rounded-lg bg-neutral-100 px-3 py-2 text-xs dark:bg-neutral-800"
                          >
                            <span className="truncate">{media.name}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setPostMedia((current) =>
                                  current.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                )
                              }
                              className="ml-2 text-neutral-500 hover:text-red-500"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="mb-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
                    Popular communities
                  </p>
                  <div className="relative">
                    <Search
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                    />
                    <input
                      type="search"
                      value={communitySearch}
                      onChange={(e) => setCommunitySearch(e.target.value)}
                      placeholder="Search active communities"
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                </div>

                {!communitySearch.trim() && (
                  <div className="mb-4 grid gap-2 sm:grid-cols-2">
                    {(communities.length > 0
                      ? communities.slice(0, 4)
                      : []
                    ).map((community) => {
                      const checked = selectedCommunities.includes(
                        community.id,
                      );
                      return (
                        <button
                          key={community.id}
                          type="button"
                          onClick={() => toggleCommunitySelection(community.id)}
                          className={`rounded-xl border px-3 py-2 text-left transition ${
                            checked
                              ? "border-brand bg-brand/5 text-neutral-900 dark:border-brand dark:bg-brand/10 dark:text-neutral-50"
                              : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              d/{community.slug}
                            </span>
                            {checked && (
                              <Check size={14} className="text-brand" />
                            )}
                          </div>
                          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {community.name}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="max-h-44 overflow-y-auto rounded-xl border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-700 dark:bg-neutral-900">
                  {filteredCommunities.length === 0 && (
                    <p className="px-2 py-4 text-sm text-neutral-500">
                      No communities match your search.
                    </p>
                  )}

                  {filteredCommunities.map((community) => {
                    const checked = selectedCommunities.includes(community.id);
                    return (
                      <button
                        key={community.id}
                        type="button"
                        onClick={() => toggleCommunitySelection(community.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                          checked
                            ? "bg-brand/5 text-neutral-900 dark:bg-brand/10 dark:text-neutral-50"
                            : "text-neutral-700 hover:bg-neutral-200/60 dark:text-neutral-200 dark:hover:bg-neutral-800"
                        }`}
                      >
                        <div>
                          <div className="font-medium">d/{community.slug}</div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            {community.name}
                          </div>
                        </div>
                        {checked && <Check size={15} className="text-brand" />}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4">
                  <span className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-200">
                    Select files to show
                  </span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      { id: "thumbnail", label: "Thumbnail", icon: FileImage },
                      {
                        id: "cover-image",
                        label: "Cover image",
                        icon: FileImage,
                      },
                      {
                        id: "board-notes",
                        label: "Board notes",
                        icon: FileText,
                      },
                      {
                        id: "reference",
                        label: "Reference board",
                        icon: FileText,
                      },
                    ].map(({ id, label, icon: Icon }) => {
                      const checked = selectedFiles.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() =>
                            setSelectedFiles((current) =>
                              current.includes(id)
                                ? current.filter((file) => file !== id)
                                : [...current, id],
                            )
                          }
                          className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                            checked
                              ? "border-brand bg-brand/5 text-neutral-900 dark:border-brand dark:bg-brand/10 dark:text-neutral-50"
                              : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Icon size={15} />
                            {label}
                          </span>
                          {checked && (
                            <Check size={15} className="text-brand" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-neutral-200 px-5 py-4 dark:border-neutral-800">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {selectedCommunities.length} community
                {selectedCommunities.length === 1 ? "" : "ies"} selected
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPublishOpen(false)}
                  className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={publishing || selectedCommunities.length === 0}
                  onClick={() => void handlePublish()}
                  className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-hover disabled:opacity-60"
                >
                  {publishing ? "Publishing..." : "Publish"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {visibilityConfirmOpen && (
        <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-neutral-950/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand">
              Change board visibility
            </p>
            <h2 className="mt-2 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              Make this board{" "}
              {board.visibility === "public" ? "private" : "public"}?
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
              {board.visibility === "public"
                ? "All published posts from this board will be permanently removed from their communities."
                : "The board will be accessible publicly, but it will not create a community post until you publish one."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVisibilityConfirmOpen(false)}
                className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmVisibilityChange()}
                className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
