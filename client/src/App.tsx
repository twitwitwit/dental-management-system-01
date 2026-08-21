import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientDetail from "./pages/PatientDetail";
import Appointments from "./pages/Appointments";
import Clinical from "./pages/Clinical";
import Billing from "./pages/Billing";
import Inventory from "./pages/Inventory";
import Insurance from "./pages/Insurance";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import SettingsPage from "./pages/SettingsPage";
import AccessDenied from "./pages/AccessDenied";
import { useCurrentRole, canAccess } from "./lib/roles";
import AuditLogs from "./pages/AuditLogs";
import { useAuth } from "./_core/hooks/useAuth";
import PatientRegistration from "./pages/PatientRegistration";
import PatientLogin from "./pages/PatientLogin";
import PatientPortal from "./pages/PatientPortal";
import PatientVerification from "./pages/PatientVerification";
import PatientPortalClaim from "./pages/PatientPortalClaim";
import PatientPortalRecovery from "./pages/PatientPortalRecovery";
import PatientHealthForm from "./pages/PatientHealthForm";
function useModuleGate(moduleId: string) {
  const role = useCurrentRole();
  return { canAccessCheck: canAccess(role, moduleId) };
}

function ModuleRoute({
  path,
  moduleId,
  component: Component,
}: {
  path: string;
  moduleId: string;
  component: React.ComponentType;
}) {
  return (
    <Route path={path}>
      {() => <ModuleGate moduleId={moduleId}>{() => <Component />}</ModuleGate>}
    </Route>
  );
}

function ModuleGate({
  moduleId,
  children,
}: {
  moduleId: string;
  children: () => React.ReactNode;
}) {
  const { canAccessCheck } = useModuleGate(moduleId);
  if (!canAccessCheck) return <AccessDenied moduleId={moduleId} />;
  return <>{children()}</>;
}

function RoleHome() {
  const { user, loading } = useAuth();

  // Do not render Dashboard while auth is still loading. Otherwise a patient
  // can briefly be evaluated against the staff dashboard module.
  if (loading) return null;
  if (user?.role === "patient") return <PatientPortal />;
  return <Dashboard />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RoleHome} />
      <Route path="/dashboard" component={Dashboard} />
      <ModuleRoute path="/patients" moduleId="patients" component={Patients} />
      <Route path="/patients/:id">
        {params => (
          <ModuleGate moduleId="patients">
            {() => <PatientDetail id={Number(params.id)} />}
          </ModuleGate>
        )}
      </Route>
      <Route path="/patient/register" component={PatientRegistration} />
      <Route path="/patient/login" component={PatientLogin} />
      <Route path="/patient/claim" component={PatientPortalClaim} />
      <Route path="/patient/recover" component={PatientPortalRecovery} />
      <Route path="/patient/health-form">{() => <PatientHealthForm />}</Route>
      <Route path="/patient" component={PatientPortal} />
      <ModuleRoute
        path="/patient-verification"
        moduleId="users"
        component={PatientVerification}
      />
      <ModuleRoute
        path="/appointments"
        moduleId="appointments"
        component={Appointments}
      />
      <ModuleRoute path="/clinical" moduleId="clinical" component={Clinical} />
      <ModuleRoute path="/billing" moduleId="billing" component={Billing} />
      <ModuleRoute
        path="/inventory"
        moduleId="inventory"
        component={Inventory}
      />
      <ModuleRoute
        path="/insurance"
        moduleId="insurance"
        component={Insurance}
      />
      <ModuleRoute path="/reports" moduleId="reports" component={Reports} />
      <ModuleRoute path="/users" moduleId="users" component={Users} />
      <ModuleRoute path="/audit" moduleId="audit" component={AuditLogs} />
      <ModuleRoute
        path="/settings"
        moduleId="settings"
        component={SettingsPage}
      />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
