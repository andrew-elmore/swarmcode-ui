import { test, expect } from '@playwright/test';
import { createTestProject, seedArticles, teardownProject } from '../../fixtures/seed';
import { seedArticle } from '../../helpers/api-client';
import {
  TAB_BOARD,
  TAB_ARTICLES,
  ARTICLES_VIEW,
  ARTICLE_DETAIL,
  NEW_ARTICLE_BUTTON,
  ARTICLE_EDIT_DIALOG,
  ARTICLE_EDIT_TITLE,
  ARTICLE_EDIT_TEXT,
  ARTICLE_EDIT_KEYWORDS,
  ARTICLE_EDIT_SAVE,
  ARTICLE_BACK_BUTTON,
  ARTICLE_EDIT_BUTTON,
  ARTICLE_DELETE_BUTTON,
  ARTICLE_SEARCH_TITLE,
  ARTICLE_SEARCH_KEYWORDS,
  articleRow,
  articleRef,
} from '../../helpers/selectors';

test.describe('Article CRUD', () => {
  let boardId: string;
  let projectPath: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Article CRUD Test');
    boardId = project.boardId;
    projectPath = project.path;
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test('create article via New Article dialog', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_ARTICLES).click();
    await expect(page.locator(ARTICLES_VIEW)).toBeVisible({ timeout: 5000 });

    // Click New Article
    await page.locator(NEW_ARTICLE_BUTTON).click();
    await expect(page.locator(ARTICLE_EDIT_DIALOG)).toBeVisible({ timeout: 3000 });

    // Fill title, text, keywords
    await page.locator(ARTICLE_EDIT_TITLE).locator('input').fill('Getting Started');
    await page.locator(ARTICLE_EDIT_TEXT).locator('textarea').first().fill('Welcome to the project.');
    await page.locator(ARTICLE_EDIT_KEYWORDS).locator('input').fill('setup, onboarding');

    // Submit
    await page.locator(ARTICLE_EDIT_SAVE).click();

    // Verify dialog closes and article appears in list
    await expect(page.locator(ARTICLE_EDIT_DIALOG)).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator(ARTICLES_VIEW).getByText('Getting Started')).toBeVisible({
      timeout: 5000,
    });
  });

  test('click article row opens detail view', async ({ page }) => {
    // Seed an article
    const result = await seedArticle(boardId, 'Architecture Overview', 'This describes the system architecture.', ['arch', 'design']);
    const articleId = result.article.objectId;

    await page.goto('/');
    await page.locator(TAB_ARTICLES).click();
    await expect(page.locator(articleRow(articleId))).toBeVisible({ timeout: 5000 });

    // Click the row
    await page.locator(articleRow(articleId)).click();

    // Verify detail view
    await expect(page.locator(ARTICLE_DETAIL)).toBeVisible({ timeout: 3000 });
    await expect(page.locator(ARTICLE_DETAIL).getByText('Architecture Overview')).toBeVisible();
    await expect(page.locator(ARTICLE_DETAIL).getByText('This describes the system architecture.')).toBeVisible();

    // Verify keyword chips
    await expect(page.locator(ARTICLE_DETAIL).getByText('arch')).toBeVisible();
    await expect(page.locator(ARTICLE_DETAIL).getByText('design')).toBeVisible();

    // Verify Updated date label is present
    await expect(page.locator(ARTICLE_DETAIL).getByText('Updated:')).toBeVisible();
  });

  test('edit article (title rename + text + keywords)', async ({ page }) => {
    // Seed an article to edit
    const result = await seedArticle(boardId, 'Old Title', 'Old content.', ['old']);
    const articleId = result.article.objectId;

    await page.goto('/');
    await page.locator(TAB_ARTICLES).click();
    await expect(page.locator(articleRow(articleId))).toBeVisible({ timeout: 5000 });

    // Open detail
    await page.locator(articleRow(articleId)).click();
    await expect(page.locator(ARTICLE_DETAIL)).toBeVisible({ timeout: 3000 });

    // Click Edit
    await page.locator(ARTICLE_EDIT_BUTTON).click();
    await expect(page.locator(ARTICLE_EDIT_DIALOG)).toBeVisible({ timeout: 3000 });

    // Change title
    await page.locator(ARTICLE_EDIT_TITLE).locator('input').clear();
    await page.locator(ARTICLE_EDIT_TITLE).locator('input').fill('New Title');

    // Change text
    await page.locator(ARTICLE_EDIT_TEXT).locator('textarea').first().clear();
    await page.locator(ARTICLE_EDIT_TEXT).locator('textarea').first().fill('Updated content.');

    // Change keywords
    await page.locator(ARTICLE_EDIT_KEYWORDS).locator('input').clear();
    await page.locator(ARTICLE_EDIT_KEYWORDS).locator('input').fill('new, updated');

    // Save
    await page.locator(ARTICLE_EDIT_SAVE).click();
    await expect(page.locator(ARTICLE_EDIT_DIALOG)).not.toBeVisible({ timeout: 5000 });

    // Verify updated values in detail view
    await expect(page.locator(ARTICLE_DETAIL).getByText('New Title')).toBeVisible({ timeout: 5000 });
    await expect(page.locator(ARTICLE_DETAIL).getByText('Updated content.')).toBeVisible();
    await expect(page.locator(ARTICLE_DETAIL).getByText('new')).toBeVisible();
    await expect(page.locator(ARTICLE_DETAIL).getByText('updated')).toBeVisible();
  });

  test('delete article with confirmation', async ({ page }) => {
    // Seed an article to delete
    const result = await seedArticle(boardId, 'To Be Deleted', 'Temporary article.', ['temp']);
    const articleId = result.article.objectId;

    await page.goto('/');
    await page.locator(TAB_ARTICLES).click();
    await expect(page.locator(articleRow(articleId))).toBeVisible({ timeout: 5000 });

    // Open detail
    await page.locator(articleRow(articleId)).click();
    await expect(page.locator(ARTICLE_DETAIL)).toBeVisible({ timeout: 3000 });

    // Click Delete — confirmation dialog should appear
    await page.locator(ARTICLE_DELETE_BUTTON).click();
    await expect(page.getByText('Delete Article')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Are you sure you want to delete')).toBeVisible();

    // Click Cancel — article should remain
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator(ARTICLE_DETAIL)).toBeVisible();
    await expect(page.locator(ARTICLE_DETAIL).getByText('To Be Deleted')).toBeVisible();

    // Click Delete again and confirm
    await page.locator(ARTICLE_DELETE_BUTTON).click();
    await expect(page.getByText('Delete Article')).toBeVisible({ timeout: 3000 });
    await page.getByRole('button', { name: 'Delete' }).last().click();

    // Should return to list view and article should be gone
    await expect(page.locator(ARTICLES_VIEW)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(articleRow(articleId))).not.toBeVisible({ timeout: 5000 });
  });

  test('create article shows (no content) for empty text', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_ARTICLES).click();
    await expect(page.locator(ARTICLES_VIEW)).toBeVisible({ timeout: 5000 });

    // Create article with no text
    await page.locator(NEW_ARTICLE_BUTTON).click();
    await expect(page.locator(ARTICLE_EDIT_DIALOG)).toBeVisible({ timeout: 3000 });
    await page.locator(ARTICLE_EDIT_TITLE).locator('input').fill('Empty Article');
    await page.locator(ARTICLE_EDIT_SAVE).click();
    await expect(page.locator(ARTICLE_EDIT_DIALOG)).not.toBeVisible({ timeout: 5000 });

    // Click the article to open detail
    await page.locator(ARTICLES_VIEW).getByText('Empty Article').click();
    await expect(page.locator(ARTICLE_DETAIL)).toBeVisible({ timeout: 3000 });

    // Verify "(no content)" is shown
    await expect(page.locator(ARTICLE_DETAIL).getByText('(no content)')).toBeVisible();
  });
});

test.describe('Article List & Search', () => {
  let boardId: string;
  let projectPath: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Article Search Test');
    boardId = project.boardId;
    projectPath = project.path;
    // Seed 3 articles with distinct titles and keywords
    await seedArticles(boardId, [
      { title: 'Bravo Guide', text: 'Bravo content.', keywords: ['guide', 'bravo'] },
      { title: 'Alpha Guide', text: 'Alpha content.', keywords: ['guide', 'alpha'] },
      { title: 'Charlie Notes', text: 'Charlie content.', keywords: ['notes', 'charlie'] },
    ]);
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test('list view shows all articles alphabetically', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_ARTICLES).click();
    await expect(page.locator(ARTICLES_VIEW)).toBeVisible({ timeout: 5000 });

    // Get all article title cells in order
    const rows = page.locator(ARTICLES_VIEW).locator('table tbody tr');
    await expect(rows).toHaveCount(3, { timeout: 5000 });

    // Verify alphabetical order: Alpha, Bravo, Charlie
    await expect(rows.nth(0)).toContainText('Alpha Guide');
    await expect(rows.nth(1)).toContainText('Bravo Guide');
    await expect(rows.nth(2)).toContainText('Charlie Notes');
  });

  test('search by title', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_ARTICLES).click();
    await expect(page.locator(ARTICLES_VIEW)).toBeVisible({ timeout: 5000 });

    // Type title search
    await page.locator(ARTICLE_SEARCH_TITLE).locator('input').fill('Alpha');
    await page.getByRole('button', { name: 'Search' }).click();

    // Verify result count
    await expect(page.getByText('1 result found')).toBeVisible({ timeout: 5000 });

    // Verify only Alpha is shown
    const rows = page.locator(ARTICLES_VIEW).locator('table tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Alpha Guide');
  });

  test('search by keywords', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_ARTICLES).click();
    await expect(page.locator(ARTICLES_VIEW)).toBeVisible({ timeout: 5000 });

    // Search by keyword 'notes' — only Charlie Notes has it
    await page.locator(ARTICLE_SEARCH_KEYWORDS).locator('input').fill('notes');
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(page.getByText('1 result found')).toBeVisible({ timeout: 5000 });
    const rows = page.locator(ARTICLES_VIEW).locator('table tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Charlie Notes');
  });

  test('combined search (title + keywords)', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_ARTICLES).click();
    await expect(page.locator(ARTICLES_VIEW)).toBeVisible({ timeout: 5000 });

    // Search title 'Guide' + keyword 'alpha' — should match only Alpha Guide
    await page.locator(ARTICLE_SEARCH_TITLE).locator('input').fill('Guide');
    await page.locator(ARTICLE_SEARCH_KEYWORDS).locator('input').fill('alpha');
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(page.getByText('1 result found')).toBeVisible({ timeout: 5000 });
    const rows = page.locator(ARTICLES_VIEW).locator('table tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Alpha Guide');
  });

  test('empty search results', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_ARTICLES).click();
    await expect(page.locator(ARTICLES_VIEW)).toBeVisible({ timeout: 5000 });

    // Search for nonexistent term
    await page.locator(ARTICLE_SEARCH_TITLE).locator('input').fill('Nonexistent');
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(page.getByText('0 results found')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('No articles matched your search.')).toBeVisible();
  });

  test('clear button resets search', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_ARTICLES).click();
    await expect(page.locator(ARTICLES_VIEW)).toBeVisible({ timeout: 5000 });

    // Perform a search first
    await page.locator(ARTICLE_SEARCH_TITLE).locator('input').fill('Alpha');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('1 result found')).toBeVisible({ timeout: 5000 });

    // Verify Clear button is present and click it
    const clearButton = page.getByRole('button', { name: 'Clear' });
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    // All articles should reappear
    const rows = page.locator(ARTICLES_VIEW).locator('table tbody tr');
    await expect(rows).toHaveCount(3, { timeout: 5000 });

    // Clear button should disappear
    await expect(clearButton).not.toBeVisible();

    // Result count text should also be gone
    await expect(page.getByText('result found')).not.toBeVisible();
    await expect(page.getByText('results found')).not.toBeVisible();
  });
});

test.describe('Inline [[references]]', () => {
  let boardId: string;
  let projectPath: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Article References Test');
    boardId = project.boardId;
    projectPath = project.path;
    await seedArticles(boardId, [
      { title: 'Article A', text: 'See [[Article B]] for details.', keywords: ['ref-test'] },
      { title: 'Article B', text: 'This is Article B content.', keywords: ['ref-test'] },
      { title: 'Has Missing Ref', text: 'See [[Nonexistent]] article.', keywords: ['ref-test'] },
      { title: 'Has Known Ref', text: 'See [[Known Target]] here.', keywords: ['ref-test'] },
      { title: 'Known Target', text: 'I am the known target.', keywords: ['ref-test'] },
    ]);
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test('clicking a [[reference]] navigates to referenced article', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_ARTICLES).click();
    await expect(page.locator(ARTICLES_VIEW)).toBeVisible({ timeout: 5000 });

    // Click Article A to open detail
    await page.locator(ARTICLES_VIEW).getByText('Article A').click();
    await expect(page.locator(ARTICLE_DETAIL)).toBeVisible({ timeout: 3000 });
    await expect(page.locator(ARTICLE_DETAIL).getByText('Article A')).toBeVisible();

    // Click the [[Article B]] reference link
    await page.locator(articleRef('Article B')).click();

    // Verify detail view switches to Article B
    await expect(page.locator(ARTICLE_DETAIL).getByText('This is Article B content.')).toBeVisible({
      timeout: 5000,
    });
  });

  test('missing reference styled in red/italic', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_ARTICLES).click();
    await expect(page.locator(ARTICLES_VIEW)).toBeVisible({ timeout: 5000 });

    // Open the article with the missing reference
    await page.locator(ARTICLES_VIEW).getByText('Has Missing Ref').click();
    await expect(page.locator(ARTICLE_DETAIL)).toBeVisible({ timeout: 3000 });

    // Verify the reference link exists and has error/italic styling
    const refLink = page.locator(articleRef('Nonexistent'));
    await expect(refLink).toBeVisible();
    await expect(refLink).toHaveCSS('font-style', 'italic');

    // MUI error.main resolves to an rgb red color
    const color = await refLink.evaluate((el) => getComputedStyle(el).color);
    // error.main is typically rgb(211, 47, 47) or similar red — verify red channel dominates
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    expect(match).toBeTruthy();
    const [, r, g, b] = match!.map(Number);
    expect(r).toBeGreaterThan(150);
    expect(g).toBeLessThan(100);
    expect(b).toBeLessThan(100);
  });

  test('existing reference styled normally', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_ARTICLES).click();
    await expect(page.locator(ARTICLES_VIEW)).toBeVisible({ timeout: 5000 });

    // Open the article with the known reference
    await page.locator(ARTICLES_VIEW).getByText('Has Known Ref').click();
    await expect(page.locator(ARTICLE_DETAIL)).toBeVisible({ timeout: 3000 });

    // Verify the reference link exists and has normal (non-italic) styling
    const refLink = page.locator(articleRef('Known Target'));
    await expect(refLink).toBeVisible();
    await expect(refLink).toHaveCSS('font-style', 'normal');

    // MUI primary.main resolves to a blue color — verify blue channel dominates
    const color = await refLink.evaluate((el) => getComputedStyle(el).color);
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    expect(match).toBeTruthy();
    const [, r, g, b] = match!.map(Number);
    expect(b).toBeGreaterThan(150);
    expect(r).toBeLessThan(100);
  });
});

test.describe('Articles Tab Navigation', () => {
  let boardId: string;
  let projectPath: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Article Tab Nav Test');
    boardId = project.boardId;
    projectPath = project.path;
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test('articles tab is visible and clickable', async ({ page }) => {
    await page.goto('/');

    // Verify tab is visible
    await expect(page.locator(TAB_ARTICLES)).toBeVisible({ timeout: 5000 });

    // Click it
    await page.locator(TAB_ARTICLES).click();

    // Verify articles view renders
    await expect(page.locator(ARTICLES_VIEW)).toBeVisible({ timeout: 5000 });
  });

  test('tab shows article content after switching tabs', async ({ page }) => {
    // Seed articles so there's content to verify
    await seedArticles(boardId, [
      { title: 'Persistent Article', text: 'Still here.', keywords: ['nav'] },
    ]);

    await page.goto('/');
    await page.locator(TAB_ARTICLES).click();
    await expect(page.locator(ARTICLES_VIEW)).toBeVisible({ timeout: 5000 });

    // Verify article is listed
    await expect(page.locator(ARTICLES_VIEW).getByText('Persistent Article')).toBeVisible({
      timeout: 5000,
    });

    // Switch to Board tab
    await page.locator(TAB_BOARD).click();
    await expect(page.locator(ARTICLES_VIEW)).not.toBeVisible();

    // Switch back to Articles tab
    await page.locator(TAB_ARTICLES).click();
    await expect(page.locator(ARTICLES_VIEW)).toBeVisible({ timeout: 5000 });

    // Verify articles still display
    await expect(page.locator(ARTICLES_VIEW).getByText('Persistent Article')).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe('Articles — mobile', () => {
  test.use({
    viewport: { width: 375, height: 812 },
    isMobile: true,
  });

  let boardId: string;
  let projectPath: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Article Mobile Test');
    boardId = project.boardId;
    projectPath = project.path;
    await seedArticles(boardId, [
      { title: 'Mobile Article', text: 'Mobile content.', keywords: ['mobile', 'test'] },
    ]);
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test('mobile article list hides Keywords column', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_ARTICLES).click();
    await expect(page.locator(ARTICLES_VIEW)).toBeVisible({ timeout: 5000 });

    // Verify article row is visible with title
    await expect(page.locator(ARTICLES_VIEW).getByText('Mobile Article')).toBeVisible({
      timeout: 5000,
    });

    // Verify Title and Updated column headers are visible
    const headers = page.locator(ARTICLES_VIEW).locator('table thead th');
    await expect(headers.nth(0)).toContainText('Title');
    await expect(headers.nth(1)).toContainText('Updated');

    // Verify only 2 column headers (Keywords column hidden on mobile)
    await expect(headers).toHaveCount(2);
  });

  test('mobile article create/edit dialog is fullscreen', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_ARTICLES).click();
    await expect(page.locator(ARTICLES_VIEW)).toBeVisible({ timeout: 5000 });

    // Click New Article
    await page.locator(NEW_ARTICLE_BUTTON).click();
    await expect(page.locator(ARTICLE_EDIT_DIALOG)).toBeVisible({ timeout: 3000 });

    // Verify the dialog is rendered fullscreen — MUI adds the MuiDialog-paperFullScreen class
    const paper = page.locator(ARTICLE_EDIT_DIALOG).locator('.MuiDialog-paper');
    await expect(paper).toHaveClass(/MuiDialog-paperFullScreen/);
  });

  test('mobile tab navigation to Articles', async ({ page }) => {
    await page.goto('/');

    // Verify Articles tab is visible on mobile
    await expect(page.locator(TAB_ARTICLES)).toBeVisible({ timeout: 5000 });

    // Click it
    await page.locator(TAB_ARTICLES).click();

    // Verify articles view renders
    await expect(page.locator(ARTICLES_VIEW)).toBeVisible({ timeout: 5000 });

    // Verify seeded article is accessible
    await expect(page.locator(ARTICLES_VIEW).getByText('Mobile Article')).toBeVisible({
      timeout: 5000,
    });
  });
});
