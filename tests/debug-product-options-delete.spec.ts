"""Debug tests for Product Options delete confirmation issue"""
import { test, expect } from './fixtures';

test('Product Options value chips should show confirmation before deletion', async ({
  page,
  productOptionsAPI,
  productOptionsPage,
}) => {
  // Mock product options data with values
  const mockProductOption = {
    id: 1,
    name: 'Weight',
    translations: [
      { language: 'en', name: 'Weight' },
      { language: 'ar', name: 'الوزن' },
    ],
    sortOrder: 1,
  };

  const mockProductOptionValues = [
    {
      id: 1,
      optionId: 1,
      slug: '250g',
      translations: [
        { language: 'en', name: '250g' },
        { language: 'ar', name: '250 جم' },
      ],
      numericValue: 250,
      sortOrder: 1,
    },
    {
      id: 2,
      optionId: 1,
      slug: '500g',
      translations: [
        { language: 'en', name: '500g' },
        { language: 'ar', name: '500 جم' },
      ],
      numericValue: 500,
      sortOrder: 2,
    },
  ];

  await productOptionsAPI.mockGetProductOption(mockProductOption);
  await productOptionsAPI.mockGetProductOptionValues(mockProductOptionValues);

  // Navigate to product options page
  await page.goto('/dashboard/product-options');
  await productOptionsPage.waitForLoad();

  // Find the Weight option and its value chips
  const weightOption = await productOptionsPage.findProductOptionByName('Weight');
  await weightOption.locator('.value-chip').first().click(); // Open values

  // Wait for value chips to be visible
  await productOptionsPage.waitForValueChipsVisible();

  // Get the value chips
  const valueChips = await productOptionsPage.valueChips();
  expect(valueChips).toHaveCount(2);

  // Try to delete the first value chip by clicking the X icon
  // This should show a confirmation dialog, not delete immediately
  await valueChips[0].locator('.delete-button').click();

  // Verify that a confirmation dialog is shown
  // The test will fail until we implement proper confirmation
  const confirmDialog = await productOptionsPage.confirmationDialog();
  await expect(confirmDialog).toBeVisible();

  // The dialog should have cancel and delete buttons
  await expect(confirmDialog.locator('.cancel-button')).toBeVisible();
  await expect(confirmDialog.locator('.delete-button')).toBeVisible();

  // Verify that the value was NOT deleted yet (cancel button)
  await confirmDialog.locator('.cancel-button').click();
  await productOptionsPage.waitForValueChipsVisible();

  // Both value chips should still be present
  const remainingValueChips = await productOptionsPage.valueChips();
  await expect(remainingValueChips).toHaveCount(2);
});

test('Product Options delete confirmation should show usage count', async ({
  page,
  productOptionsAPI,
  productOptionsPage,
}) => {
  // Mock product option with values used by variants
  const mockProductOption = {
    id: 1,
    name: 'Size',
    translations: [
      { language: 'en', name: 'Size' },
    ],
    sortOrder: 2,
  };

  const mockProductOptionValues = [
    {
      id: 1,
      optionId: 1,
      slug: 'small',
      translations: [
        { language: 'en', name: 'Small' },
      ],
      numericValue: 1,
      sortOrder: 1,
    },
  ];

  await productOptionsAPI.mockGetProductOption(mockProductOption);
  await productOptionsAPI.mockGetProductOptionValues(mockProductOptionValues);

  await page.goto('/dashboard/product-options');
  await productOptionsPage.waitForLoad();

  // Find the Size option and open its values
  const sizeOption = await productOptionsPage.findProductOptionByName('Size');
  await sizeOption.locator('.value-chip').first().click();

  await productOptionsPage.waitForValueChipsVisible();

  // Get the delete button for the Small value
  const valueChips = await productOptionsPage.valueChips();
  await valueChips[0].locator('.delete-button').click();

  // Confirmation dialog should be shown
  const confirmDialog = await productOptionsPage.confirmationDialog();
  await expect(confirmDialog).toBeVisible();

  // The dialog should show how many variants use this value
  // Currently it just shows confirmation, but should show usage count
  const usageInfo = confirmDialog.locator('.usage-info');
  await expect(usageInfo).toBeVisible(); // Should be implemented
  await expect(usageInfo).toContainText('Used by'); // Should show usage count

  // Clean up
  await confirmDialog.locator('.cancel-button').click();
});