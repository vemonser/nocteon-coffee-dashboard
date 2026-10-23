"""Debug tests for translation/display issues"""
import { test, expect } from './fixtures';

test('product types should display translated names, not raw enum values', async ({
  page,
  productsAPI,
  productsPage,
}) => {
  // Mock API response with product type
  const mockProducts = {
    content: [
      {
        id: 1,
        slug: 'ethiopia-yirgacheffe',
        categorySlug: 'coffee',
        productType: 'COFFEE',  // Raw enum value - should be translated
        featured: false,
        isActive: true,
        name: 'Ethiopia Yirgacheffe',
        shortDescription: 'High quality Ethiopian coffee',
        primaryImageUrl: 'https://example.com/coffee1.jpg',
        minPrice: 650,
        maxPrice: 1378,
        discountPercentage: null,
      },
      {
        id: 2,
        slug: 'equipment-item',
        categorySlug: 'apparel',
        productType: 'EQUIPMENT',  // Raw enum value - should be translated
        featured: true,
        isActive: true,
        name: 'Premium Equipment Item',
        shortDescription: 'High quality equipment',
        primaryImageUrl: 'https://example.com/equipment.jpg',
        minPrice: 450,
        maxPrice: 890,
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

  // Get product type cells from the table
  const typeCells = await productsPage.productTypeCells();
  const typeTexts = await Promise.all(
    typeCells.map(cell => cell.textContent())
  );

  // These assertions will fail with current implementation
  // Raw enum values "COFFEE" and "EQUIPMENT" are displayed instead of translated names
  expect(typeTexts).not.toContain('COFFEE');
  expect(typeTexts).not.toContain('EQUIPMENT');

  // Expected translated names (from basic-info-step.component.ts)
  expect(typeTexts).toContain('Coffee');
  expect(typeTexts).toContain('Equipment');
});

test('category slugs should display translated names, not raw slugs', async ({
  page,
  productsAPI,
  productsPage,
}) => {
  // Mock API response with category slugs
  const mockProducts = {
    content: [
      {
        id: 1,
        slug: 'ethiopia-yirgacheffe',
        categorySlug: 'coffee-variety',  // Raw slug - should be translated
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
      {
        id: 2,
        slug: 'sumatra-mandheling',
        categorySlug: 'coffee-origin',  // Raw slug - should be translated
        productType: 'COFFEE',
        featured: false,
        isActive: true,
        name: 'Sumatra Mandheling',
        shortDescription: 'Rich Indonesian coffee',
        primaryImageUrl: 'https://example.com/coffee2.jpg',
        minPrice: 450,
        maxPrice: 890,
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

  // Get category cells from the table
  const categoryCells = await productsPage.productCategoryCells();
  const categoryTexts = await Promise.all(
    categoryCells.map(cell => cell.textContent())
  );

  // These assertions will fail with current implementation
  // Raw slugs "coffee-variety" and "coffee-origin" are displayed instead of translated names
  expect(categoryTexts).not.toContain('coffee-variety');
  expect(categoryTexts).not.toContain('coffee-origin');

  // Expected translated names (should come from category translations)
  expect(categoryTexts).toContain('Coffee Variety');
  expect(categoryTexts).toContain('Coffee Origin');
});

test('product names should display translations for both languages', async ({
  page,
  productsAPI,
  productsPage,
}) => {
  // This test checks that product names are properly translated
  // If product has translations in both EN and AR, the right one should be shown
  const mockProducts = {
    content: [
      {
        id: 1,
        slug: 'test-product',
        categorySlug: 'coffee',
        productType: 'COFFEE',
        featured: false,
        isActive: true,
        // Test if name is properly translated
        name: 'Test Product EN',  // This should be the translated name, not a slug
        shortDescription: 'Test description',
        primaryImageUrl: 'https://example.com/test.jpg',
        minPrice: 100,
        maxPrice: 200,
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

  // Check product names in the table
  const productNames = await productsPage.productNameTexts();

  // Should display "Test Product EN" (translated) not "test-product" (slug)
  expect(productNames).not.toContain('test-product');
  expect(productNames).toContain('Test Product EN');
});