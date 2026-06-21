/**
 * Ambient module declarations for Editor.js tools that don't ship their own
 * type definitions (@editorjs/editorjs core does, these three don't).
 * They are only ever passed into the EditorJS `tools` config, so a loose
 * ToolConstructable-compatible default export is sufficient.
 */
declare module '@editorjs/header' {
  import type { ToolConstructable } from '@editorjs/editorjs';
  const Header: ToolConstructable;
  export default Header;
}

declare module '@editorjs/list' {
  import type { ToolConstructable } from '@editorjs/editorjs';
  const List: ToolConstructable;
  export default List;
}

declare module '@editorjs/image' {
  import type { ToolConstructable } from '@editorjs/editorjs';
  const ImageTool: ToolConstructable;
  export default ImageTool;
}
