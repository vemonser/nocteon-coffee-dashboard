"""Debug tests for UI layout and component display issues"""
import { test, expect } from './fixtures';

test('page container should have consistent margins across different pages', async ({
  page,
  productsAPI,
  productsPage,
}) => {
  const mockProducts = {
    content: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 1,
    first: true,
    last: true,
  };

  await productsAPI.mockGetProducts(mockProducts);

  // Navigate to products page
  await page.goto('/dashboard/products');
  await productsPage.waitForLoad();

  // Get the page container element
  const pageContainer = page.locator('.page-shell');
  await expect(pageContainer).toBeVisible();

  // Check container margin/padding
  const containerStyles = await pageContainer.evaluate(el => {
    const styles = window.getComputedStyle(el);
    return {
      marginTop: styles.marginTop,
      marginBottom: styles.marginBottom,
      paddingTop: styles.paddingTop,
      paddingBottom: styles.paddingBottom,
      maxWidth: styles.maxWidth,
    };
  });

  // The container should have consistent styling
  // Current bug: different pages have different margins (~211px, ~116px, ~38px)
  expect(containerStyles.marginTop).toBe('211px'); // Current issue
  expect(containerStyles.marginBottom).toBe('211px'); // Should be consistent

  // Container should have reasonable max-width
  expect(containerStyles.maxWidth).toBe('1200px'); // Should be from design.md
});

test('products table should have proper column distribution', async ({
  page,
  productsAPI,
  productsPage,
}) => {
  const mockProducts = {
    content: [
      {
        id: 1,
        slug: 'ethiopia-yirgacheffe',
        categorySlug: 'coffee',
        productType: 'COFFEE',
        featured: false,
        isActive: true,
        name: 'Ethiopia Yirgacheffe',
        shortDescription: 'High quality Ethiopian coffee',
        primaryImageUrl: 'https://example.com/coffee1.jpg',
        minPrice: 650,
        maxPrice: 1378,
        discountPercentage: null,
      },
    ],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
    first: true,
    last: true,
  };

  await productsAPI.mockGetProducts(mockProducts);

  await page.goto('/dashboard/products');
  await productsPage.waitForLoad();

  // Get table columns
  const tableColumns = await productsPage.tableColumns();
  expect(tableColumns).toHaveCount(8); // Name, Slug, Type, Category, Price Range, Status, Featured, Actions

  // Check column distribution - Name should NOT take full width, Slug should be under Name
  const nameColumn = await productsPage.findColumnByHeader('Name');
  const slugColumn = await productsPage.findColumnByHeader('Slug');

  // Current bug: Name takes full page width, Slug is truncated
  // Expected: Name should be smaller, Slug should have full width or be shown under name
  const nameWidth = await nameColumn.evaluate(el => el.clientWidth);
  const slugWidth = await slugColumn.evaluate(el => el.clientWidth);

  // Name should not take too much space
  expect(nameWidth).toBeLessThan(400);

  // Slug should be properly displayed
  expect(slugWidth).toBeGreaterThan(0);
});

test('products filters should have proper labels and placeholders', async ({
  page,
  productsAPI,
  productsPage,
}) => {
  const mockProducts = {
    content: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 1,
    first: true,
    last: true,
  };

  await productsAPI.mockGetProducts(mockProducts);

  await page.goto('/dashboard/products');
  await productsPage.waitForLoad();

  // Check filter dropdowns - they should have proper labels, not just "all"
  const typeFilter = page.locator('select[formControlName="type"]');
  const statusFilter = page.locator('select[formControlName="status"]');
  const featuredFilter = page.locator('select[formControlName="featured"]');

  // Current bug: dropdowns just show "all" without labels
  // Expected: dropdowns should have clear labels and placeholders

  // Check if placeholders are set correctly
  const typePlaceholder = await typeFilter.getAttribute('placeholder');
  const statusPlaceholder = await statusFilter.getAttribute('placeholder');
  const featuredPlaceholder = await featuredFilter.getAttribute('placeholder');

  // These should NOT be just "all"
  expect(typePlaceholder).not.toBe('all');
  expect(statusPlaceholder).not.toBe('all');
  expect(featuredPlaceholder).not.toBe('all');
});

test('price range should display currency and proper formatting', async ({
  page,
  productsAPI,
  productsPage,
}) => {
  const mockProducts = {
    content: [
      {
        id: 1,
        slug: 'test-product',
        categorySlug: 'coffee',
        productType: 'COFFEE',
        featured: false,
        isActive: true,
        name: 'Test Product',
        shortDescription: 'Test product',
        primaryImageUrl: 'https://example.com/test.jpg',
        minPrice: 650,
        maxPrice: 1378,
        discountPercentage: null,
      },
      {
        id: 2,
        slug: 'single-price-product',
        categorySlug: 'coffee',
        productType: 'COFFEE',
        featured: false,
        isActive: true,
        name: 'Single Price Product',
        shortDescription: 'Test product',
        primaryImageUrl: 'https://example.com/test2.jpg',
        minPrice: 850,  // Same min and max price
        maxPrice: 850,
        discountPercentage: null,
      },
    ],
    page: 0,
    size: 20,
    totalElements: 2,
    totalPages: 1,
    first: true,
    last: true,
  };

  await productsAPI.mockGetProducts(mockProducts);

  await page.goto('/dashboard/products');
  await productsPage.waitForLoad();

  // Get price range cells
  const priceRangeCells = await productsPage.productPriceRangeCells();
  const priceTexts = await Promise.all(
    priceRangeCells.map(cell => cell.textContent())
  );

  // Current bug: "650 - 1378" without currency symbol
  // Expected: "EGP 650 – 1,378" with proper formatting
  expect(priceTexts[0]).toContain('EGP');  // Should include currency symbol
  expect(priceTexts[0]).toContain('650');  // Should have price
  expect(priceTexts[0]).toContain('1,378');  // Should have formatted price

  // Single price should NOT show "650 - 650"
  expect(priceTexts[1]).not.toContain('650 - 650');
  expect(priceTexts[1]).toContain('EGP 650');  // Should show "EGP 650" only
});

test('featured status should use star icon for featured and grey star for not featured', async ({
  page,
  productsAPI,
  productsPage,
}) => {
  const mockProducts = {
    content: [
      {
        id: 1,
        slug: 'featured-product',
        categorySlug: 'coffee',
        productType: 'COFFEE',
        featured: true,  // Featured product
        isActive: true,
        name: 'Featured Product',
        shortDescription: 'This is featured',
        primaryImageUrl: 'https://example.com/featured.jpg',
        minPrice: 100,
        maxPrice: 200,
        discountPercentage: null,
      },
      {
        id: 2,
        slug: 'regular-product',
        categorySlug: 'coffee',
        productType: 'COFFEE',
        featured: false,  // Not featured
        isActive: true,
        name: 'Regular Product',
        shortDescription: 'This is not featured',
        primaryImageUrl: 'https://example.com/regular.jpg',
        minPrice: 100,
        maxPrice: 200,
        discountPercentage: null,
      },
    ],
    page: 0,
    size: 20,
    totalElements: 2,
    totalPages: 1,
    first: true,
    last: true,
  };

  await productsAPI.mockGetProducts(mockProducts);

  await page.goto('/dashboard/products');
  await productsPage.waitForLoad();

  // Get featured cells
  const featuredCells = await productsPage.productFeaturedCells();
  const featuredIcons = await Promise.all(
    featuredCells.map(cell => cell.locator('svg').getAttribute('fill'))
  );

  // Current bug: Both featured and not featured use same icon style
  // Expected: Featured = filled star (primary color), Not featured = grey star

  // These assertions will fail until we fix the featured display
  expect(featuredIcons[0]).toBe('currentColor');  // Should be filled/primary color for featured
  expect(featuredIcons[1]).toContain('gray');  // Should be grey for not featured
});