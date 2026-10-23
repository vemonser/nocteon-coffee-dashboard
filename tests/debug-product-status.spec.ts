"""Debug tests for product status display issue"""
import { test, expect } from './fixtures';

test('products should not show all as disabled when active filter is applied', async ({
  page,
  productsAPI,
  productsPage,
}) => {
  // Mock API response to show some products as active, some as inactive
  const mockProducts = {
    content: [
      {
        id: 1,
        slug: 'ethiopia-yirgacheffe',
        categorySlug: 'coffee',
        productType: 'COFFEE',
        featured: false,
        isActive: true,  // Should be active
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
        categorySlug: 'coffee',
        productType: 'COFFEE',
        featured: true,
        isActive: true,  // Should be active
        name: 'Sumatra Mandheling',
        shortDescription: 'Rich Indonesian coffee',
        primaryImageUrl: 'https://example.com/coffee2.jpg',
        minPrice: 450,
        maxPrice: 890,
        discountPercentage: null,
      },
      {
        id: 3,
        slug: 'colombian-hill-country',
        categorySlug: 'coffee',
        productType: 'COFFEE',
        featured: false,
        isActive: false,  // Should be inactive
        name: 'Colombian Hill Country',
        shortDescription: 'Medium roast Colombian coffee',
        primaryImageUrl: 'https://example.com/coffee3.jpg',
        minPrice: 350,
        maxPrice: 650,
        discountPercentage: null,
      },
    ],
    page: 0,
    size: 20,
    totalElements: 3,
    totalPages: 1,
    first: true,
    last: true,
  };

  // Mock the API response
  await productsAPI.mockGetProducts(mockProducts);

  // Navigate to products page
  await page.goto('/dashboard/products');
  await productsPage.waitForLoad();

  // Verify the products are displayed
  await expect(productsPage.productRows()).toHaveCount(3);

  // Check that the status column shows correct status
  // This test will fail until we fix the status display issue
  const statusCells = await productsPage.productStatusCells();
  const statusTexts = await Promise.all(
    statusCells.map(cell => cell.textContent())
  );

  // All products should NOT show as 'Disabled' when they are active
  // This assertion will fail with current implementation
  expect(statusTexts).not.toContain('Disabled');
  expect(statusTexts).toContain('Active');  // or similar active status text
});

test('products list should respect status filter - active products only', async ({
  page,
  productsAPI,
  productsPage,
}) => {
  // Mock API with mixed active/inactive products
  const mockProducts = {
    content: [
      {
        id: 1,
        slug: 'active-product-1',
        categorySlug: 'coffee',
        productType: 'COFFEE',
        featured: false,
        isActive: true,
        name: 'Active Product 1',
        shortDescription: 'Test product',
        primaryImageUrl: 'https://example.com/1.jpg',
        minPrice: 100,
        maxPrice: 200,
        discountPercentage: null,
      },
      {
        id: 2,
        slug: 'inactive-product-1',
        categorySlug: 'coffee',
        productType: 'COFFEE',
        featured: false,
        isActive: false,  // Should be filtered out when status='active'
        name: 'Inactive Product 1',
        shortDescription: 'Test product',
        primaryImageUrl: 'https://example.com/2.jpg',
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

  // Apply status filter to show only active products
  await productsPage.selectStatusFilter('active');

  // Should only show the active product, not the inactive one
  const activeProducts = await productsPage.productRows();
  await expect(activeProducts).toHaveCount(1);

  const productNames = await Promise.all(
    activeProducts.map(row => row.locator('.product-name').textContent())
  );
  expect(productNames).toContain('Active Product 1');
  expect(productNames).not.toContain('Inactive Product 1');
});