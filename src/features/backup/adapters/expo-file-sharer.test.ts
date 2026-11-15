import { isAvailableAsync, shareAsync } from 'expo-sharing';

import { createExpoFileSharer } from './expo-file-sharer';

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

describe('createExpoFileSharer', () => {
  it('reports whether the system share sheet can be used', async () => {
    jest.mocked(isAvailableAsync).mockResolvedValue(false);

    await expect(createExpoFileSharer().isAvailable()).resolves.toBe(false);
  });

  it('passes the MIME type and the UTI to the share sheet', async () => {
    jest.mocked(shareAsync).mockResolvedValue(undefined);

    await createExpoFileSharer().share('file:///data/cache/backups/a.zip', {
      mimeType: 'application/zip',
      uti: 'public.zip-archive',
    });

    expect(shareAsync).toHaveBeenCalledWith('file:///data/cache/backups/a.zip', {
      mimeType: 'application/zip',
      UTI: 'public.zip-archive',
    });
  });

  it('omits the UTI when none is given', async () => {
    jest.mocked(shareAsync).mockResolvedValue(undefined);

    await createExpoFileSharer().share('file:///a.csv', { mimeType: 'text/csv' });

    expect(shareAsync).toHaveBeenCalledWith('file:///a.csv', { mimeType: 'text/csv' });
  });

  it('rejects when the share sheet fails', async () => {
    jest.mocked(shareAsync).mockRejectedValue(new Error('no activity'));

    await expect(
      createExpoFileSharer().share('file:///a.csv', { mimeType: 'text/csv' }),
    ).rejects.toThrow('no activity');
  });
});
