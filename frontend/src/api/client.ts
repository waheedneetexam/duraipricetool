const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  '/api';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function uploadCsv(file: File, mapping: Record<string, string>): Promise<Record<string, unknown>> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mapping_json', JSON.stringify(mapping));

  const response = await fetch(`${API_BASE_URL}/admin/ingest/csv`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json();
}
