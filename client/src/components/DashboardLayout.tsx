import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useState } from "react";
import { useIsMobile } from "@/hooks/useMobile";
import { navForRole, Role } from "@/lib/roles";
import { LogOut, PanelLeft, Stethoscope, UserCircle, X } from "lucide-react";
import { CSSProperties, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

// Dental-themed sidebar header + role-scoped navigation.

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const parsed = saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
    // Guard against a stale/corrupt persisted width (e.g., icon-rail size)
    return Number.isFinite(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH
      ? parsed
      : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const login = trpc.auth.login.useMutation({
    onSuccess: () => window.location.reload(),
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const role = (user as unknown as { role?: Role } | null)?.role ?? null;

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Sign in with your local staff account.
            </p>
          </div>
          <form
            onSubmit={event => {
              event.preventDefault();
              login.mutate({ email, password });
            }}
            className="w-full space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            {login.error && (
              <p className="text-sm text-destructive">{login.error.message}</p>
            )}
            <Button
              type="submit"
              disabled={login.isPending}
              size="lg"
              className="w-full shadow-lg hover:shadow-xl transition-all"
            >
              {login.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent
        sidebarWidth={sidebarWidth}
        setSidebarWidth={setSidebarWidth}
      >
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  sidebarWidth,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const profileQuery = trpc.profile.me.useQuery();
  const profilePhotoUrl =
    (
      profileQuery.data as
        | { profilePhotoUrl?: string | null }
        | null
        | undefined
    )?.profilePhotoUrl ??
    (user as unknown as { profilePhotoUrl?: string | null } | null)
      ?.profilePhotoUrl ??
    null;
  const role = (user as unknown as { role?: Role } | null)?.role ?? null;
  const menuItems = navForRole(role);
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar, openMobile, setOpenMobile, isMobile } =
    useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);

  // Close mobile sidebar automatically on route changes
  useEffect(() => {
    if (isMobile && openMobile) {
      setOpenMobile(false);
    }
  }, [location, isMobile]);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
      return;
    }
    // When the sidebar reopens after being collapsed, restore a usable width
    // (a saved width may have shrunk to the icon-rail size while collapsed).
    if (sidebarWidth < MIN_WIDTH || sidebarWidth > MAX_WIDTH) {
      setSidebarWidth(DEFAULT_WIDTH);
    }
  }, [isCollapsed, sidebarWidth, setSidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b border-sidebar-border/40">
            {isMobile ? (
              <div className="flex items-center justify-between px-3 w-full">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-xs">
                    <Stethoscope className="h-4.5 w-4.5 text-primary-foreground" />
                  </div>
                  <div className="flex flex-col min-w-0 leading-tight">
                    <span className="font-semibold tracking-tight truncate text-sm">
                      Dentacare
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      Clinic Management
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setOpenMobile(false)}
                  className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                  aria-label="Close navigation menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-2 transition-all w-full">
                <button
                  onClick={toggleSidebar}
                  className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                  aria-label="Toggle navigation"
                >
                  <PanelLeft className="h-4 w-4 text-muted-foreground" />
                </button>
                {!isCollapsed ? (
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-xs">
                      <Stethoscope className="h-4.5 w-4.5 text-primary-foreground" />
                    </div>
                    <div className="flex flex-col min-w-0 leading-tight">
                      <span className="font-semibold tracking-tight truncate text-sm">
                        Dentacare
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate">
                        Clinic Management
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </SidebarHeader>

          <SidebarContent className="gap-0 py-2">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => {
                        setLocation(item.path);
                        if (isMobile) {
                          setOpenMobile(false);
                        }
                      }}
                      tooltip={item.label}
                      className="h-10 transition-all font-normal"
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-sidebar-border/40">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarImage
                      src={profilePhotoUrl ?? undefined}
                      alt={`${user?.name ?? "User"} profile photo`}
                    />
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                    {role ? (
                      <span className="inline-flex mt-1 items-center w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary capitalize">
                        {role}
                      </span>
                    ) : null}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => {
                    if (isMobile) setOpenMobile(false);
                    setLocation("/profile");
                  }}
                  className="cursor-pointer"
                >
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Edit profile</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => {
                    if (isMobile) setOpenMobile(false);
                    logout();
                  }}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors hidden md:block ${isCollapsed ? "md:hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="min-w-0">
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background hover:bg-accent border shadow-xs" />
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center shrink-0 shadow-xs">
                  <Stethoscope className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold text-sm tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Dentacare"}
                  </span>
                  <span className="text-[10px] text-muted-foreground hidden sm:inline">
                    Clinic Management
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {role ? (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary capitalize">
                  {role}
                </span>
              ) : null}
              <Avatar className="h-8 w-8 border shrink-0">
                <AvatarImage
                  src={profilePhotoUrl ?? undefined}
                  alt={`${user?.name ?? "User"} profile photo`}
                />
                <AvatarFallback className="text-xs font-medium">
                  {user?.name?.charAt(0).toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 sm:p-5">{children}</main>
      </SidebarInset>
    </>
  );
}
