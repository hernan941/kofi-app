import { getDocumentAsync } from 'expo-document-picker';

import { createExpoDocumentPicker } from './expo-document-picker';

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

describe('createExpoDocumentPicker', () => {
  it('asks for a single file copied to the cache, with the given types', async () => {
    jest.mocked(getDocumentAsync).mockResolvedValue({ canceled: true, assets: null });

    await createExpoDocumentPicker().pickSingle({ mimeTypes: ['*/*'] });

    expect(getDocumentAsync).toHaveBeenCalledWith({
      type: ['*/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
  });

  it('returns null when the person cancels', async () => {
    jest.mocked(getDocumentAsync).mockResolvedValue({ canceled: true, assets: null });

    await expect(createExpoDocumentPicker().pickSingle({ mimeTypes: ['*/*'] })).resolves.toBeNull();
  });

  it('returns the chosen file', async () => {
    jest.mocked(getDocumentAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/DocumentPicker/a.zip',
          name: 'a.zip',
          size: 1234,
          lastModified: 0,
        },
      ],
    });

    await expect(createExpoDocumentPicker().pickSingle({ mimeTypes: ['*/*'] })).resolves.toEqual({
      uri: 'file:///cache/DocumentPicker/a.zip',
      name: 'a.zip',
      size: 1234,
    });
  });

  it('reports an unknown size as null', async () => {
    jest.mocked(getDocumentAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///a.zip', name: 'a.zip', lastModified: 0 }],
    });

    await expect(
      createExpoDocumentPicker().pickSingle({ mimeTypes: ['*/*'] }),
    ).resolves.toMatchObject({ size: null });
  });

  it('returns null when the result has no file', async () => {
    jest.mocked(getDocumentAsync).mockResolvedValue({ canceled: false, assets: [] });

    await expect(createExpoDocumentPicker().pickSingle({ mimeTypes: ['*/*'] })).resolves.toBeNull();
  });
});
