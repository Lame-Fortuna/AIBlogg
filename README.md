# AI Hexo Blogger

A generic Hexo starter that turns rough notes into draft blog posts with GitHub Actions.

The workflow is:

1. Run the **AI Blog Writer** workflow manually.
2. Enter a title, rough content, optional image URLs, and optional reference URLs.
3. The workflow writes a Markdown post in `source/_posts/`.
4. It opens a pull request.
5. The PR preview workflow deploys a temporary GitHub Pages preview.
6. Review the rendered post.
7. Merge the PR to publish through the main GitHub Pages deployment.

## What This Includes

- Hexo 8 static site
- Default `landscape` theme
- AI post generator in `generate.js`
- GitHub Actions workflow for AI draft PRs
- GitHub Actions workflow for PR previews
- GitHub Actions workflow for publishing `main` to GitHub Pages

## Pattern Output

Generated posts include a `pattern` frontmatter field:

- `article`
- `listicle`
- `roundup`
- `simple`
- `freeform`

The generated body may also include helper classes such as:

- `listicle-entry`
- `listicle-meta`
- `roundup-grid`
- `roundup-card`
- `simple-split`

Plain Hexo themes will render these as normal HTML with unstyled classes. A custom theme can style those hooks for richer layouts.

## Requirements

- Node.js 20+
- npm
- GitHub repository with Actions enabled
- OpenRouter API key

## Local Setup

```bash
npm install
npm run build
npm run server
```

Local server:

```text
http://localhost:4000
```

## GitHub Secrets

Add these repository secrets:

```text
OPENROUTER_API_KEY
PR_TOKEN
```

`OPENROUTER_API_KEY` is used by `generate.js`.

`PR_TOKEN` should be a fine-grained GitHub personal access token scoped to this repository with:

- Contents: Read and write
- Pull requests: Read and write
- Metadata: Read-only

Using a personal token for PR creation lets the PR preview workflow run. PRs created with the default `GITHUB_TOKEN` do not trigger follow-up workflows.

## GitHub Pages Setup

This project uses branch-based Pages so PR previews and the live site can share the `gh-pages` branch.

In repository settings:

```text
Settings -> Pages
Source: Deploy from a branch
Branch: gh-pages
Folder: /root
```

Also enable:

```text
Settings -> Actions -> General -> Workflow permissions
Read and write permissions
```

## Publishing Flow

Run:

```text
Actions -> AI Blog Writer -> Run workflow
```

Inputs:

- `title`: optional working title
- `content`: required rough draft or notes
- `images`: optional comma-separated image URLs
- `references`: optional comma-separated reference URLs

The generated PR body includes:

- Markdown file path
- selected pattern
- preview URL
- live URL after merge

## Custom Theme Instance

For a polished personal site, create a separate fork or repo from this template, then add your custom theme there.

Suggested split:

- Public template repo: generic Hexo + AI workflow
- Personal site repo: custom theme, custom domain, real content, same AI workflow

If using a custom domain, add a `CNAME` file and set:

```yaml
url: https://yourdomain.com
root: /
```

in `_config.yml`.

## Commands

```bash
npm run build
npm run clean
npm run server
```

## Important Secret Safety

Never commit API keys. If a key is committed, rotate it immediately before making the repository public.
