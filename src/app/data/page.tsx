'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useStore } from '@/hooks/useStore';
import { format, strings } from '@/i18n/strings';
import { emptyStore, exportStore, importStore } from '@/lib/storage';

const s = strings('zh-CN');

export default function DataPage() {
  const { store, answers, replaceStore } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleExport = () => {
    const blob = new Blob([exportStore(store)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-recall-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const result = importStore(store, text);
      replaceStore(result.store);
      setMessage(format(s.importDone, { n: result.imported, skipped: result.skipped }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '导入失败');
    }
  };

  const handleClear = () => {
    if (!window.confirm(s.clearConfirm)) return;
    replaceStore(emptyStore());
    setMessage('已清空。');
  };

  return (
    <div className="shell">
      <div className="topbar">
        <h1 className="brand-name" style={{ margin: 0 }}>{s.dataTitle}</h1>
        <Link href="/" className="link-pill">{s.common.back}</Link>
      </div>

      <div className="card">
        <p className="muted">{s.storageNote}</p>
        <p className="tiny" style={{ marginTop: 10 }}>当前记录：{answers.length} 条</p>
      </div>

      <div className="card">
        <div className="footer-actions" style={{ marginTop: 0 }}>
          <button type="button" className="ghost" onClick={handleExport}>
            {s.exportData}
          </button>
          <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
            {s.importData}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImport(file);
            e.target.value = '';
          }}
        />
        {message && <p className="tiny" style={{ marginTop: 12 }}>{message}</p>}
      </div>

      <div className="card">
        <button type="button" className="ghost" style={{ width: '100%', color: 'var(--bad)' }} onClick={handleClear}>
          {s.clearAll}
        </button>
      </div>
    </div>
  );
}
