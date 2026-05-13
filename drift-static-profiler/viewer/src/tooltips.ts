// Central glossary of "for dummies" tooltips. One source of truth so wording
// stays consistent across CallTree / DetailsPane / Statistics / Smells panes.
//
// Sources cited inline where the wording is non-obvious — these are the
// definitions practitioners actually use, not invented.

export const TIPS: Record<string, string> = {
  // ── Summary counts ────────────────────────────────────────────────────
  languages:
    'Programming languages detected in the analyzed source root.',
  files:
    'Number of source files we parsed (after .gitignore / .driftignore / built-in skips).',
  symbols:
    'Total functions + methods + classes defined across all files.',
  edges:
    'Total call relationships in the project. "A calls B" counts as one edge.',

  // ── Resource categories (the chips, the dots, the badges) ─────────────
  category_db:
    'Database call — ORM, raw SQL, NoSQL. Caught for SQLAlchemy, JPA/Hibernate, ' +
    'TypeORM, Prisma, Mongoose, Sequelize, Knex, psycopg2, pymongo and more.',
  category_network:
    'HTTP / gRPC / socket call — caught for requests, httpx, aiohttp, axios, ' +
    'node-fetch, got, OkHttp, Spring WebClient/RestTemplate, java.net.http.',
  category_io:
    'File system read/write. Caught for open(), fs.readFile, java.io/java.nio.',
  category_cache:
    'Cache touch — Redis, ioredis, memcached.',
  category_queue:
    'Message queue — Kafka, RabbitMQ (amqplib), BullMQ, JMS, SQS.',
  category_log:
    'Logging call. Usually noise, but flagged for completeness.',
  category_compute:
    'Pure computation — no external resource touched.',

  category_self:
    'Category of THIS symbol\'s own direct external calls. ' +
    'For example session.add() inside a method makes the method itself "db".',
  categories_reached:
    'Categories reachable through the entire call tree from here (transitive). ' +
    'Tells you "this handler eventually touches the DB" without you having to walk the tree.',

  // ── Per-symbol metrics ────────────────────────────────────────────────
  complexity:
    'Cyclomatic complexity (McCabe 1976): number of decision points (if / for / while / ' +
    'case / catch / && / ||) plus 1. Lower = easier to test. ' +
    'Thresholds: 1-4 simple, 5-9 moderate, 10-14 complex, 15+ untestable.',
  loc:
    'Lines of code in this symbol\'s body. A size proxy.',
  nesting_depth:
    'Maximum nested indentation level (if-inside-for-inside-while = 3). ' +
    'SonarQube\'s rule of thumb: keep ≤ 4 for readability.',
  parameter_count:
    'Number of formal parameters declared. > 5 often suggests refactoring ' +
    '("introduce a parameter object").',
  is_async:
    'Function uses async/await — Python "async def" or JS/TS "async function". ' +
    'Matters for the BLOCKING-IN-ASYNC smell.',
  is_recursive:
    'Symbol participates in a recursion cycle (mutual recursion or self-call). ' +
    'Detected via Tarjan strongly-connected components on the call graph.',

  // ── Fan-in / fan-out (graph) ──────────────────────────────────────────
  call_site_count:
    'Total invocations of this symbol anywhere in the project. ' +
    'Counts every line that calls it (so calling foo() three times from one function = 3).',
  callers_count:
    'Unique callers (different functions that call this symbol). Fan-in. ' +
    'High fan-in = widely-used utility; changing it ripples broadly.',
  callees_count:
    'Direct calls this symbol makes. Fan-out. ' +
    '> 15 often signals a "god function" doing too much.',
  subtree_size:
    'Total reachable symbols from here, including transitive callees. ' +
    'A static "blast radius" — how much code is involved when this entry executes.',
  pagerank:
    'PageRank score over the call graph (α = 0.85, Brin & Page). ' +
    'Symbols called by many heavily-called symbols score high. ' +
    'Useful for finding the central hubs of a codebase even without an obvious entry point.',

  // ── Tree percentages ──────────────────────────────────────────────────
  percent_total:
    'This subtree\'s share of the entry\'s total reachable symbols. ' +
    'The root is always 100%.',
  percent_parent:
    'This subtree\'s share of its DIRECT parent\'s subtree. ' +
    'Useful for spotting "this one child dominates its parent".',

  // ── Smells ────────────────────────────────────────────────────────────
  smell_n_plus_one:
    'N+1 QUERY: a database call inside a loop. ' +
    'Each iteration round-trips to the DB instead of fetching all rows at once. ' +
    'Classic performance antipattern — fix with batched / joined queries.',
  smell_blocking:
    'BLOCKING IN ASYNC: a sync I/O call (db/network/io) inside an async function ' +
    'without being awaited. The event loop is blocked, defeating async\'s entire benefit. ' +
    'Use an async library (httpx / aiohttp) or wrap with asyncio.to_thread.',
  smell_recursive:
    'RECURSIVE: this symbol is in a recursion cycle (direct or mutual). ' +
    'Make sure there\'s a base case and the depth is bounded.',

  // ── External calls + classification tiers ─────────────────────────────
  external_calls:
    'Calls whose target symbol isn\'t defined in the analyzed source — ' +
    'they go to third-party libs, the stdlib, framework code. ' +
    'These are where resource categorization gets attached.',
  in_loop:
    'This call site is inside a loop (for / while / comprehension). ' +
    'When combined with category=db/cache it produces the N+1 smell.',
  in_await:
    'This call site is wrapped in an await expression. ' +
    'Means the I/O is properly non-blocking.',
  tier_imported_module:
    'Classification tier B (STRONGEST): receiver name resolves to a known library import. ' +
    'Example: "import axios from \'axios\'" then "axios.post(...)" → network, no method-name guessing needed.',
  tier_receiver_pattern:
    'Classification tier C (MEDIUM): receiver name matches a well-known pattern ' +
    'like session / db / repo / axios / cache. Works without type info.',
  tier_method_signature:
    'Classification tier D (WEAKEST): method name alone is unambiguous. ' +
    'Only highly specific names like executeQuery, findOneAndUpdate, prepareStatement.',
  evidence:
    'Why the analyzer made this classification. Lets you verify or override.',

  // ── Hot paths ─────────────────────────────────────────────────────────
  hot_path:
    'A chain from an entry point ending at a categorized resource call. ' +
    'Static analog of a profiler "critical path" — but no runtime needed.',
  terminal_category:
    'The category of the final call in this hot path.',
  hot_path_depth:
    'How many call hops it takes from the entry to reach this resource. ' +
    'Deeper = more abstraction layers in the way.',

  // ── Statistics panels ─────────────────────────────────────────────────
  pagerank_top:
    'Top symbols by PageRank — the most "central" code. ' +
    'Refactoring these affects the most callers, so review them carefully.',
  dead_code:
    'Symbols with zero callers AND not pinned as entry points. ' +
    'Usually safe to delete (verify it isn\'t invoked dynamically / via reflection).',
  recursive_symbols:
    'Symbols in a strongly-connected component (size > 1) — direct or mutual recursion.',
  top_callers:
    'Symbols with the most unique callers (fan-in). ' +
    'These are your most-depended-on functions.',
  top_callees:
    'Symbols making the most direct calls (fan-out). ' +
    'Big numbers here often mean orchestrator or "god" functions.',

  // ── Flame graph & color modes ─────────────────────────────────────────
  flame_graph:
    'Hierarchical visualization (Brendan Gregg style). Each block = a function frame. ' +
    'Stack height = call depth. Block width = subtree size. Click any frame to zoom in.',
  flame_mode_kind:
    'Color frames by symbol type: function (blue), method (teal), class (orange).',
  flame_mode_category:
    'Color frames by resource category. Frames reaching the DB are tinted red.',
  flame_mode_complexity:
    'Color frames by cyclomatic complexity: teal (simple), blue, orange, red (complex), dark red (untestable).',
  flame_mode_smells:
    'Highlight only frames flagged as smells (N+1 / blocking / recursive). ' +
    'Everything else is dimmed.',

  // ── Kind badges ───────────────────────────────────────────────────────
  kind_function: 'A regular function (not inside a class).',
  kind_method:   'A method — function defined inside a class.',
  kind_class:    'A class definition.',
  kind_async_marker: 'This function is async (uses async / await).',

  // ── Truncation reasons ────────────────────────────────────────────────
  truncated_cycle:    'We stopped descending because this node is already on the path (cycle).',
  truncated_maxdepth: 'We stopped descending because we hit the --max-depth limit.',

  // ── App brand + toolbar ───────────────────────────────────────────────
  brand:
    'drift static profiler — language-agnostic static call-tree analyzer. ' +
    'Supports Python / Java / TypeScript / JavaScript / Go / Rust / Scala, ' +
    'builds a per-project call graph, classifies external calls (db / network / io / cache / queue / log), ' +
    'and surfaces hot paths and smells without running the code.',
  toolbar_fixture:
    'Which analyzed project to view. Each fixture is a JSON report produced by ' +
    '`make refresh` (built-in fixtures), `make scan` (one-shot custom analysis), ' +
    'or `make scan-roots` (auto-discovered entry points).',
  toolbar_entry:
    'Entry-point symbol whose call tree is shown above. One report can contain ' +
    'multiple entries — use the Roots tab to compare them side-by-side.',
  toolbar_color:
    'How frames in the flame graph are colored. The default ("by kind") shows ' +
    'function/method/class. Switch to "by category" to see which subtrees touch ' +
    'the database, network, etc., to "by complexity" to spot risky code, or to ' +
    '"smells only" to highlight just the antipatterns.',
  toolbar_search:
    'Filter the flame graph and call tree by symbol name (case-insensitive substring). ' +
    'Non-matching frames are dimmed instead of removed so structure stays visible.',
  toolbar_filter_chip:
    'Active resource-category filter. Frames whose subtree never reaches this ' +
    'category are dimmed. Click × to clear.',
  toolbar_back_to_root:
    'Reset the Details pane to show the current entry-point root.',

  // ── Bottom tabs ───────────────────────────────────────────────────────
  tab_call_tree:
    'Indented call tree under the selected entry point. Each row is one symbol with ' +
    'its %total, %parent, complexity, LOC, fan-in/out, PageRank, and smell flags. ' +
    'Click any row to drill in via the Details pane.',
  tab_call_graph:
    'Call graph: one box per symbol (deduped), arrows for caller → callee, ' +
    'orthogonal layout with the selected entry at the top. Each box shows ×N (call sites), ' +
    'Total reach + %, and the symbol\'s own LOC + complexity. Color bands reach: red ≥40%, ' +
    'amber 5-40%, green <5%. Drag to pan, scroll to zoom, click any box to drill into Details.',
  tab_roots:
    'Sortable table of every auto-discovered entry point in this report. ' +
    'Ranked by transitive reach (subtree size) like pprof\'s `top -cum` or ' +
    'Speedscope\'s Sandwich view. Click a row to focus the flame graph + call tree ' +
    'on that root.',
  tab_hot_paths:
    'Static "critical paths": chains from an entry point down to a categorized ' +
    'resource call (db / network / io / cache / queue / log). Each row tells you ' +
    '"this handler eventually hits the DB through these N hops".',
  tab_smells:
    'Antipatterns detected in the selected entry\'s subtree: N+1 queries (DB call ' +
    'inside a loop), blocking I/O inside async code (without await), and recursion ' +
    'cycles. Each row links to the offending symbol.',
  tab_statistics:
    'Project-wide rollups: top symbols by PageRank, fan-in, fan-out, dead code, ' +
    'recursion cycles, plus a language/files/symbols/edges summary. Click any row ' +
    'to jump to the symbol in the call tree.',

  // ── CallTree column headers ───────────────────────────────────────────
  col_symbol:
    'The fully-qualified symbol name (Class.method or function). Click any row ' +
    'to focus the Details pane on it.',
  col_file_line:
    'Source location: relative file path + line number of the symbol\'s definition.',

  // ── RootsView column abbreviations ────────────────────────────────────
  // The user-facing column header IS the abbreviation; the tooltip expands it.
  col_rank:
    'Rank (#) — position after sorting. The default sort is by reach (cumulative ' +
    'subtree size), descending. Click any column header to re-sort.',
  col_kind:
    'Symbol kind — fn (function), method (member of a class), or class itself. ' +
    'Different colors map to each kind in the flame graph.',
  col_reach:
    'Reach = transitive subtree size in the static call graph (deduped — cycles are ' +
    'counted once). The static-analysis analog of "cumulative samples" in pprof: ' +
    'how much code is reachable from this entry point.',
  col_cx:
    'Cx = cyclomatic complexity (McCabe, 1976) of THIS symbol\'s body — number of ' +
    'decision points (if / for / while / case / catch / && / ||) + 1. ' +
    'Rule of thumb: 1-4 simple, 5-9 moderate, 10-14 complex, 15+ untestable.',
  col_categories:
    'Resource categories this root\'s subtree eventually touches. ' +
    'Example: a route handler that calls a service that calls a repository that ' +
    'hits the DB would show "db:N" (N = count of reaching paths).',
  col_smells:
    'Number of smells anywhere in this root\'s subtree: N+1 risks + blocking-in-async ' +
    '+ recursive symbols. 0 = clean. Yellow = 1-3, red = 4+.',
  col_pr:
    'PR = PageRank (Brin & Page, 1998) over the call graph, α = 0.85. ' +
    'Higher = more central — symbols called by many heavily-called symbols. ' +
    'Useful for picking the most-impactful refactor targets.',

  // ── Smells table column headers ───────────────────────────────────────
  smells_col_smell:
    'Antipattern category. Hover the badge for the definition and the fix.',
  smells_col_symbol:
    'Function or method where the smell occurs.',
  smells_col_location:
    'file:line where the offending symbol is defined.',
  smells_col_evidence:
    'Why the analyzer flagged it: receiver + method names, in-loop / awaited flags ' +
    'of the underlying external call(s).',

  // ── Statistics summary panel ──────────────────────────────────────────
  stats_summary_panel:
    'Project totals: detected languages, files parsed, symbols extracted, and edges ' +
    '("A calls B" relationships) in the call graph, plus how many calls fall into ' +
    'each resource category.',

  // ── Inline abbreviations / badges ─────────────────────────────────────
  // Short labels that appear inside tree rows; users hover them to learn what
  // the abbreviation expands to.
  badge_n_plus_one_short: 'N+1 = N+1 query antipattern. Hover the row\'s smell badge for the full explanation.',
  badge_blocking_short:   'BLK = blocking I/O inside async. Hover the row\'s smell badge for the full explanation.',
  badge_recursive_short:  'REC = recursion cycle. Hover the row\'s smell badge for the full explanation.',
  badge_async_short:      'α = async function (uses async/await).',

  // ── Misc smaller affordances ──────────────────────────────────────────
  reaches_db_dot:
    'This subtree reaches a database call somewhere underneath. Click the row to expand and find the exact path.',

  // ── HotPaths column headers ───────────────────────────────────────────
  hot_col_category:
    'Resource category of the LAST frame in this path (db / network / io / cache / queue / log). ' +
    'Tells you what kind of external resource the chain ultimately touches.',
  hot_col_depth:
    'Number of call hops from the entry-point root to the categorized terminal frame. ' +
    'Deeper = more abstraction layers between the request and the resource.',
  hot_col_frames:
    'The actual chain of frames, root → … → terminal. Click any frame to jump to it ' +
    'in the call tree / Details pane.',

  // ── Statistics row-level columns ──────────────────────────────────────
  stats_col_symbol:
    'Symbol name (Class.method or function). Click the row to jump to it in the call tree.',
  stats_col_score:
    'PageRank score for this symbol (Brin & Page 1998, α = 0.85). Sums to 1.0 across all symbols. ' +
    'Higher = more central in the call graph.',
  stats_col_fanin:
    'Fan-in: how many DISTINCT functions call this symbol. High = depended on by many; ' +
    'changing it is high-blast-radius.',
  stats_col_fanout:
    'Fan-out: how many DISTINCT symbols this function directly calls. High = orchestrator-style code; ' +
    '>15 often signals a "god function".',
  stats_col_location:
    'file:line of the symbol\'s definition.',
};
