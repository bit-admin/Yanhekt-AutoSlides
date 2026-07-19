/**
 * Ambient module declarations for Editor.js tools that don't ship their own
 * type definitions (@editorjs/editorjs core does, these don't).
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

declare module '@editorjs/delimiter' {
  import type { ToolConstructable } from '@editorjs/editorjs';
  const Delimiter: ToolConstructable;
  export default Delimiter;
}

declare module '@editorjs/quote' {
  import type { ToolConstructable } from '@editorjs/editorjs';
  const Quote: ToolConstructable;
  export default Quote;
}

declare module '@editorjs/code' {
  import type { ToolConstructable } from '@editorjs/editorjs';
  const CodeTool: ToolConstructable;
  export default CodeTool;
}

declare module '@editorjs/table' {
  import type { ToolConstructable } from '@editorjs/editorjs';
  const Table: ToolConstructable;
  export default Table;
}
