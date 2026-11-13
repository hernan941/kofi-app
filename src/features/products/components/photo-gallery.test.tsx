import { screen, userEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/core/testing/render-with-providers';

import type { ProductPhoto } from '../domain';
import { PRODUCT_ID } from '../domain/testing/product-fixtures';
import { testPhotoId } from '../testing/in-memory-photo-storage';
import { PhotoGallery } from './photo-gallery';

const user = userEvent.setup();

const photo = (n: number, position: number): ProductPhoto => ({
  id: testPhotoId(n),
  productId: PRODUCT_ID,
  position,
  width: 100,
  height: 50,
  byteSize: 10,
  sha256: 'e'.repeat(64),
});

describe('PhotoGallery', () => {
  it('draws nothing without photos', async () => {
    await renderWithProviders(<PhotoGallery photos={[]} productName="Lámina" />);

    expect(screen.queryAllByRole('image')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('shows only the cover for one photo', async () => {
    await renderWithProviders(<PhotoGallery photos={[photo(1, 0)]} productName="Lámina" />);

    expect(
      screen.getByRole('button', { name: 'Foto 1 de 1 de Lámina, portada' }),
    ).toBeOnTheScreen();
    expect(screen.getAllByRole('image')).toHaveLength(1);
  });

  it('shows the cover and one thumbnail per photo, in cover order', async () => {
    await renderWithProviders(
      <PhotoGallery photos={[photo(1, 2), photo(2, 0), photo(3, 1)]} productName="Lámina" />,
    );

    expect(
      screen.getByRole('button', { name: 'Foto 1 de 3 de Lámina, portada' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Foto 1 de 3' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Foto 3 de 3' })).toBeOnTheScreen();
    expect(screen.getAllByRole('image')).toHaveLength(4);
  });

  it('opens a read only sheet that navigates with Anterior and Siguiente', async () => {
    await renderWithProviders(
      <PhotoGallery photos={[photo(1, 0), photo(2, 1)]} productName="Lámina" />,
    );

    await user.press(screen.getByRole('button', { name: 'Foto 2 de 2' }));
    expect(screen.getByRole('header', { name: 'Foto 2 de 2' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Quitar foto' })).not.toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Anterior' }));

    expect(screen.getByRole('header', { name: 'Foto 1 de 2' })).toBeOnTheScreen();
  });
});
