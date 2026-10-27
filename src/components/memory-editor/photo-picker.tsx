'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client-api';
type Photo = { id: string; alt: string };
export function PhotoPicker({
  value,
  onChange,
}: {
  value: Photo[];
  onChange: (photos: Photo[]) => void;
}) {
  const [library, setLibrary] = useState<{ id: string; url: string }[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = () =>
    api<typeof library>('/api/uploads')
      .then(setLibrary)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <fieldset className="photo-picker">
      <legend>照片（最多 20 张）</legend>
      <label>
        上传照片
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy || value.length >= 20}
          onChange={async (e) => {
            const input = e.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            setBusy(true);
            setError('');
            try {
              if (file.size > 8 * 1024 * 1024) throw Error('图片不能超过 8MB');
              const photo = await api<Photo>('/api/uploads', {
                method: 'POST',
                headers: { 'Content-Type': file.type },
                body: file,
              });
              onChange([...value, { id: photo.id, alt: photo.alt }]);
              await refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : '上传失败');
            } finally {
              setBusy(false);
              input.value = '';
            }
          }}
        />
      </label>
      <small>
        JPEG / PNG / WebP，单张最多 8MB、1600 万像素。上传后自动去除 EXIF
        信息。未关联照片可在下方确认删除。
      </small>
      {busy && <p role="status">正在处理照片…</p>}
      <div className="photo-picker-grid">
        {library.map((photo) => {
          const selected = value.find((p) => p.id === photo.id);
          return (
            <div key={photo.id}>
              <button
                type="button"
                aria-pressed={Boolean(selected)}
                aria-label={selected ? '从回忆移除照片' : '选择已有照片'}
                disabled={busy || (!selected && value.length >= 20)}
                onClick={() =>
                  onChange(
                    selected
                      ? value.filter((p) => p.id !== photo.id)
                      : [...value, { id: photo.id, alt: '回忆照片' }],
                  )
                }
              >
                <img src={photo.url} alt={selected?.alt || '私人照片'} />
                <span>{selected ? '已选择 · 点击移除' : '选择照片'}</span>
              </button>
              {selected ? (
                <label>
                  照片描述
                  <input
                    maxLength={160}
                    value={selected.alt}
                    onChange={(e) =>
                      onChange(
                        value.map((p) => (p.id === photo.id ? { ...p, alt: e.target.value } : p)),
                      )
                    }
                  />
                </label>
              ) : (
                <button
                  type="button"
                  className="text-button"
                  onClick={async () => {
                    if (!window.confirm('确定删除这张未关联照片？服务器会保留恢复备份。')) return;
                    setError('');
                    try {
                      await api(`/api/uploads/${photo.id}`, {
                        method: 'DELETE',
                        body: JSON.stringify({ confirmed: true }),
                      });
                      await refresh();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : '删除失败');
                    }
                  }}
                >
                  删除未关联照片
                </button>
              )}
            </div>
          );
        })}
      </div>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
