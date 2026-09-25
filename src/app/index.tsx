import { Redirect } from 'expo-router';

// NAV-01: Diary is the default destination.
export default function Index() {
  return <Redirect href="/diary" />;
}
