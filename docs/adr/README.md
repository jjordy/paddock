# Architecture Decision Records

This directory holds ADRs for `paddock` — short, dated write-ups of architectural decisions that future contributors (human or agent) should know about before changing related code.

## Format

One file per decision, numbered sequentially with a kebab-case slug:

```
0001-pure-ssg-no-server.md
0002-jolpica-data-checked-in-as-json.md
0003-svg-charts-no-library.md
```

Each ADR follows a tight structure:

```markdown
# <Title>

<One-paragraph statement of the decision in present tense.>

## Why

<The forces that drove the decision. Real constraints, not justifications.>

## Consequences

- <What this commits us to.>
- <What we're now willing to refuse.>
- <Known trade-offs we accept.>
```

## When to write one

When you make a decision that:

- Closes off an obvious alternative someone else would otherwise try.
- Will surprise a future reader if they don't know the rationale.
- Cuts across multiple files / modules and isn't visible from any one of them.

You don't need an ADR for routine choices. Reserve them for the load-bearing ones.

## When to read

- Before editing code that touches an area named in an ADR title.
- Before proposing a refactor — flag the affected ADRs in the proposal.
- Before adding a dependency — at least scan the titles.

If your work *contradicts* an existing ADR, say so explicitly. Don't silently override:

> _Contradicts ADR-0003 (SVG charts, no library) — but worth reopening because…_
