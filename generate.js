const fs = require('fs/promises');
const path = require('path');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL_NAME = process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b:free';

const PATTERN_DOCS = {
  article: `Use for longer reviews, essays, and reported pieces. Author mostly in Markdown. Use opening paragraphs followed by ##, ###, or #### section headings. The theme will wrap sections and keep each heading with its first paragraph. Do not add custom wrappers for normal prose.`,
  listicle: `Use for rankings, checklists, guides, or long item-by-item features. Every entry must use:
<section class="listicle-entry">
  <div>
    <h2>1. Item Title</h2>
    <div class="listicle-meta"><span>Optional detail</span></div>
    <p>First paragraph.</p>
  </div>
</section>
Entries may include lists, code snippets, paragraphs, and figures when the source content calls for them.`,
  roundup: `Use for grouped short features or compact collections. Wrap all cards in one <div class="roundup-grid">. Every item must use <section class="roundup-card">...</section>. Cards can contain h2, paragraphs, and images when the source content calls for them.`,
  simple: `Use for standard posts with a little structure control. Use ordinary Markdown where possible. For side-by-side sections, use <section class="simple-split"> with a text <div> and optional <figure>. For a reversed split, use <section class="simple-split reverse"> and put media first, text second.`,
  freeform: `Use ordinary Markdown with shared page framing and metadata. No special HTML wrappers are required.`
};

function yamlString(value) {
  return JSON.stringify(String(value || '').replace(/\r?\n/g, ' ').trim());
}

function slugify(value) {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return slug || `draft-${Date.now()}`;
}

function sanitizeTags(rawTags) {
  if (!rawTags) return ['general'];

  const tags = rawTags
    .split(',')
    .map(tag => tag.trim().toLowerCase())
    .map(tag => tag.replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, ' '))
    .filter(Boolean);

  return tags.length ? [...new Set(tags)].slice(0, 5) : ['general'];
}

async function uniquePostPath(slug) {
  const postsDir = path.join(process.cwd(), 'source', '_posts');
  await fs.mkdir(postsDir, { recursive: true });

  let candidate = slug;
  let index = 2;

  while (true) {
    const filepath = path.join(postsDir, `${candidate}.md`);

    try {
      await fs.access(filepath);
      candidate = `${slug}-${index}`;
      index += 1;
    } catch {
      return { slug: candidate, filepath };
    }
  }
}

async function askOpenRouter(systemPrompt, userPrompt) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured.');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      reasoning: { enabled: true }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API Error: ${response.status} ${response.statusText} ${errorText}`);
  }

  const data = await response.json();
  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

  if (!content) {
    throw new Error('OpenRouter returned an empty response.');
  }

  return content;
}

async function buildHexoPost() {
  try {
    const rawTitle = process.env.INPUT_TITLE || 'Draft Post';
    const roughContent = process.env.INPUT_CONTENT;

    if (!roughContent) throw new Error('No rough content provided.');
    console.log(`Starting AI pipeline for: "${rawTitle}"`);

    console.log('Step 1: Triaging pattern...');
    const triageSystem = `You are a strict classifier for the Broadsheet Hexo theme.
Choose exactly one pattern:
- article: longer reviews, essays, reported pieces, long-form prose
- listicle: rankings, checklists, guides, item-by-item features
- roundup: grouped short features, compact collections, recommendations
- simple: standard posts needing a little layout control or side-by-side sections
- freeform: short notes or ordinary Markdown
Respond with only the pattern word in lowercase.`;

    const patternRaw = await askOpenRouter(triageSystem, roughContent);
    let pattern = patternRaw.trim().toLowerCase().replace(/[^a-z]/g, '');

    if (!PATTERN_DOCS[pattern]) pattern = 'freeform';
    console.log(`-> Selected Pattern: ${pattern}`);

    console.log('Step 2: Expanding content and generating metadata...');
    const seoSystem = `You are an expert editor preparing content for the Broadsheet Hexo demo theme.
Expand the rough draft into a readable blog post and return this exact shape:
Title: [max 60 chars]
Description: [max 160 chars, one sentence, no line breaks]
Tags: [3-5 comma-separated tags]
Category: [one short lowercase category]
Content:
[expanded post body draft]

Do not invent factual claims beyond the rough draft unless they are generic connective prose.`;

    const expandedData = await askOpenRouter(seoSystem, roughContent);
    const titleMatch = expandedData.match(/^Title:\s*(.+)$/im);
    const descMatch = expandedData.match(/^Description:\s*(.+)$/im);
    const tagsMatch = expandedData.match(/^Tags:\s*(.+)$/im);
    const categoryMatch = expandedData.match(/^Category:\s*(.+)$/im);
    const contentMatch = expandedData.match(/Content:\s*([\s\S]+)/i);

    const finalTitle = titleMatch ? titleMatch[1].trim() : rawTitle;
    const finalDesc = descMatch ? descMatch[1].trim() : 'An AI-generated draft for editorial review.';
    const finalTags = sanitizeTags(tagsMatch ? tagsMatch[1] : '');
    const finalCategory = (categoryMatch ? categoryMatch[1] : 'drafts')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      || 'drafts';
    const baseContent = contentMatch ? contentMatch[1].trim() : expandedData.trim();

    console.log('Step 3: Structuring final markup...');
    const structureSystem = `You are formatting a post for the Broadsheet Hexo theme.
Selected pattern: ${pattern}

Theme rules:
${PATTERN_DOCS[pattern]}

Global rules:
- Return only the final Markdown/HTML body. No frontmatter.
- Do not wrap the output in code fences.
- Use images only if the rough draft explicitly provided an image URL or path.
- Do not use placeholder image paths such as /images/example.jpg.
- Keep raw HTML valid and balanced.
- For article and freeform, prefer Markdown headings and paragraphs.
- For listicle, roundup, and simple, use the exact helper classes from the theme contract.`;

    let finalBody = await askOpenRouter(structureSystem, baseContent);
    finalBody = finalBody.trim().replace(/^```(?:html|markdown|md)?\s*/i, '').replace(/\s*```$/i, '').trim();

    const dateStr = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const initialSlug = slugify(finalTitle);
    const { slug, filepath } = await uniquePostPath(initialSlug);
    const permalinkPath = `/${dateStr.slice(0, 4)}/${dateStr.slice(5, 7)}/${dateStr.slice(8, 10)}/${slug}/`;

    const tagYaml = finalTags.map(tag => `  - ${yamlString(tag)}`).join('\n');
    const frontmatter = `---
title: ${yamlString(finalTitle)}
date: ${dateStr}
description: ${yamlString(finalDesc)}
categories:
  - ${yamlString(finalCategory)}
tags:
${tagYaml}
pattern: ${pattern}
featured: false
---

${finalBody}
`;

    await fs.writeFile(filepath, frontmatter, 'utf8');

    const metadata = {
      title: finalTitle,
      description: finalDesc,
      pattern,
      category: finalCategory,
      tags: finalTags,
      slug,
      postPath: permalinkPath,
      markdownPath: path.relative(process.cwd(), filepath).replace(/\\/g, '/')
    };

    await fs.writeFile(path.join(process.cwd(), '.generated-post.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
    console.log(`-> Success! File written to ${filepath}`);
    console.log(`-> Post path: ${permalinkPath}`);
  } catch (error) {
    console.error('Pipeline failed:', error);
    process.exit(1);
  }
}

buildHexoPost();
