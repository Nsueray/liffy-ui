'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthGuard } from '@/hooks/useAuthGuard';

interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  created_at: string;
  updated_at: string;
}

// --- Rich Text Toolbar Component ---
function RichTextToolbar({ editorRef }: { editorRef: React.RefObject<HTMLDivElement | null> }) {
  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  };

  const handleLink = () => {
    const url = prompt('Enter URL:', 'https://');
    if (url) {
      exec('createLink', url);
    }
  };

  const handleFontSize = (size: string) => {
    editorRef.current?.focus();
    // execCommand fontSize uses 1-7 scale
    const sizeMap: Record<string, string> = { small: '2', normal: '3', large: '5' };
    document.execCommand('fontSize', false, sizeMap[size] || '3');
  };

  const btnClass =
    'px-2 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors min-w-[32px]';

  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 border border-gray-300 border-b-0 rounded-t-lg flex-wrap">
      <button type="button" onClick={() => exec('bold')} className={btnClass} title="Bold">
        <strong>B</strong>
      </button>
      <button type="button" onClick={() => exec('italic')} className={btnClass} title="Italic">
        <em>I</em>
      </button>
      <button type="button" onClick={() => exec('underline')} className={btnClass} title="Underline">
        <u>U</u>
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <select
        onChange={(e) => { handleFontSize(e.target.value); e.target.value = ''; }}
        defaultValue=""
        className="px-2 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors cursor-pointer"
        title="Font Size"
      >
        <option value="" disabled>Size</option>
        <option value="small">Small</option>
        <option value="normal">Normal</option>
        <option value="large">Large</option>
      </select>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <button type="button" onClick={handleLink} className={btnClass} title="Insert Link">
        Link
      </button>
      <button type="button" onClick={() => exec('removeFormat')} className={`${btnClass} text-gray-400`} title="Clear Formatting">
        Clear
      </button>
    </div>
  );
}

export default function TemplatesPage() {
  useAuthGuard();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body_html: ''
  });

  const editorRef = useRef<HTMLDivElement>(null);

  // Sync contentEditable → formData on input
  const handleEditorInput = useCallback(() => {
    if (editorRef.current) {
      setFormData(prev => ({ ...prev, body_html: editorRef.current!.innerHTML }));
    }
  }, []);

  // Load HTML into editor when modal opens
  useEffect(() => {
    if (showModal && editorRef.current) {
      editorRef.current.innerHTML = formData.body_html;
    }
  }, [showModal]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('liffy_token');
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/email-templates`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }

      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openCreateModal = () => {
    setEditingTemplate(null);
    setFormData({ name: '', subject: '', body_html: '' });
    setShowModal(true);
  };

  const openEditModal = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body_html: template.body_html
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Sync editor content before validation
    if (editorRef.current) {
      formData.body_html = editorRef.current.innerHTML;
    }

    // Strip tags for emptiness check
    const textContent = editorRef.current?.textContent?.trim() || '';
    if (!formData.name.trim() || !formData.subject.trim() || !textContent) {
      setError('All fields are required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const token = localStorage.getItem('liffy_token');
      if (!token) return;

      const url = editingTemplate
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/email-templates/${editingTemplate.id}`
        : `${process.env.NEXT_PUBLIC_API_URL}/api/email-templates`;

      const response = await fetch(url, {
        method: editingTemplate ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${editingTemplate ? 'update' : 'create'} template`);
      }

      setShowModal(false);
      setFormData({ name: '', subject: '', body_html: '' });
      setEditingTemplate(null);
      fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleteLoading(true);
      setError(null);

      const token = localStorage.getItem('liffy_token');
      if (!token) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/email-templates/${deleteTarget.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete template');
      }

      setTemplates(prev => prev.filter(t => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Insert placeholder at cursor in contentEditable
  const insertPlaceholder = (placeholder: string) => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, placeholder);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Email Templates</h1>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
          >
            Create Template
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <span className="text-red-700 text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {templates.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500 mb-4">No templates yet</p>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 border border-orange-600 text-orange-600 text-sm font-medium rounded-lg hover:bg-orange-50 transition-colors"
            >
              Create your first template
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {template.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {template.subject}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(template.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                      <button
                        onClick={() => setPreviewTemplate(template)}
                        className="px-3 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => openEditModal(template)}
                        className="px-3 py-1 text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(template)}
                        className="px-3 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
              <div
                className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                onClick={() => !submitting && setShowModal(false)}
              ></div>

              <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all w-full max-w-2xl">
                <form onSubmit={handleSubmit}>
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">
                        {editingTemplate ? 'Edit Template' : 'Create Template'}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowModal(false)}
                        disabled={submitting}
                        className="text-gray-400 hover:text-gray-500 disabled:opacity-50"
                      >
                        <span className="text-2xl">×</span>
                      </button>
                    </div>
                  </div>

                  <div className="px-6 py-4 space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        disabled={submitting}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100"
                        placeholder="Template name"
                      />
                    </div>

                    <div>
                      <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                        Subject
                      </label>
                      <input
                        type="text"
                        id="subject"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        required
                        disabled={submitting}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100"
                        placeholder="Email subject line (use {{name}}, {{company}} for placeholders)"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Body
                      </label>
                      <RichTextToolbar editorRef={editorRef} />
                      <div
                        ref={editorRef}
                        contentEditable={!submitting}
                        onInput={handleEditorInput}
                        onKeyDown={(e) => {
                          // Enter = new paragraph (default contentEditable behavior)
                          // Ctrl/Cmd+B/I/U handled natively by contentEditable
                        }}
                        className="w-full min-h-[280px] max-h-[400px] overflow-y-auto px-3 py-2 border border-gray-300 rounded-b-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                        style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '14px', lineHeight: '1.6', color: '#333' }}
                        data-placeholder="Start typing your email content..."
                      />
                      <div className="mt-2 flex items-center gap-1 flex-wrap">
                        <span className="text-xs text-gray-400 mr-1">Insert:</span>
                        {['{{display_name}}', '{{first_name}}', '{{last_name}}', '{{company_name}}', '{{email}}', '{{country}}', '{{position}}', '{{website}}', '{{tag}}'].map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => insertPlaceholder(p)}
                            className={`px-1.5 py-0.5 text-xs border rounded hover:bg-orange-100 transition-colors ${
                              p === '{{display_name}}'
                                ? 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100'
                                : 'text-orange-600 bg-orange-50 border-orange-200'
                            }`}
                            title={p === '{{display_name}}' ? 'Auto: first_name → company → "Valued Partner"' : undefined}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-[10px] text-gray-400">
                        Tip: Use pipe fallbacks like {'{{first_name|company_name|"Friend"}}'} — tries each field, uses first non-empty value.
                      </p>
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      disabled={submitting}
                      className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                    >
                      {submitting ? 'Saving...' : editingTemplate ? 'Save Changes' : 'Create Template'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Preview Modal */}
        {previewTemplate && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
              <div
                className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                onClick={() => setPreviewTemplate(null)}
              ></div>

              <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all w-full max-w-3xl">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">
                      Preview: {previewTemplate.name}
                    </h3>
                    <button
                      onClick={() => setPreviewTemplate(null)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <span className="text-2xl">×</span>
                    </button>
                  </div>
                </div>

                <div className="px-6 py-4">
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Subject:</p>
                    <p className="text-sm font-medium text-gray-900">{previewTemplate.subject}</p>
                  </div>

                  <div className="border rounded-lg p-4 bg-white min-h-[300px]">
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: previewTemplate.body_html }}
                    />
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setPreviewTemplate(null);
                      openEditModal(previewTemplate);
                    }}
                    className="px-4 py-2 border border-orange-600 text-orange-600 text-sm font-medium rounded-lg hover:bg-orange-50 transition-colors"
                  >
                    Edit Template
                  </button>
                  <button
                    onClick={() => setPreviewTemplate(null)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
              <div
                className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                onClick={() => !deleteLoading && setDeleteTarget(null)}
              ></div>

              <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all w-full max-w-md">
                <div className="px-6 py-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Template</h3>
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot be undone.
                  </p>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    disabled={deleteLoading}
                    className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteLoading}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {deleteLoading ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty editor placeholder style */}
        <style jsx global>{`
          [contenteditable][data-placeholder]:empty::before {
            content: attr(data-placeholder);
            color: #9ca3af;
            pointer-events: none;
          }
        `}</style>
      </div>
    </div>
  );
}
