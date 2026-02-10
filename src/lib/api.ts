import type {
  CreateEnrollmentPayload,
  Enrollment,
  EnrollmentStatus,
  ReasonPayload,
  TimelineEvent,
  TimelineResponse,
} from "../types/sequence";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message?: unknown }).message)
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

export async function apiPost<TResponse, TBody = unknown>(path: string, body?: TBody): Promise<TResponse> {
  return request<TResponse>(path, {
    method: "POST",
    body: body == null ? undefined : JSON.stringify(body),
  });
}

function normalizeEnrollmentList(payload: unknown): Enrollment[] {
  if (Array.isArray(payload)) return payload as Enrollment[];
  if (payload && typeof payload === "object") {
    if (Array.isArray((payload as { enrollments?: unknown }).enrollments)) {
      return (payload as { enrollments: Enrollment[] }).enrollments;
    }
    if (Array.isArray((payload as { data?: unknown }).data)) {
      return (payload as { data: Enrollment[] }).data;
    }
  }

  throw new ApiError("Expected enrollments array from API", 200, payload);
}

function normalizeTimeline(payload: unknown): TimelineResponse {
  if (payload && typeof payload === "object" && Array.isArray((payload as { events?: unknown }).events)) {
    return { events: (payload as { events: TimelineEvent[] }).events };
  }

  throw new ApiError("Expected timeline response with events[]", 200, payload);
}

export const sequenceApi = {
  async listEnrollments(status: EnrollmentStatus) {
    const params = new URLSearchParams({ status });
    const payload = await apiGet<unknown>(`/api/enrollments?${params.toString()}`);
    return normalizeEnrollmentList(payload);
  },
  createEnrollment(payload: CreateEnrollmentPayload) {
    return apiPost<Enrollment, CreateEnrollmentPayload>("/api/enrollments", payload);
  },
  getEnrollment(id: string) {
    return apiGet<Enrollment>(`/api/enrollments/${id}`);
  },
  async getTimeline(id: string) {
    const payload = await apiGet<unknown>(`/api/enrollments/${id}/timeline`);
    return normalizeTimeline(payload);
  },
  suppressEnrollment(id: string, payload: ReasonPayload) {
    return apiPost<Enrollment, ReasonPayload>(`/api/enrollments/${id}/suppress`, payload);
  },
  escalateEnrollment(id: string, payload: ReasonPayload) {
    return apiPost<Enrollment, ReasonPayload>(`/api/enrollments/${id}/escalate`, payload);
  },
};
