import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/core/testing/render-with-providers';

import type { ProductPhoto } from '../domain';
import { makeProduct, makeVersion, PRODUCT_ID } from '../domain/testing/product-fixtures';
import { testPhotoId } from '../testing/in-memory-photo-storage';
import { anyProductHasCover, coverPhotoIdOf, ProductThumbnail } from './product-thumbnail';

const photo = (n: number, position: number): ProductPhoto => ({
  id: testPhotoId(n),
  productId: PRODUCT_ID,
  position,
  width: 100,
  height: 50,
  byteSize: 10,
  sha256: 'e'.repeat(64),
});

describe('cover helpers', () => {
  it('uses the first photo by position as the cover and null without photos', () => {
    const withPhotos = makeProduct([makeVersion(0)], { photos: [photo(2, 1), photo(1, 0)] });

    expect(coverPhotoIdOf(withPhotos)).toBe(testPhotoId(1));
    expect(coverPhotoIdOf(makeProduct([makeVersion(0)]))).toBeNull();
    expect(coverPhotoIdOf(null)).toBeNull();
  });

  it('detects whether any product of a list has a cover (UX-F7)', () => {
    const plain = makeProduct([makeVersion(0)]);
    const withCover = makeProduct([makeVersion(0)], { photos: [photo(1, 0)] });

    expect(anyProductHasCover([plain, plain])).toBe(false);
    expect(anyProductHasCover([plain, withCover])).toBe(true);
    expect(anyProductHasCover([])).toBe(false);
  });
});

describe('ProductThumbnail', () => {
  it('draws the cover file and hides it from the screen reader', async () => {
    await renderWithProviders(<ProductThumbnail coverPhotoId={testPhotoId(1)} />);

    expect(screen.queryByRole('image')).not.toBeOnTheScreen();
    expect(
      screen.getByLabelText('Foto del producto', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('shows a neutral box instead of an image when the product has no cover', async () => {
    await renderWithProviders(<ProductThumbnail coverPhotoId={null} />);

    expect(
      screen.queryByLabelText('Foto del producto', { includeHiddenElements: true }),
    ).not.toBeOnTheScreen();
  });

  it('shows the neutral box when the cover file is missing', async () => {
    await renderWithProviders(<ProductThumbnail coverPhotoId={testPhotoId(1)} />);

    void fireEvent(
      screen.getByLabelText('Foto del producto', { includeHiddenElements: true }),
      'error',
      { nativeEvent: { error: 'missing' } },
    );

    expect(
      await screen.findByLabelText('Foto del producto, no se puede mostrar', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen();
  });
});
