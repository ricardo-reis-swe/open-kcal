import { MutationObserver } from '@tanstack/react-query';

import { refreshWidget } from '@/features/widget/refreshWidget';

import { createQueryClient } from '../query-client';

jest.mock('@/features/widget/refreshWidget', () => ({ refreshWidget: jest.fn() }));

describe('DATA-22: widget refresh on writes', () => {
  beforeEach(() => jest.mocked(refreshWidget).mockClear());

  it('refreshes the widget after every successful mutation', async () => {
    const client = createQueryClient();
    await new MutationObserver(client, { mutationFn: async () => 'saved' }).mutate();
    expect(refreshWidget).toHaveBeenCalledTimes(1);
    client.clear();
  });

  it('does not refresh after a failed mutation', async () => {
    const client = createQueryClient();
    const observer = new MutationObserver(client, {
      mutationFn: async () => {
        throw new Error('constraint failed');
      },
    });
    await expect(observer.mutate()).rejects.toThrow('constraint failed');
    expect(refreshWidget).not.toHaveBeenCalled();
    client.clear();
  });
});
