<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Storefront architecture

- Preserve the React, Vite and TanStack Router/Start bootstrap required by hosting; use file-based routes rather than React Router or Next.js because the platform route pipeline is fixed.
- Centralize editable brand and demo catalogue data in `src/data/store.ts`; keep product views independent of commerce through `src/services/commerce.ts` so approved provider data can replace samples.
- Keep demo cart state in a shared session-memory React context; it must never imply stock reservation, payment or order creation.
- Define storefront visual roles and responsive layouts in `src/styles.css`; use shared Button controls and route-specific metadata for consistent appearance and accessibility.
