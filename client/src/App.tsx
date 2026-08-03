import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AlertProvider } from "./contexts/AlertContext";

import { DashboardPage } from "./pages/distributor/DashboardPage";
import { TransactionsPage } from "./pages/distributor/TransactionsPage";

import { ProvidersPage } from "./pages/distributor/ProvidersPage";
import { APIPage } from "./pages/distributor/APIPage";
import { SettingsPage } from "./pages/distributor/SettingsPage";
import { ProviderDashboardPage } from "./pages/provider/DashboardPage";
import { InventoryPage } from "./pages/provider/InventoryPage";
import { UploadPage } from "./pages/provider/UploadPage";
import { DistributorsPage } from "./pages/provider/DistributorsPage";
import { RequestsPage } from "./pages/provider/RequestsPage";
import { ProductsPage } from "./pages/provider/ProductsPage";
import ProviderTransactionsPage from "./pages/provider/TransactionsPage";
import { ProviderSettingsPage } from "./pages/provider/SettingsPage";
import { AllocationsPage } from "./pages/provider/AllocationsPage";
import { AlertsPageV2 } from "./pages/distributor/AlertsPageV2";
import { ConnectProviderPage } from "./pages/distributor/ConnectProviderPage";
import { ProviderAccountsPage } from "./pages/distributor/ProviderAccountsPage";
import { ApiDocsPage } from "./pages/distributor/ApiDocsPage";
import { SandboxPage } from "./pages/distributor/SandboxPage";
import { DistributorPurchase } from "./pages/distributor/DistributorPurchase";
import { FulfillmentTrackingPage } from "./pages/distributor/FulfillmentTrackingPage";
import { FulfillmentRequestDetailsPage } from "./pages/distributor/FulfillmentRequestDetailsPage";
import { QueueDashboard } from "./pages/QueueDashboard";
import RuntimeHealthPage from "./pages/RuntimeHealth";
import SignupPage from "./pages/SignupPage";
import PendingActivationPage from "./pages/PendingActivationPage";
import SuspendedPage from "./pages/SuspendedPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import LoginPage from "./pages/LoginPage";
import DashboardRedirect from "./pages/DashboardRedirect";
import LandingPage from "./pages/LandingPage";
import OrganizationsPage from "./pages/admin/OrganizationsPage";
import UsersPage from "./pages/admin/UsersPage";
import AdminSettingsPage from "./pages/admin/SettingsPage";
import { UnifiedSidebar } from "./components/UnifiedSidebar";
import { TopNavbar } from "./components/TopNavbar";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./_core/hooks/useAuth";
import { useNavigationItems } from "./hooks/useNavigationItems";
import { useCurrentRoleContext } from "./hooks/useCurrentRoleContext";
import { trpc } from "./lib/trpc";

// Public pages that should NOT show sidebar
const PUBLIC_PAGES = ["/", "/login", "/signup", "/pending-activation", "/suspended", "/unauthorized", "/404", "/landing"];

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuth();
  const [location, setLocation] = useLocation();
  const { userRole, userEmail, isAuthenticated } = useCurrentRoleContext();
  const navItems = useNavigationItems(userRole);
  const userName = user?.name || null;

  // Fetch org logo based on role
  const { data: providerSettings } = trpc.provider.getSettings.useQuery(undefined, {
    enabled: userRole === 'provider',
    staleTime: 5 * 60 * 1000,
  });
  const { data: distributorProfile } = trpc.distributor.getProfile.useQuery(undefined, {
    enabled: userRole === 'distributor',
    staleTime: 5 * 60 * 1000,
  });
  const logoUrl = providerSettings?.logoUrl || distributorProfile?.logoUrl || null;
  
  // Don't show sidebar on public pages
  const showSidebar = isAuthenticated && !PUBLIC_PAGES.includes(location);
  
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear any remaining auth data from localStorage
      localStorage.removeItem('manus-runtime-user-info');
      // Redirect to login page
      window.location.href = '/login';
    }
  };

  const handleNavigate = (path: string) => {
    setLocation(path);
  };

  return (
    <div className="flex min-h-screen flex-row-reverse">
      {showSidebar && (
        <UnifiedSidebar
          navItems={navItems}
          currentPath={location}
          userEmail={userEmail}
          userName={userName}
          userRole={userRole}
          logoUrl={logoUrl}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      )}
      <main className={`flex-1 flex flex-col min-h-screen w-full ${showSidebar ? 'lg:mr-[260px]' : ''}`}>
        {showSidebar && (
          <TopNavbar
            navItems={navItems}
            currentPath={location}
            userName={userName}
            userEmail={userEmail}
            userRole={userRole}
            logoUrl={logoUrl}
            onNavigate={handleNavigate}
          />
        )}
        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}

// Helper to wrap component with ProtectedRoute (and optional role enforcement)
const Protected = (Component: React.ComponentType<any>, roles?: string[]) => {
  return () => (
    <ProtectedRoute requiredRoles={roles}>
      <Component />
    </ProtectedRoute>
  );
};

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={LandingPage} />
      <Route path={"/landing"} component={LandingPage} />
      <Route path={"/dashboard"} component={Protected(DashboardRedirect)} />
      <Route path={"/login"} component={LoginPage} />
      <Route path={"/signup"} component={SignupPage} />
      <Route path={"/pending-activation"} component={PendingActivationPage} />
      <Route path={"/suspended"} component={SuspendedPage} />
      <Route path={"/unauthorized"} component={UnauthorizedPage} />
      <Route path={"/admin/organizations"} component={Protected(OrganizationsPage, ['admin'])} />
      <Route path={"/admin/users"} component={Protected(UsersPage, ['admin'])} />
      <Route path={"/settings"} component={Protected(AdminSettingsPage, ['admin'])} />
      <Route path={"/admin/runtime-health"} component={Protected(RuntimeHealthPage, ['admin'])} />
      <Route path={"/distributor/dashboard"} component={Protected(DashboardPage, ['distributor'])} />
      <Route path={"/distributor/transactions"} component={Protected(TransactionsPage, ['distributor'])} />
      <Route path={"/distributor/provider-accounts"} component={Protected(ProviderAccountsPage, ['distributor'])} />
      <Route path={"/distributor/providers"} component={Protected(ProvidersPage, ['distributor'])} />
      <Route path={"/distributor/api"} component={Protected(APIPage, ['distributor'])} />
      <Route path={"/distributor/settings"} component={Protected(SettingsPage, ['distributor'])} />
      <Route path={"/distributor/connect-provider"} component={Protected(ConnectProviderPage, ['distributor'])} />
      <Route path="/distributor/wallet" component={Protected(ProviderAccountsPage, ['distributor'])} />
      <Route path="/distributor/fulfillment" component={Protected(FulfillmentTrackingPage, ['distributor'])} />
      <Route path="/distributor/fulfillment/:requestId" component={Protected(FulfillmentRequestDetailsPage, ['distributor'])} />
      <Route path="/distributor/api-docs" component={Protected(ApiDocsPage, ['distributor'])} />
      <Route path="/distributor/sandbox" component={Protected(SandboxPage, ['distributor'])} />
      <Route path="/distributor/purchase" component={Protected(DistributorPurchase, ['distributor'])} />
      <Route path="/provider/dashboard" component={Protected(ProviderDashboardPage, ['provider'])} />
      <Route path="/provider/inventory" component={Protected(InventoryPage, ['provider'])} />
      <Route path="/provider/upload" component={Protected(UploadPage, ['provider'])} />
      <Route path="/provider/transactions" component={Protected(ProviderTransactionsPage, ['provider'])} />
      <Route path="/provider/distributors" component={Protected(DistributorsPage, ['provider'])} />
      <Route path="/provider/requests" component={Protected(RequestsPage, ['provider'])} />
      <Route path="/provider/products" component={Protected(ProductsPage, ['provider'])} />
      <Route path="/provider/settings" component={Protected(ProviderSettingsPage, ['provider'])} />
      <Route path="/provider/allocations" component={Protected(AllocationsPage, ['provider'])} />
      <Route path="/queue-dashboard" component={Protected(QueueDashboard, ['admin'])} />
      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <AlertProvider>
        <ThemeProvider
          defaultTheme="light"
          // switchable
        >
          <TooltipProvider>
            <Toaster />
            <AuthenticatedLayout>
              <Router />
            </AuthenticatedLayout>
          </TooltipProvider>
        </ThemeProvider>
      </AlertProvider>
    </ErrorBoundary>
  );
}

export default App;
