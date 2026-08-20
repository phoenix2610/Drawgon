import { AppRouter } from '@/routes/AppRouter';
import { ToastProvider } from '@/components/toast/ToastProvider';

function App() {
  return (
    <ToastProvider>
      <AppRouter />
    </ToastProvider>
  );
}

export default App;
