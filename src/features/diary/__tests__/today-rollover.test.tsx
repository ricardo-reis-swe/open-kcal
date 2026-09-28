import { act, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { createTestServices, renderWithServices } from '@/shared/testing/services';

import { DiaryDateStrip } from '../components/DiaryDateStrip';
import { DiaryDateProvider, useDiaryDate } from '../hooks/DiaryDateContext';

function Strip() {
  const { date, today, setDate } = useDiaryDate();
  return <DiaryDateStrip date={date} today={today} onChange={setDate} />;
}

async function setup(now: string) {
  const { services, clock } = await createTestServices({ now });
  await renderWithServices(
    <DiaryDateProvider>
      <Strip />
    </DiaryDateProvider>,
    services,
  );
  return clock;
}

describe('UX-02 / NAV-05: today follows the real date', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('UX-02: at local midnight the open day is relabelled; the selected date stays (NAV-05)', async () => {
    jest.useFakeTimers();
    const clock = await setup('2026-09-25T22:59:00.000Z'); // 23:59 in Lisbon (UTC+1)
    expect(screen.getByLabelText('Showing Today')).toBeOnTheScreen();

    clock.set('2026-09-25T23:00:02.000Z'); // 00:00:02 on 26 Sep in Lisbon
    await act(async () => {
      jest.advanceTimersByTime(62_000);
    });
    expect(screen.getByLabelText('Showing Yesterday')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Go to today' })).toBeOnTheScreen();
  });

  it('UX-02: resuming the app on a later day refreshes today', async () => {
    let onChange: ((state: AppStateStatus) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      onChange = handler as (state: AppStateStatus) => void;
      return { remove: () => undefined };
    });
    const clock = await setup('2026-09-25T10:00:00.000Z');
    expect(screen.getByLabelText('Showing Today')).toBeOnTheScreen();

    clock.set('2026-09-27T09:00:00.000Z');
    await act(async () => onChange?.('background'));
    expect(screen.getByLabelText('Showing Today')).toBeOnTheScreen();
    await act(async () => onChange?.('active'));
    expect(screen.getByLabelText(/^Showing Fri 25 Sep$/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Go to today' })).toBeOnTheScreen();
  });
});
