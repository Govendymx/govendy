'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Image as ImageExtension } from '@tiptap/extension-image';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { FontSize } from './extensions/FontSize';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Underline } from '@tiptap/extension-underline';
import { Link as LinkExtension } from '@tiptap/extension-link';
import { EmojiPicker } from '@/components/EmojiPicker';
import { useCallback } from 'react';

type RichTextEditorProps = {
  content: string;
  onChange: (html: string) => void;
  onImageUpload?: (file: File) => Promise<string>;
  availableImages?: string[];
  editable?: boolean;
};

const MenuBar = ({
  editor,
  availableImages = [],
}: {
  editor: any;
  availableImages?: string[];
}) => {
  const addExistingImage = useCallback((url: string) => {
    if (!editor) return;
    editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL del enlace:', previousUrl);

    if (url === null) {
      return;
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 border-b border-gray-200 bg-gray-50 p-2 rounded-t-xl">
      <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`rounded p-1.5 text-sm font-medium transition-colors ${editor.isActive('bold') ? 'bg-gray-200 text-black' : 'text-gray-600 hover:bg-gray-200'
            }`}
          title="Negrita"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`rounded p-1.5 text-sm font-medium transition-colors ${editor.isActive('italic') ? 'bg-gray-200 text-black' : 'text-gray-600 hover:bg-gray-200'
            }`}
          title="Cursiva"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`rounded p-1.5 text-sm font-medium transition-colors ${editor.isActive('underline') ? 'bg-gray-200 text-black' : 'text-gray-600 hover:bg-gray-200'
            }`}
          title="Subrayado"
        >
          U
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`rounded p-1.5 text-sm font-medium transition-colors ${editor.isActive('strike') ? 'bg-gray-200 text-black' : 'text-gray-600 hover:bg-gray-200'
            }`}
          title="Tachado"
        >
          S
        </button>
      </div>

      <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).unsetFontSize().run()}
          className={`rounded p-1.5 text-sm font-medium transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 text-black' : 'text-gray-600 hover:bg-gray-200'
            }`}
          title="Título 1"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).unsetFontSize().run()}
          className={`rounded p-1.5 text-sm font-medium transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 text-black' : 'text-gray-600 hover:bg-gray-200'
            }`}
          title="Título 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).unsetFontSize().run()}
          className={`rounded p-1.5 text-sm font-medium transition-colors ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200 text-black' : 'text-gray-600 hover:bg-gray-200'
            }`}
          title="Título 3"
        >
          H3
        </button>
      </div>

      <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`rounded p-1.5 text-sm font-medium transition-colors ${editor.isActive('bulletList') ? 'bg-gray-200 text-black' : 'text-gray-600 hover:bg-gray-200'
            }`}
          title="Lista con viñetas"
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`rounded p-1.5 text-sm font-medium transition-colors ${editor.isActive('orderedList') ? 'bg-gray-200 text-black' : 'text-gray-600 hover:bg-gray-200'
            }`}
          title="Lista numerada"
        >
          1. List
        </button>
      </div>

      <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
        <select
          onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
          value={editor.getAttributes('textStyle').fontSize || ''}
          className="h-8 rounded border border-gray-300 bg-white px-2 py-0 text-xs text-gray-700 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
          title="Tamaño de letra"
        >
          <option value="" disabled>Tam.</option>
          <option value="12px">12</option>
          <option value="14px">14</option>
          <option value="16px">16</option>
          <option value="18px">18</option>
          <option value="20px">20</option>
          <option value="24px">24</option>
          <option value="30px">30</option>
        </select>
      </div>

      <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
        <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded hover:bg-gray-200" title="Color de texto">
          <span className="text-lg font-bold" style={{ color: editor.getAttributes('textStyle').color || '#000000' }}>A</span>
          <input
            type="color"
            onInput={(event) => editor.chain().focus().setColor((event.target as HTMLInputElement).value).run()}
            value={editor.getAttributes('textStyle').color || '#000000'}
            className="absolute h-0 w-0 opacity-0"
          />
        </label>
      </div>

      <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`rounded p-1.5 text-sm font-medium transition-colors ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200 text-black' : 'text-gray-600 hover:bg-gray-200'
            }`}
          title="Alinear izquierda"
        >
          Izquierda
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`rounded p-1.5 text-sm font-medium transition-colors ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200 text-black' : 'text-gray-600 hover:bg-gray-200'
            }`}
          title="Centrar"
        >
          Centro
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`rounded p-1.5 text-sm font-medium transition-colors ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200 text-black' : 'text-gray-600 hover:bg-gray-200'
            }`}
          title="Alinear derecha"
        >
          Derecha
        </button>
      </div>

      {availableImages.length > 0 && (
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <span className="text-xs text-gray-500 mr-1">Imágenes:</span>
          {availableImages.map((src, i) => (
            <button
              type="button"
              key={i}
              onClick={() => addExistingImage(src)}
              className="relative h-8 w-8 overflow-hidden rounded border border-gray-200 hover:border-brand-orange"
              title="Insertar esta imagen"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`img-${i}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
        <button
          type="button"
          onClick={setLink}
          className={`rounded p-1.5 text-sm font-medium transition-colors ${editor.isActive('link') ? 'bg-gray-200 text-black' : 'text-gray-600 hover:bg-gray-200'
            }`}
          title="Enlace"
        >
          🔗
        </button>
        <EmojiPicker onEmojiSelect={(emoji) => editor.chain().focus().insertContent(emoji).run()} className="" />
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          className="rounded p-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
          title="Insertar tabla"
        >
          Tabla
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().deleteTable().run()}
          disabled={!editor.can().deleteTable()}
          className="rounded p-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-30"
          title="Borrar tabla"
        >
          ❌
        </button>
      </div>
    </div>
  );
};

export default function RichTextEditor({
  content,
  onChange,
  onImageUpload,
  availableImages,
  editable = true,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      ImageExtension,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Underline,
      LinkExtension.configure({
        openOnClick: false,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
    editorProps: {
      attributes: {
        className: 'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[300px] p-4 text-gray-700 prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-a:text-brand-orange prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl prose-img:shadow-sm marker:text-gray-400',
        style: 'min-height: 300px;',
      },
    },
  });

  return (
    <div
      className="flex flex-col w-full rounded-xl border border-gray-300 bg-white shadow-sm transition-all focus-within:border-brand-orange focus-within:ring-1 focus-within:ring-brand-orange"
    >
      {editable && <MenuBar editor={editor} availableImages={availableImages} />}
      <EditorContent
        editor={editor}
        className="flex-1 min-h-[300px] rounded-b-xl cursor-text [&_.ProseMirror]:min-h-[300px] [&_.ProseMirror]:h-full [&_.ProseMirror]:outline-none"
        onClick={() => editor?.chain().focus().run()}
      />
    </div>
  );
}
