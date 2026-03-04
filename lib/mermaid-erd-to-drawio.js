#!/usr/bin/env node
/**
 * Converts a Mermaid erDiagram to draw.io XML using Entity Relation table shapes.
 * Usage: node mermaid-erd-to-drawio.js [input.mmd] [output.drawio]
 *        Default: reads stdin, writes stdout; or data/erd.mmd -> data/erd.drawio if no args.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const DEFAULT_INPUT = 'data/erd.mmd';
const DEFAULT_OUTPUT = 'data/erd.drawio';

// --- Parse Mermaid erDiagram ---

/**
 * Parse erDiagram text into { entities: [{ name, attributes: [{ type, name, pk, fk }] }], relationships: [{ from, to, label, card }] }
 */
function parseMermaidErd(text) {
  const lines = text.split(/\r?\n/);
  const entities = [];
  const relationships = [];
  const entityMap = new Map(); // name -> index

  // Relationship: "  EntityA ||--o{ EntityB : "label""  (crows-foot notation)
  const relRe = /^\s*(\w+)\s+(\|\|--\|\||\|\|--o\{|\|\|--o\||\}\|--\|\||\}\|--o\{|\}\|--o\||o--\|\||o--o\{|o--o\||\}o--o\{|\|\|--\|\{|\|\|--o\{|\|\{--\|\||o\{--o\||\|\{--o\{)\s+(\w+)\s*:\s*"([^"]*)"\s*$/;
  // Entity block start: "  EntityName {"
  const blockStartRe = /^\s*(\w+)\s*\{\s*$/;
  // Attribute: "    type attr PK" or "    type attr" or "    type attr FK"
  const attrRe = /^\s*(\S+)\s+(\S+)(?:\s+(PK|FK))?\s*$/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const relMatch = line.match(relRe);
    if (relMatch) {
      const [, from, card, to, label] = relMatch;
      relationships.push({ from, to, label, card: card.trim() });
      i++;
      continue;
    }

    const blockMatch = line.match(blockStartRe);
    if (blockMatch) {
      const entityName = blockMatch[1];
      const attributes = [];
      i++;
      while (i < lines.length && !/^\s*\}\s*$/.test(lines[i])) {
        const attrLine = lines[i].trim();
        if (attrLine) {
          const am = attrLine.match(attrRe);
          if (am) {
            const [, type, name, key] = am;
            attributes.push({
              type: type,
              name: name,
              pk: key === 'PK',
              fk: key === 'FK',
              raw: `${type} ${name}${key ? ' ' + key : ''}`,
            });
          } else {
            // Allow "string name" without PK/FK
            const parts = attrLine.split(/\s+/);
            if (parts.length >= 2) {
              const key = parts[parts.length - 1];
              const isPk = key === 'PK';
              const isFk = key === 'FK';
              const name = isPk || isFk ? parts[parts.length - 2] : parts[parts.length - 1];
              const type = parts.slice(0, isPk || isFk ? -2 : -1).join(' ') || parts[0];
              attributes.push({
                type,
                name,
                pk: isPk,
                fk: isFk,
                raw: attrLine,
              });
            }
          }
        }
        i++;
      }
      if (i < lines.length) i++; // skip "}"
      const idx = entities.length;
      entityMap.set(entityName, idx);
      entities.push({ name: entityName, attributes });
      continue;
    }

    i++;
  }

  return { entities, relationships, entityMap };
}

// --- Draw.io XML with Entity Relation table shape ---

const ROW_HEIGHT = 26;
const HEADER_SIZE = 30;
const TABLE_WIDTH = 200;
const LAYER_DX = 320; // horizontal spacing so orthogonal connector has room between boxes (not on target edge)
const LAYER_GAP_Y = 24; // vertical gap between nodes in same rank (stacked by actual height)
const RANK_Y_OFFSET = 80; // alternate Y per rank so edges (e.g. User→Comment) don't pass through middle entities
const MARGIN_X = 40;
const MARGIN_Y = 40;

function entityHeight(entity) {
  return HEADER_SIZE + Math.max(1, entity.attributes.length) * ROW_HEIGHT;
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generate one entity as a draw.io table: shape=table;startSize=HEADER_SIZE;container=1;childLayout=tableLayout;
 * with one column of attribute rows (partialRectangle).
 */
function emitEntityTable(entity, entityIndex, layerId) {
  const tableId = 100 + entityIndex;
  const height = HEADER_SIZE + Math.max(1, entity.attributes.length) * ROW_HEIGHT;
  const cells = [];

  // Table container (header = entity name); stroke so borders are drawn
  const tableStroke = 'strokeWidth=1;';
  cells.push({
    id: tableId,
    value: escapeXml(entity.name),
    style:
      'shape=table;html=1;whiteSpace=wrap;startSize=' +
      HEADER_SIZE +
      ';container=1;collapsible=0;childLayout=tableLayout;' +
      tableStroke,
    parent: layerId,
    vertex: true,
    geometry: { x: 0, y: 0, width: TABLE_WIDTH, height },
  });

  // Rows (partialRectangle) - one per attribute
  entity.attributes.forEach((attr, rowIndex) => {
    const rowId = 1000 + entityIndex * 100 + rowIndex;
    const rowY = HEADER_SIZE + rowIndex * ROW_HEIGHT;
    const rowParent = tableId;
    cells.push({
      id: rowId,
      value: escapeXml(attr.raw),
      style:
        'shape=partialRectangle;html=1;whiteSpace=wrap;collapsible=0;dropTarget=0;pointerEvents=0;top=0;left=0;bottom=0;right=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;align=left;spacingLeft=6;strokeWidth=1;',
      parent: rowParent,
      vertex: true,
      geometry: { x: 0, y: rowY, width: TABLE_WIDTH, height: ROW_HEIGHT },
    });
  });

  return cells;
}

function emitEdge(rel, entityMap, layerId, edgeId) {
  const fromIdx = entityMap.get(rel.from);
  const toIdx = entityMap.get(rel.to);
  if (fromIdx == null || toIdx == null) return null;
  const source = 100 + fromIdx;
  const target = 100 + toIdx;
  return {
    id: edgeId,
    value: escapeXml(rel.label),
    // left-to-right flow: connector attaches to left side center of target
    style:
      'endArrow=classic;html=1;rounded=0;edgeStyle=orthogonalEdgeStyle;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;',
    parent: layerId,
    edge: true,
    source,
    target,
  };
}

/**
 * Layered layout: assign each entity a rank from relationship direction (from → to),
 * then place left-to-right by rank, stacking vertically within each rank.
 * See brainstorming/algorithms/diagram-positioning.md.
 */
function layoutEntitiesLayered(entities, relationships, entityMap) {
  const n = entities.length;
  const rank = new Array(n).fill(0);

  // Propagate ranks: for each edge (from, to), rank[to] >= rank[from] + 1
  for (let iter = 0; iter < n; iter++) {
    let changed = false;
    for (const r of relationships) {
      const fromIdx = entityMap.get(r.from);
      const toIdx = entityMap.get(r.to);
      if (fromIdx == null || toIdx == null) continue;
      const newRank = rank[fromIdx] + 1;
      if (newRank > rank[toIdx]) {
        rank[toIdx] = newRank;
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Group entity indices by rank
  const rankToIndices = new Map();
  for (let i = 0; i < n; i++) {
    const r = rank[i];
    if (!rankToIndices.has(r)) rankToIndices.set(r, []);
    rankToIndices.get(r).push(i);
  }

  // Sort ranks and assign positions: x by rank, y by cumulative height within rank (no overlap)
  const sortedRanks = [...rankToIndices.keys()].sort((a, b) => a - b);
  const positions = new Array(n);

  for (const r of sortedRanks) {
    const indices = rankToIndices.get(r).sort((a, b) => a - b);
    const rankIdx = sortedRanks.indexOf(r);
    // Alternate Y per rank so connectors that skip a rank (e.g. User→Comment) route above the middle entity (Post), not through it
    const baseY = MARGIN_Y + (rankIdx % 2) * RANK_Y_OFFSET;
    let y = baseY;
    for (const entityIdx of indices) {
      positions[entityIdx] = {
        x: MARGIN_X + rankIdx * LAYER_DX,
        y,
      };
      y += entityHeight(entities[entityIdx]) + LAYER_GAP_Y;
    }
  }

  return positions;
}

function buildDrawioXml(parsed) {
  const { entities, relationships, entityMap } = parsed;
  const positions = layoutEntitiesLayered(entities, relationships, entityMap);

  const mxCells = [];
  let cellId = 1; // 0=root, 1=layer
  const nextId = () => ++cellId;

  const rootId = 0;
  const layerId = 1;
  mxCells.push({ id: rootId, parent: null });
  mxCells.push({ id: layerId, parent: rootId });

  const tableCells = [];
  for (let e = 0; e < entities.length; e++) {
    const cells = emitEntityTable(entities[e], e, layerId);
    const pos = positions[e];
    cells[0].geometry.x = pos.x;
    cells[0].geometry.y = pos.y;
    tableCells.push(...cells);
  }

  // Assign global ids to all cells (draw.io needs unique ids)
  const idMap = new Map();
  function assignIds(cells) {
    const out = [];
    for (const c of cells) {
      const newId = nextId();
      idMap.set(c.id, newId);
      out.push({ ...c, id: newId });
    }
    return out;
  }

  const allVertexCells = assignIds(tableCells);
  for (const c of allVertexCells) {
    const parentId = idMap.get(c.parent) ?? c.parent;
    mxCells.push({
      ...c,
      parent: parentId,
    });
  }

  // Edges: remap source/target to new ids
  let edgeId = 5000;
  for (const rel of relationships) {
    const edge = emitEdge(rel, entityMap, layerId, edgeId++);
    if (edge) {
      edge.id = nextId();
      edge.source = idMap.get(edge.source);
      edge.target = idMap.get(edge.target);
      if (edge.source != null && edge.target != null) {
        mxCells.push(edge);
      }
    }
  }

  // Build XML (root and layer emitted separately)
  const xmlCells = mxCells
    .filter(
      (c) => c.id !== rootId && c.id !== layerId && (c.geometry != null || c.edge)
    )
    .map((c) => {
      if (c.edge) {
        return `<mxCell id="${c.id}" value="${c.value || ''}" style="${c.style}" edge="1" parent="${layerId}" source="${c.source}" target="${c.target}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
      }
      const g = c.geometry;
      return `<mxCell id="${c.id}" value="${c.value || ''}" style="${c.style}" vertex="1" parent="${c.parent}"><mxGeometry x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" as="geometry"/></mxCell>`;
    });

  const layerCell = `<mxCell id="${layerId}" parent="${rootId}"/>`;
  const rootCell = `<mxCell id="${rootId}"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="mermaid-erd-to-drawio" version="22.1.0" etag="erd" type="device">
  <diagram id="erd" name="ERD">
    <mxGraphModel dx="1022" dy="594" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
      <root>
        ${rootCell}
        ${layerCell}
        ${xmlCells.join('\n        ')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

// --- Main ---

async function readInput(inputPath) {
  if (!inputPath) return null;
  return readFileSync(inputPath, 'utf8');
}

/**
 * Run conversion: inputPath (mmd) -> outputPath (drawio).
 * @param {string} inputPath - path to .mmd file
 * @param {string} outputPath - path to .drawio file (use '-' for stdout)
 */
export async function run(inputPath, outputPath) {
  let text;
  try {
    text = await readInput(inputPath);
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error(`Input file not found: ${inputPath}`);
    throw e;
  }

  if (!text || !text.includes('erDiagram')) {
    throw new Error('Input must contain a Mermaid erDiagram block.');
  }

  const parsed = parseMermaidErd(text);
  const xml = buildDrawioXml(parsed);

  if (outputPath === '-') {
    process.stdout.write(xml);
  } else {
    writeFileSync(outputPath, xml, 'utf8');
    console.error(`Wrote ${outputPath}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const inputPath = args[0] || DEFAULT_INPUT;
  const outputPath = args[1] ?? (args[0] ? inputPath.replace(/\.(mmd|mermaid)$/i, '.drawio') : DEFAULT_OUTPUT);
  await run(inputPath, outputPath);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}
