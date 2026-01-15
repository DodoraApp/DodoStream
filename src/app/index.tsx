import { Redirect } from 'expo-router';

/**
 * Root index - redirects to the main app group
 * The (app) group's layout handles profile checking and setup wizard redirect
 */
export default function Index() {
  return <Redirect href="/(app)/(tabs)" />;
}
