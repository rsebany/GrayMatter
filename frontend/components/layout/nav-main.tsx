"use client";

import type React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  Upload,
  Shield,
  UserCog,
} from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useRole } from "@/hooks/app";
import type { AppSidebarPage } from "@/api/domain";

type NavItem = {
  id: AppSidebarPage;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAdmin?: boolean;
  requiresSystemAdmin?: boolean;
  requiredPermissions?: string[];
};

type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
  requiredAnyPermissions?: string[];
};

const navSections: NavSection[] = [
  {
    id: "main",
    label: "Workspace",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        id: "patients",
        label: "Patients",
        href: "/patients",
        icon: Users,
      },
      {
        id: "studies",
        label: "Studies",
        href: "/studies",
        icon: FolderOpen,
      },
    ],
  },
  {
    id: "imaging",
    label: "Imaging & visualization",
    items: [
      {
        id: "upload_dicom",
        label: "Upload MRI",
        href: "/upload-dicom",
        icon: Upload,
      },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    items: [
      {
        id: "admin_dashboard",
        label: "Admin Dashboard",
        href: "/dashboard/admin",
        icon: Shield,
        requiresSystemAdmin: true,
      },
      {
        id: "admin_users",
        label: "Manage Users",
        href: "/admin/users",
        icon: UserCog,
        requiresSystemAdmin: true,
      },
    ],
  },
];

type NavMainProps = {
  activePage: AppSidebarPage;
};

export function NavMain({ activePage }: NavMainProps) {
  const { can, isAdmin, isSystemAdmin } = useRole();

  const visibleSections = navSections
    .map((section) => {
      if (section.id === "admin" && !isSystemAdmin) {
        return null;
      }

      if (
        section.requiredAnyPermissions &&
        !section.requiredAnyPermissions.some((perm) => can(perm))
      ) {
        return null;
      }

      const items = section.items.filter((item) => {
        if (item.requiresSystemAdmin && !isSystemAdmin) {
          return false;
        }

        if (item.requiresAdmin && !isAdmin) {
          return false;
        }

        if (
          item.requiredPermissions &&
          !item.requiredPermissions.some((perm) => can(perm))
        ) {
          return false;
        }

        return true;
      });

      if (items.length === 0) {
        return null;
      }

      return { ...section, items };
    })
    .filter((section): section is NonNullable<typeof section> => !!section);

  return (
    <>
      {visibleSections.map((section) => (
        <SidebarGroup key={section.id}>
          <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
          <SidebarMenu>
            {section.items.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton asChild isActive={activePage === item.id}>
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  );
}

