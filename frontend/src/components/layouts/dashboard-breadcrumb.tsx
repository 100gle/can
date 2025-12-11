import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useAccountsStore } from "@/state/accounts";
import { Link, useLocation, useParams } from "@tanstack/react-router";
import { Fragment, useMemo } from "react";
import { useTranslation } from "react-i18next";

type BreadcrumbItem = { label: string; to: string };
type BreadcrumbResult = { items: BreadcrumbItem[]; isSubPage: boolean };

export const useDashboardBreadcrumbs = (): BreadcrumbResult => {
  const { t } = useTranslation("common");
  const params = useParams({ strict: false });
  const location = useLocation();
  const activeAccountId = useAccountsStore((state) => state.activeAccountId);
  const accounts = useAccountsStore((state) => state.accounts);

  return useMemo(() => {
    const items: BreadcrumbItem[] = [{ label: t("nav.home"), to: "/" }];

    // Handle Settings Page
    if (location.pathname === "/settings") {
      // If we have an active account, insert it as the parent
      if (activeAccountId) {
        const account = accounts.find((a) => a.id === activeAccountId);
        const label = account ? account.name : activeAccountId;
        items.push({ label, to: `/accounts/${activeAccountId}/dashboard` });
      }
      items.push({ label: t("settings"), to: "/settings" });
      return { items, isSubPage: true };
    }

    const accountId = (params as any).accountId;
    if (accountId) {
      const account = accounts.find((a) => a.id === accountId);
      const label = account ? account.name : accountId;
      items.push({ label, to: `/accounts/${accountId}/dashboard` });
    }

    // Check if this is a sub-page (not the dashboard root)
    const isDashboardRoot = location.pathname.endsWith("/dashboard");
    const isHomePage = location.pathname === "/";

    if (location.pathname.includes("/transfers")) {
      items.push({ label: t("nav.transfers"), to: location.pathname });
      return { items, isSubPage: true };
    } else if (location.pathname.includes("/search")) {
      items.push({ label: t("nav.search"), to: location.pathname });
      return { items, isSubPage: true };
    } else if (location.pathname.includes("/buckets/")) {
      const bucketId = (params as any).bucketId;
      if (bucketId) {
        // If we are at settings, we want: Account > Bucket > Settings
        items.push({ label: bucketId, to: `/accounts/${accountId}/dashboard?bucket=${bucketId}` });

        if (location.pathname.includes("/settings")) {
          items.push({ label: t("settings"), to: location.pathname });
        }
      }
      return { items, isSubPage: true };
    }

    // Dashboard root or home page: not a sub-page
    return { items, isSubPage: !isDashboardRoot && !isHomePage };
  }, [location.pathname, params, accounts, activeAccountId, t]);
};

export const DashboardBreadcrumb = () => {
  const { items: breadcrumbs } = useDashboardBreadcrumbs();

  return (
    <Breadcrumb className="hidden md:flex">
      <BreadcrumbList>
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <Fragment key={item.to + index}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={item.to}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
