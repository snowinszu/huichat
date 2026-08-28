import { useEffect, useState } from 'react';
import { AppLockProvider, ToastProvider } from './components/ui';
import { HomeScreen } from './screens/home/HomeScreen';
import { RolesScreen } from './screens/roles/RolesScreen';
import { ModelsScreen } from './screens/models/ModelsScreen';
import { SettingsScreen } from './screens/settings/SettingsScreen';
import { ChatScreen } from './screens/chat/ChatScreen';
import { StatsScreen } from './screens/stats/StatsScreen';
import { applyDarkModeAttribute } from './lib/applyDarkMode';

type View = 'home' | 'roles' | 'models' | 'settings' | 'chat' | 'stats';

function AppShell() {
  const [view, setView] = useState<View>('home');
  const [activeChatCardId, setActiveChatCardId] = useState<number | null>(null);

  // Applied once at boot, ahead of any single screen mounting, so the whole
  // app opens in the right theme from the first real paint. Toggling later
  // (SettingsScreen) re-applies it directly, independent of this effect.
  useEffect(() => {
    window.api?.appPreference
      .get()
      .then((preference) => applyDarkModeAttribute(preference.darkMode))
      .catch(() => {
        // No Electron bridge in this context — stay in light mode.
      });
  }, []);

  if (view === 'roles') {
    return <RolesScreen onBack={() => setView('home')} />;
  }

  if (view === 'models') {
    return <ModelsScreen onBack={() => setView('home')} />;
  }

  if (view === 'settings') {
    return <SettingsScreen onBack={() => setView('home')} />;
  }

  if (view === 'chat' && activeChatCardId !== null) {
    return <ChatScreen chatCardId={activeChatCardId} onBack={() => setView('home')} onNavigateToModels={() => setView('models')} />;
  }

  if (view === 'stats' && activeChatCardId !== null) {
    return <StatsScreen chatCardId={activeChatCardId} onBack={() => setView('home')} />;
  }

  return (
    <HomeScreen
      onNavigateToRoles={() => setView('roles')}
      onNavigateToModels={() => setView('models')}
      onNavigateToSettings={() => setView('settings')}
      onOpenChatCard={(id) => {
        setActiveChatCardId(id);
        setView('chat');
      }}
      onOpenChatStats={(id) => {
        setActiveChatCardId(id);
        setView('stats');
      }}
    />
  );
}

function App() {
  return (
    <ToastProvider>
      <AppLockProvider>
        <AppShell />
      </AppLockProvider>
    </ToastProvider>
  );
}

export default App;
