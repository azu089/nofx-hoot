"use client";

import { UserButton } from "@repo/auth/client";
import { ModeToggle } from "@repo/design-system/components/mode-toggle";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@repo/design-system/components/ui/sidebar";
import { cn } from "@repo/design-system/lib/utils";
import { NotificationsTrigger } from "@repo/notifications/components/trigger";
import {
  ChevronRightIcon,
  LayoutDashboardIcon,
  ZapIcon,
  TrendingUpIcon,
  WalletIcon,
  GamepadIcon,
  ServerIcon,
  SettingsIcon,
  LifeBuoyIcon,
  KeyIcon,
  ReceiptIcon,
  CreditCardIcon,
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  HistoryIcon,
  FlaskConicalIcon,
  BrainCircuitIcon,
  TrophyIcon,
  CoinsIcon,
  RefreshCwIcon,
  TimerIcon,
  ShieldIcon,
  AlertTriangleIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Search } from "./search";

type GlobalSidebarProperties = {
  readonly children: ReactNode;
};

// QuantFi 导航配置
const quantfiNav = {
  // 主导航
  navMain: [
    {
      title: "仪表盘",
      url: "/dashboard",
      icon: LayoutDashboardIcon,
      isActive: true,
    },
    {
      title: "策略市场",
      url: "/strategies",
      icon: ZapIcon,
      items: [
        { title: "策略列表", url: "/strategies" },
        { title: "我的订阅", url: "/strategies/subscribed" },
      ],
    },
    {
      title: "交易中心",
      url: "/trading",
      icon: TrendingUpIcon,
      items: [
        { title: "交易控制台", url: "/trading" },
        { title: "回测系统", url: "/trading/backtest" },
        { title: "交易历史", url: "/trading/history" },
        { title: "AI 策略", url: "/trading/ai" },
      ],
    },
    {
      title: "资产钱包",
      url: "/wallet",
      icon: WalletIcon,
      items: [
        { title: "资产概览", url: "/wallet" },
        { title: "充值", url: "/wallet/deposit" },
        { title: "提现", url: "/wallet/withdraw" },
        { title: "API Key", url: "/wallet/api-keys" },
        { title: "账单明细", url: "/wallet/billing" },
      ],
    },
    {
      title: "GameFi",
      url: "/gamefi",
      icon: GamepadIcon,
      items: [
        { title: "GameFi 概览", url: "/gamefi" },
        { title: "质押大厅", url: "/gamefi/staking" },
        { title: "积分兑换", url: "/gamefi/exchange" },
        { title: "释放进度", url: "/gamefi/vesting" },
        { title: "排行榜", url: "/gamefi/leaderboard" },
      ],
    },
    {
      title: "VPS 实例",
      url: "/instances",
      icon: ServerIcon,
    },
    {
      title: "设置",
      url: "/settings",
      icon: SettingsIcon,
      items: [
        { title: "账户设置", url: "/settings" },
        { title: "安全设置", url: "/settings/security" },
        { title: "紧急按钮", url: "/settings/panic" },
      ],
    },
  ],
  // 底部导航
  navSecondary: [
    {
      title: "帮助中心",
      url: "/help",
      icon: LifeBuoyIcon,
    },
  ],
};

export const GlobalSidebar = ({ children }: GlobalSidebarProperties) => {
  const sidebar = useSidebar();
  const pathname = usePathname();

  // 检查当前路由是否激活
  const isActive = (url: string) => {
    if (url === "/dashboard") {
      return pathname === "/" || pathname === "/dashboard";
    }
    return pathname.startsWith(url);
  };

  return (
    <>
      <Sidebar variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href="/dashboard" className="flex items-center gap-2 px-2 py-1.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary text-white font-bold">
                  Q
                </div>
                {sidebar.open && (
                  <span className="font-semibold text-lg">QuantFi</span>
                )}
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <Search />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>平台</SidebarGroupLabel>
            <SidebarMenu>
              {quantfiNav.navMain.map((item) => (
                <Collapsible
                  asChild
                  defaultOpen={isActive(item.url)}
                  key={item.title}
                >
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={isActive(item.url)}
                    >
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.items?.length ? (
                      <>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuAction className="data-[state=open]:rotate-90">
                            <ChevronRightIcon />
                            <span className="sr-only">Toggle</span>
                          </SidebarMenuAction>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items?.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname === subItem.url}
                                >
                                  <Link href={subItem.url}>
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </>
                    ) : null}
                  </SidebarMenuItem>
                </Collapsible>
              ))}
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>
                {quantfiNav.navSecondary.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center gap-2">
              <UserButton
                appearance={{
                  elements: {
                    rootBox: "flex overflow-hidden w-full",
                    userButtonBox: "flex-row-reverse",
                    userButtonOuterIdentifier: "truncate pl-0",
                  },
                }}
                showName
              />
              <div className="flex shrink-0 items-center gap-px">
                <ModeToggle />
                <Button
                  asChild
                  className="shrink-0"
                  size="icon"
                  variant="ghost"
                >
                  <div className="h-4 w-4">
                    <NotificationsTrigger />
                  </div>
                </Button>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </>
  );
};
