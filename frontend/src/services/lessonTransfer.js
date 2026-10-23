// Keep each request small enough for standard reverse proxy upload limits.
export async function uploadLessonPackage(api, unitId, file, onProgress) {
  const chunkSize = 8 * 1024 * 1024;
  if (!file || file.size <= 0 || file.size > 2 * 1024 * 1024 * 1024) throw new Error('请选择不超过 2 GB 的 ZIP 文件');
  const key = `lesson-transfer:${unitId}:${file.name}:${file.size}:${file.lastModified}`;
  let transferId = localStorage.getItem(key);
  if (!transferId) {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    transferId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    localStorage.setItem(key, transferId);
  }
  const base = `/lessons/units/${unitId}/transfers/${transferId}`;
  const { data } = await api.get(base);
  if (data.completed) {
    localStorage.removeItem(key);
    onProgress?.(100);
    return data.completed;
  }
  const received = new Set(data.chunks);
  const count = Math.ceil(file.size / chunkSize);
  for (let index = 0; index < count; index++) {
    if (!received.has(index)) {
      await api.put(`${base}/chunks/${index}`, file.slice(index * chunkSize, (index + 1) * chunkSize), {
        headers: { 'Content-Type': 'application/octet-stream' },
        timeout: 600000,
        onUploadProgress: event => onProgress?.(Math.min(99, Math.round((index * chunkSize + event.loaded) * 100 / file.size)))
      });
    }
    onProgress?.(Math.min(99, Math.round(Math.min(file.size, (index + 1) * chunkSize) * 100 / file.size)));
  }
  const response = await api.post(`${base}/complete`, { count, size: file.size }, { timeout: 1800000 });
  localStorage.removeItem(key);
  onProgress?.(100);
  return response.data;
}
