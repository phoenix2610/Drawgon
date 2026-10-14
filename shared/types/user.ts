export interface UserProfile {
  userId: string;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUserProfile extends UserProfile {

  name: string;

  email: string;
  followersCount: number;
  followingCount: number;

  isFollowedByMe: boolean | null;
}

export interface FollowSummary {
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
}

export interface UserSearchResult {
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
}

export interface UpdateProfileInput {
  username?: string;
  bio?: string;
  avatarUrl?: string;
}
