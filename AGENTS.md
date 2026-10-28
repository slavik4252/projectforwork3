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

- Imported landing + built-in CRM (from GitHub, originally Vite/Netlify) lives in src/components and src/components/crm; keep its look as-is. Why: migrated user site.
- CRM lists subscribe to realtime on leads/deals (useLeadsLive) and remount on open. Why: CRM previously loaded once and never showed new submissions.
- Site chat agent runs through a server function on Lovable AI (src/lib/ai-chat.functions.ts). Why: GigaChat needs a custom Russian root CA that the edge runtime cannot trust.
