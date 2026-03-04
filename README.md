# iblokz-tools

CLI tools for diagram and data workflows. ESM-only, Node 18+.

## Installation

```bash
npm install -g iblokz-tools
# or
pnpm add -g iblokz-tools
```

## Commands

### mermaid-to-drawio

Convert a Mermaid `erDiagram` to draw.io XML (Entity Relation table shapes, orthogonal layout).

```bash
iblokz-tools mermaid-to-drawio <input.mmd> <output.drawio>
```

**Example**

```bash
iblokz-tools mermaid-to-drawio data/erd.mmd data/erd.drawio
```

- Input: `.mmd` (or `.mermaid`) file containing a Mermaid `erDiagram` block.
- Output: `.drawio` XML that you can open in [draw.io](https://app.diagrams.net/) or VS Code draw.io extension.

## Development

```bash
pnpm install
pnpm start   # watch lib + data, regenerate data/erd.drawio on change
node index.js mermaid-to-drawio data/erd.mmd data/erd.drawio
```

## License

MIT
