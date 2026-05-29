const BASE = import.meta.env.VITE_API_URL || "";

const API_BASE = `${BASE}/api`;
const AUTH_BASE = `${BASE}/auth`;
const QUIZ_BASE = `${BASE}/quiz`;

const TOKEN_KEY = "DocSync_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}


async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(0, 'Unable to connect to the server. Check your internet connection and try again.');
  }

  if (!response.ok) {
    let detail = "Something went wrong. Please try again.";
    try {
      const body = await response.json();
      detail = body.detail || body.message || detail;
    } catch {

    }
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<T>;
}

export interface AuthResponse {
  access_token: string;
}

export interface UploadResponse {
  status: string;
  file_name: string;
  chunks_added: number;
  message: string;
  doc_id: string;
  topics: string[];
  duplicate: boolean;
}

export interface DocumentRecord {
  doc_id: string;
  file_name: string;
  topics: string[];
  created_at: string | null;
}

export interface QueryResponse {
  answer: string;
  sources: Array<{ content: string;[key: string]: unknown }>;
}

export interface QuizQuestion {
  question: string;
  options: Record<string, string>;
  answer: string;
}

export interface QuizResponse {
  quiz: QuizQuestion[];
}

export const authApi = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const data = await request<AuthResponse>(`${AUTH_BASE}/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.access_token);
    return data;
  },

  async signup(email: string, password: string): Promise<AuthResponse> {
    const data = await request<AuthResponse>(`${AUTH_BASE}/signup`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.access_token);
    return data;
  },

  logout(): void {
    clearToken();
  },

  async deleteAccount(): Promise<{ message: string }> {
    const data = await request<{ message: string }>(`${AUTH_BASE}/delete-account`, {
      method: "DELETE",
    });
    clearToken();
    return data;
  },
};

export const docApi = {
  async upload(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append("file", file);

    return request<UploadResponse>(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
    });
  },

  async fetchAll(): Promise<DocumentRecord[]> {
    return request<DocumentRecord[]>(`${API_BASE}/documents`);
  },

  async deleteDocument(docId: string): Promise<{ message: string }> {
    return request<{ message: string }>(`${API_BASE}/document/${docId}`, {
      method: "DELETE",
    });
  },
};

export const queryApi = {
  async send(
    query: string,
    docId: string,
    topK: number = 10
  ): Promise<QueryResponse> {
    return request<QueryResponse>(`${API_BASE}/query`, {
      method: "POST",
      body: JSON.stringify({ query, doc_id: docId, top_k: topK }),
    });
  },
};

export const quizApi = {
  async generate(
    docId: string,
    topics: string[]
  ): Promise<QuizResponse> {
    return request<QuizResponse>(`${QUIZ_BASE}/generate`, {
      method: "POST",
      body: JSON.stringify({ doc_id: docId, topics }),
    });
  },
};

export interface VideoItem {
  title: string;
  channel: string;
  thumbnail: string | null;
  url: string;
}

export interface TopicVideos {
  topic: string;
  videos: VideoItem[];
}

export interface VideoResponse {
  videos: TopicVideos[];
}

export const videoApi = {
  async search(
    docId: string,
    topics: string[]
  ): Promise<VideoResponse> {
    return request<VideoResponse>(`${API_BASE}/videos`, {
      method: "POST",
      body: JSON.stringify({ doc_id: docId, topics }),
    });
  },
};
