import {
  ArrowLeft,
  Check,
  FileImage,
  FileText,
  FolderLock,
  Globe,
  Lock,
  Plus,
  Search,
  Trash2,
  Users,
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
  listCollaborators,
  getBoardPost,
  type ExistingBoardPost,
} from "@/lib/boards-api";
import { listCommunities, setBoardCommunities } from "@/lib/communities-api";
import {
  CollaborativeCanvas,
  type ActivePerson,
} from "@/features/canvas/CollaborativeCanvas";
import { CollaboratorsDialog } from "@/features/share/CollaboratorsDialog";
import { ShareTray } from "@/features/share/ShareTray";
import { BoardTitle } from "@/features/canvas/BoardTitle";
import { BoardMoreMenu } from "@/features/canvas/BoardMoreMenu";
import { VoiceBar } from "@/features/voice/VoiceBar";
import { PersonalFilesSidebar } from "@/features/files/PersonalFilesSidebar";
import { usePersonalFilesStore } from "@/features/files/usePersonalFilesStore";
import {
  getPersonalFiles,
  formatFileSize,
  type StoredPersonalFile,
} from "@/features/files/personalFilesDb";
import { DrawgonLoader } from "@/components/DrawgonLoader";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Board, BoardPostMedia, BoardCollaborator } from "@shared/board";
import type { CommunitySummary } from "@shared/community";
import { useSession } from "@/lib/auth-client";

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [activePeople, setActivePeople] = useState<ActivePerson[]>([]);
  const [visibilityConfirmOpen, setVisibilityConfirmOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [existingPost, setExistingPost] = useState<ExistingBoardPost | null>(null);
  const [publishForm, setPublishForm] = useState({
    postTitle: "",
    details: "",
    tags: "",
  });
  const [postMedia, setPostMedia] = useState<BoardPostMedia[]>([]);
  const [availablePrivateFiles, setAvailablePrivateFiles] = useState<
    StoredPersonalFile[]
  >([]);
  const [selectedPrivateFileIds, setSelectedPrivateFileIds] = useState<
    string[]
  >([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([
    "thumbnail",
    "cover-image",
  ]);
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [communitySearch, setCommunitySearch] = useState("");
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);

  const [shareOpen, setShareOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<BoardCollaborator[]>([]);

  const [editor, setEditor] = useState<Editor | null>(null);
  const navigate = useNavigate();
  const { data: session } = useSession();
  const {
    toggleOpen: toggleFilesOpen,
    fileCount,
    isOpen: filesSidebarOpen,
  } = usePersonalFilesStore();

  useEffect(() => {
    if (!boardId) return;
    getBoard(boardId)
      .then(setBoard)
      .catch(() => setError("Board not found."));

    listCollaborators(boardId)
      .then(setCollaborators)
      .catch(() => setCollaborators([]));
  }, [boardId]);

  useEffect(() => {
    if (!publishOpen) return;

    listCommunities()
      .then((items) => {
        setCommunities(items);
        setSelectedCommunities((prev) =>
          board?.communityId ? [board.communityId] : [...prev],
        );
      })
      .catch(() => setCommunities([]));
  }, [publishOpen]);

  const filteredCommunities = communities.filter((community) => {
    const query = communitySearch.trim().toLowerCase();
    if (!query) return true;
    return (
      community.name.toLowerCase().includes(query) ||
      community.slug.toLowerCase().includes(query)
    );
  });

  function togglePrivateFileSelection(fileId: string) {
    setSelectedPrivateFileIds((current) =>
      current.includes(fileId)
        ? current.filter((id) => id !== fileId)
        : [...current, fileId],
    );
  }

  async function openPublishDialog() {
    if (!board) return;
    const post = await getBoardPost(board.id).catch(() => null);
    setExistingPost(post);
    setPublishForm({
      postTitle: post?.postTitle || board.title,
      details: post?.postDetails || "",
      tags: (post?.postTags ?? []).join(", "),
    });
    setPostMedia(post?.postMedia ?? []);
    setSelectedFiles(["thumbnail", "cover-image"]);
    setSelectedCommunities(post?.communities.map((c) => c.id) ?? []);
    setCommunitySearch("");

    const userId = session?.user?.id || "local_user";
    const personal = await getPersonalFiles(board.id, userId);
    setAvailablePrivateFiles(personal);
    setSelectedPrivateFileIds([]);

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

      const selectedPrivateMedia = await Promise.all(
        availablePrivateFiles
          .filter((f) => selectedPrivateFileIds.includes(f.id))
          .map(
            (f) =>
              new Promise<BoardPostMedia>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () =>
                  resolve({
                    name: f.name,
                    type: f.type,
                    url: String(reader.result),
                  });
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(f.blob);
              }),
          ),
      );

      const publishedPost = await publishBoard(board.id, {
        postTitle: publishForm.postTitle,
        postDetails: publishForm.details,
        postTags: publishForm.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        postMedia: [...postMedia, ...selectedPrivateMedia],
      });
      const selectedSlugs = communities
        .filter((community) => selectedCommunities.includes(community.id))
        .map((community) => community.slug);
      await setBoardCommunities(publishedPost.id, selectedSlugs);
      setPublishOpen(false);
    } catch {
      alert("Failed to publish. Please try again.");
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

  const isOwner = board?.role === "owner";
  const invitedCount = collaborators.filter((c) => c.role !== "owner").length;

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

  if (!board || !session) {
    return <DrawgonLoader label="Loading board..." />;
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200 px-2 py-2 sm:px-4 dark:border-neutral-800">
        <div className="flex min-w-0 items-center gap-1">
          <Link
            to="/"
            aria-label="Back to my boards"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-200/70 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50"
          >
            <ArrowLeft size={16} />
          </Link>
          {isOwner ? (
            <BoardTitle
              boardId={board.id}
              title={board.title}
              onRenamed={(title) => setBoard({ ...board, title })}
            />
          ) : (
            <span className="max-w-[9rem] truncate px-2 text-sm font-medium text-neutral-900 sm:max-w-[16rem] dark:text-neutral-50">
              {board.title}
            </span>
          )}
          <span className="hidden text-neutral-300 sm:inline dark:text-neutral-700">|</span>
          {!isOwner && (
            <span className="hidden shrink-0 whitespace-nowrap rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600 md:inline dark:bg-neutral-800 dark:text-neutral-300">
              {board.ownerName}'s board ·{" "}
              {board.role === "editor" ? "Can edit" : "View only"}
            </span>
          )}
          {isOwner && (
            <>
              <button
                type="button"
                onClick={openPublishDialog}
                aria-label="Publish to communities"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-brand-hover sm:px-3"
              >
                <Globe size={13} />
                <span className="hidden sm:inline">Publish</span>
              </button>
              <button
                type="button"
                onClick={openVisibilityConfirmation}
                aria-label={board.visibility === "public" ? "Public board" : "Private board"}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 sm:px-3 text-xs font-medium text-neutral-600 transition hover:bg-neutral-200/70 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-50"
              >
                {board.visibility === "public" ? (
                  <Globe size={13} />
                ) : (
                  <Lock size={13} />
                )}
                <span className="hidden sm:inline">
                  {board.visibility === "public" ? "Public" : "Private"}
                </span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            aria-label={isOwner ? "Share" : "People"}
            className="relative inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 sm:px-3 text-xs font-medium text-neutral-600 transition hover:bg-neutral-200/70 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-50"
          >
            <Users size={13} />
            <span className="hidden sm:inline">{isOwner ? "Share" : "People"}</span>
            {invitedCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
                {invitedCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={toggleFilesOpen}
            className={`relative hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition lg:inline-flex ${
              filesSidebarOpen
                ? "bg-amber-100 text-amber-900 shadow-xs dark:bg-amber-500/20 dark:text-amber-300"
                : "text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-50"
            }`}
            title="Open private files sidebar (Claude-style side panel for PDF, DOCX, XLSX, etc.)"
          >
            <FolderLock size={13} className="text-amber-500" />
            <span>Files</span>
            {fileCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
                {fileCount}
              </span>
            )}
          </button>

          {isOwner && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              aria-label="Delete board"
              title="Delete board"
              className="hidden h-8 w-8 lg:inline-flex items-center justify-center rounded-full text-neutral-400 transition hover:bg-red-100 hover:text-red-600 disabled:opacity-50 dark:text-neutral-500 dark:hover:bg-red-500/15 dark:hover:text-red-400"
            >
              <Trash2 size={15} />
            </button>
          )}
          {activePeople.length > 1 && (
            <div
              className="hidden items-center gap-1.5 rounded-full border border-emerald-200/80 lg:inline-flex bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-500/15 dark:text-emerald-400"
              title={`Active now: ${activePeople.map((p) => p.name).join(", ")}`}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-medium">
                {activePeople.length} active
              </span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <BoardMoreMenu
            items={[
              {
                label: `Files${fileCount ? ` (${fileCount})` : ""}`,
                icon: FolderLock,
                onSelect: toggleFilesOpen,
              },
              ...(isOwner
                ? [
                    {
                      label: "Delete board",
                      icon: Trash2,
                      onSelect: () => void handleDelete(),
                      danger: true,
                    },
                  ]
                : []),
            ]}
          />
          <ThemeToggle />
        </div>
      </div>
      <div className="relative flex flex-1 overflow-hidden">
        <div className="relative flex-1 h-full overflow-hidden">
          <CollaborativeCanvas
            key={board.id}
            boardId={board.id}
            user={{
              id: session.user.id,
              name: session.user.name || session.user.email,
            }}
            onEditorReady={setEditor}
            onPresenceChange={setActivePeople}
          />
          <VoiceBar boardId={board.id} />
        </div>
        <PersonalFilesSidebar boardId={board.id} />
      </div>
      <ShareTray editor={editor} title={board.title} />

      {publishOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-neutral-950/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-5xl rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mb-0 flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand">
                  {existingPost ? "Update post" : "Publish board"}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                  {existingPost ? "Update your existing post" : "Create a new post"}
                </h2>
                {existingPost && (
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    This board is already posted. Publishing replaces that post with the
                    board as it is now; votes and comments stay.
                  </p>
                )}
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
                            onClick={() =>
                              setPublishForm((prev) => ({
                                ...prev,
                                tags: prev.tags ? `${prev.tags}, ${tag}` : tag,
                              }))
                            }
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
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-200">
                        Select files to show
                      </span>
                      {availablePrivateFiles.length > 0 && (
                        <span className="text-[11px] text-neutral-500">
                          {selectedPrivateFileIds.length} of{" "}
                          {availablePrivateFiles.length} private files selected
                        </span>
                      )}
                    </div>

                    {availablePrivateFiles.length > 0 && (
                      <div className="mb-3 space-y-1.5 max-h-48 overflow-y-auto rounded-xl border border-neutral-200 bg-neutral-50 p-2.5 dark:border-neutral-700 dark:bg-neutral-900">
                        <div className="flex items-center justify-between px-1 pb-1 border-b border-neutral-200/60 dark:border-neutral-800">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                            <FolderLock size={12} />
                            Your Private Files
                          </span>
                          <span className="text-[10px] text-neutral-400">
                            Check to publish with post
                          </span>
                        </div>
                        {availablePrivateFiles.map((file) => {
                          const isChecked = selectedPrivateFileIds.includes(
                            file.id,
                          );
                          return (
                            <label
                              key={file.id}
                              className={`flex items-center justify-between gap-2 rounded-lg p-2 text-xs transition cursor-pointer border ${
                                isChecked
                                  ? "bg-amber-500/10 border-amber-500/40 text-neutral-900 dark:text-neutral-100 font-medium"
                                  : "bg-white border-neutral-200/80 text-neutral-700 hover:bg-neutral-100 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() =>
                                    togglePrivateFileSelection(file.id)
                                  }
                                  className="h-3.5 w-3.5 rounded border-neutral-300 text-brand focus:ring-brand accent-brand"
                                />
                                <span className="truncate">{file.name}</span>
                              </div>
                              <span className="shrink-0 text-[10px] text-neutral-400">
                                {formatFileSize(file.size)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 py-3 text-sm text-neutral-600 transition hover:border-brand hover:text-brand dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                      <FileImage size={16} />
                      <span>Upload additional media from device</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*,audio/*,.pdf,.docx,.xlsx,.csv,.txt"
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
                  {publishing
                    ? existingPost
                      ? "Updating..."
                      : "Publishing..."
                    : existingPost
                      ? "Update post"
                      : "Publish"}
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

      {shareOpen && (
        <CollaboratorsDialog
          board={board}
          currentUserId={session.user.id}
          onClose={() => setShareOpen(false)}
          onPeopleChange={setCollaborators}
          onLeft={() => navigate("/")}
        />
      )}
    </div>
  );
}
