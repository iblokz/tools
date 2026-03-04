# Diagram positioning algorithms

Simple options for laying out diagram nodes (e.g. ERD entities) so they are readable and not overlapping. Focus: small-to-medium graphs (e.g. 5–20 nodes) for tools like draw.io.

## 1. Grid

**Idea:** Place nodes in a regular grid (rows × columns).

- **Pros:** Trivial, predictable, no overlaps if cell size is fixed.
- **Cons:** Ignores edges; related nodes may be far apart; often wastes space.
- **Use when:** No relationship data, or as fallback.

**Variant:** Square-ish grid (e.g. `cols = ceil(sqrt(n))`) so the diagram is roughly square.

---

## 2. Layered (ranked / Sugiyama-style)

**Idea:** Treat the diagram as a directed graph. Assign each node a **rank** (layer) from the edges (e.g. "from" → rank 0, "to" → rank 1). Place nodes by rank: rank 0 leftmost, then rank 1, etc. Within each rank, stack nodes vertically (or center them).

- **Pros:** Flow follows relationship direction; good for ERDs and flow-style diagrams; few crossing edges if ranks are chosen well.
- **Cons:** Need to handle cycles (e.g. break a back-edge or assign same rank); disconnected components need a default rank or separate placement.
- **Use when:** You have directed relationships (e.g. A → B) and want a left-to-right or top-to-bottom flow.

**Rank assignment (simple):**

- **BFS from “sources”:** Start with nodes that have no incoming edges (or fewest). Rank = 0. Then BFS: for each edge (u, v), rank[v] = max(rank[v], rank[u] + 1). Nodes with no incoming edges and not reached get rank 0.
- **Or:** For each edge (from, to), ensure rank(to) ≥ rank(from) + 1; then minimize total edge length or use topological order.

**Placement:** `x = margin + rank * columnSpacing`, `y = margin + indexInRank * rowSpacing`. Center or stagger within rank if you have multiple nodes per rank.

---

## 3. Circular

**Idea:** Place nodes on a circle (or ellipse). Order can be random, or by relationship (e.g. put connected nodes adjacent).

- **Pros:** Simple, symmetric, no overlap if radius is large enough.
- **Cons:** Long edges across the circle; not ideal when there is a clear direction (e.g. “from → to”).
- **Use when:** Undirected or when you want a compact, symmetric look.

---

## 4. Force-directed (spring-embedder)

**Idea:** Simulate forces: nodes repel each other; edges act as springs that pull connected nodes together. Iterate until (approximate) equilibrium.

- **Pros:** Often produces “organic,” readable layouts; clusters of connected nodes emerge naturally.
- **Cons:** Non-deterministic (or seed-dependent); can be slow for large graphs; may need tuning (repulsion strength, spring length).
- **Use when:** General-purpose graph with no obvious direction; you can run a few iterations in a script (no need for full physics).

---

## 5. Relationship-aware grid / clusters

**Idea:** Keep a grid or block layout but group nodes by connectivity. E.g. put all nodes in the same connected component in one “block”; within block use a small grid or a short chain. Place blocks so that related blocks are adjacent.

- **Pros:** Compromise between grid simplicity and “related things close.”
- **Cons:** More logic (components, block placement); can still look blocky.

---

## Recommendation for ERD (e.g. mermaid-erd-to-drawio)

- **Layered layout** fits ERDs well: relationships are directed (A “triggers” B, A “has” B). Assign ranks from edges, then place left-to-right by rank, with vertical stacking within each rank. Standalone nodes (no edges) can get rank 0 or be appended in their own column.
- **Fallback:** If the relationship graph is empty or cyclic in a way that breaks a simple rank assignment, fall back to **grid** so every diagram still gets a valid layout.

---

## References

- Sugiyama et al. (layered graph drawing)
- Force-directed: Fruchterman–Reingold, stress majorization
- Grid / circular: trivial implementations in most diagram tools

---

**Back:** [Home](../../../Home.md) · **See also:** [ERD (data)](../../../data/erd.md), script `bin/tools/data/mermaid-erd-to-drawio.js`
