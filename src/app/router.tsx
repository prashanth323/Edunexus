import { createBrowserRouter, Outlet } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { AuthGuard } from "@/features/auth/components/AuthGuard"
import { RequireRole } from "@/features/auth/components/RequireRole"
import { LoginPage } from "@/features/auth/pages/LoginPage"
import { CompleteProfilePage } from "@/features/auth/pages/CompleteProfilePage"
import { DashboardRouter } from "@/features/dashboard/DashboardRouter"
import { StudentsList } from "@/features/students/pages/StudentsList"
import { AttendanceMarking } from "@/features/attendance/pages/AttendanceMarking"
import { FinanceRouter } from "@/features/finance/pages/FinanceRouter"
import { CrmPipeline } from "@/features/crm/pages/CrmPipeline"
import { LmsLayout } from "@/features/lms/layout/LmsLayout"
import { LmsCourseCreatePage } from "@/features/lms/pages/LmsCourseCreatePage"
import { LmsCourseEditPage } from "@/features/lms/pages/LmsCourseEditPage"
import { LmsCoursePlayerPage } from "@/features/lms/pages/LmsCoursePlayerPage"
import { LmsDashboard } from "@/features/lms/pages/LmsDashboard"
import { StaffDirectory } from "@/features/staff/pages/StaffDirectory"
import { NoticesBoard } from "@/features/notices/pages/NoticesBoard"
import { TransportOverview } from "@/features/transport/pages/TransportOverview"
import { HostelOverview } from "@/features/hostel/pages/HostelOverview"
import { SettingsPage } from "@/features/settings/pages/SettingsPage"
import { PlatformInsightsList } from "@/features/dashboard/pages/PlatformInsightsList"
import { SchoolInsightsDetail } from "@/features/dashboard/pages/SchoolInsightsDetail"
import { AnnouncementsPage } from "@/features/dashboard/pages/AnnouncementsPage"
import { TimetableRouter } from "@/features/timetable/pages/TimetableRouter"
import { RootError } from "@/components/common/RootError"

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <RootError />,
  },
  {
    path: "/",
    element: (
      <AuthGuard>
        <Outlet />
      </AuthGuard>
    ),
    errorElement: <RootError />,
    children: [
      {
        path: "complete-profile",
        element: <CompleteProfilePage />,
      },
      {
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <DashboardRouter />,
          },
          {
            path: "students",
            element: (
              <RequireRole>
                <StudentsList />
              </RequireRole>
            ),
          },
          {
            path: "attendance",
            element: (
              <RequireRole>
                <AttendanceMarking />
              </RequireRole>
            ),
          },
          {
            path: "/timetable",
            element: (
              <RequireRole>
                <TimetableRouter />
              </RequireRole>
            ),
          },
          {
            path: "finance",
            element: (
              <RequireRole>
                <FinanceRouter />
              </RequireRole>
            ),
          },
          {
            path: "crm",
            element: (
              <RequireRole>
                <CrmPipeline />
              </RequireRole>
            ),
          },
          {
            path: "lms",
            element: (
              <RequireRole>
                <LmsLayout />
              </RequireRole>
            ),
            children: [
              {
                index: true,
                element: <LmsDashboard />,
              },
              {
                path: "courses/create",
                element: <LmsCourseCreatePage />,
              },
              {
                path: "courses/:courseId",
                element: <LmsCoursePlayerPage />,
              },
              {
                path: "courses/:courseId/edit",
                element: <LmsCourseEditPage />,
              },
            ],
          },
          {
            path: "staff",
            element: (
              <RequireRole>
                <StaffDirectory />
              </RequireRole>
            ),
          },
          {
            path: "notices",
            element: (
              <RequireRole>
                <NoticesBoard />
              </RequireRole>
            ),
          },
          {
            path: "transport",
            element: (
              <RequireRole>
                <TransportOverview />
              </RequireRole>
            ),
          },
          {
            path: "hostel",
            element: (
              <RequireRole>
                <HostelOverview />
              </RequireRole>
            ),
          },
          {
            path: "settings",
            element: (
              <RequireRole>
                <SettingsPage />
              </RequireRole>
            ),
          },
          {
            path: "announcements",
            element: (
              <RequireRole>
                <AnnouncementsPage />
              </RequireRole>
            ),
          },
          {
            path: "insights",
            element: (
              <RequireRole>
                <PlatformInsightsList />
              </RequireRole>
            ),
          },
          {
            path: "insights/:schoolId",
            element: (
              <RequireRole>
                <SchoolInsightsDetail />
              </RequireRole>
            ),
          },
          {
            path: "*",
            element: <RootError />,
          },
        ],
      },
    ],
  },
])
