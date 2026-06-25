import { createBrowserRouter, Outlet } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { AuthGuard } from "@/features/auth/components/AuthGuard"
import { RequireRole } from "@/features/auth/components/RequireRole"
import { LoginPage } from "@/features/auth/pages/LoginPage"
import { CompleteProfilePage } from "@/features/auth/pages/CompleteProfilePage"
import { DashboardRouter } from "@/features/dashboard/DashboardRouter"
import { StudentsList } from "@/features/students/pages/StudentsList"
import { StudentProfile } from "@/features/students/pages/StudentProfile"
import { MyStudentProfile } from "@/features/students/pages/MyStudentProfile"
import { StudentIdCardPage } from "@/features/students/pages/StudentIdCardPage"
import { ExamManagement } from "@/features/exams/pages/ExamManagement"
import { MarksEntry } from "@/features/exams/pages/MarksEntry"
import { ExamResults } from "@/features/exams/pages/ExamResults"
import { FeeStructureManager } from "@/features/finance/pages/FeeStructureManager"
import { PendingDuesReport } from "@/features/finance/pages/PendingDuesReport"
import { ClassFeePlanEditor } from "@/features/finance/pages/ClassFeePlanEditor"
import { FeePlanApprovals } from "@/features/finance/pages/FeePlanApprovals"
import { FeeDuesWorkspace } from "@/features/finance/pages/FeeDuesWorkspace"
import { AttendanceMarking } from "@/features/attendance/pages/AttendanceMarking"
import { FinanceRouter } from "@/features/finance/pages/FinanceRouter"
import { CrmPipeline } from "@/features/crm/pages/CrmPipeline"
import { AdmissionsWorkspace } from "@/features/admissions/pages/AdmissionsWorkspace"
import { LmsLayout } from "@/features/lms/layout/LmsLayout"
import { LmsCourseCreatePage } from "@/features/lms/pages/LmsCourseCreatePage"
import { LmsCourseEditPage } from "@/features/lms/pages/LmsCourseEditPage"
import { LmsCoursePlayerPage } from "@/features/lms/pages/LmsCoursePlayerPage"
import { LmsDashboard } from "@/features/lms/pages/LmsDashboard"
import { HomeworkDashboard } from "@/features/homework/pages/HomeworkDashboard"
import { StaffDirectory } from "@/features/staff/pages/StaffDirectory"
import { StaffProfileEdit } from "@/features/staff/pages/StaffProfileEdit"
import { VpClassesOverview } from "@/features/classes/pages/VpClassesOverview"
import { NoticesBoard } from "@/features/notices/pages/NoticesBoard"
import { TransportRouter } from "@/features/transport/pages/TransportRouter"
import { HostelRouter } from "@/features/hostel/pages/HostelRouter"
import { SettingsPage } from "@/features/settings/pages/SettingsPage"
import { PlatformInsightsList } from "@/features/dashboard/pages/PlatformInsightsList"
import { SchoolInsightsDetail } from "@/features/dashboard/pages/SchoolInsightsDetail"
import { AnnouncementsPage } from "@/features/dashboard/pages/AnnouncementsPage"
import { TimetableRouter } from "@/features/timetable/pages/TimetableRouter"
import { MessagesRouter } from "@/features/messages/pages/MessagesRouter"
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
            path: "students/:studentId",
            element: (
              <RequireRole>
                <StudentProfile />
              </RequireRole>
            ),
          },
          {
            path: "my-profile",
            element: (
              <RequireRole>
                <MyStudentProfile />
              </RequireRole>
            ),
          },
          {
            path: "my-profile/:studentId",
            element: (
              <RequireRole>
                <MyStudentProfile />
              </RequireRole>
            ),
          },
          {
            path: "exams",
            element: (
              <RequireRole>
                <ExamManagement />
              </RequireRole>
            ),
          },
          {
            path: "exams/:examId/marks",
            element: (
              <RequireRole>
                <MarksEntry />
              </RequireRole>
            ),
          },
          {
            path: "exams/:examId/results",
            element: (
              <RequireRole>
                <ExamResults />
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
            path: "finance/fee-structures",
            element: (
              <RequireRole>
                <FeeStructureManager />
              </RequireRole>
            ),
          },
          {
            path: "finance/pending-dues",
            element: (
              <RequireRole>
                <PendingDuesReport />
              </RequireRole>
            ),
          },
          {
            path: "finance/fee-plans",
            element: (
              <RequireRole>
                <ClassFeePlanEditor />
              </RequireRole>
            ),
          },
          {
            path: "finance/fee-approvals",
            element: (
              <RequireRole>
                <FeePlanApprovals />
              </RequireRole>
            ),
          },
          {
            path: "finance/dues",
            element: (
              <RequireRole>
                <FeeDuesWorkspace />
              </RequireRole>
            ),
          },
          {
            path: "admissions",
            element: (
              <RequireRole>
                <AdmissionsWorkspace />
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
            path: "homework",
            element: (
              <RequireRole>
                <HomeworkDashboard />
              </RequireRole>
            ),
          },
          {
            path: "student-id-card",
            element: (
              <RequireRole>
                <StudentIdCardPage />
              </RequireRole>
            ),
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
            path: "staff/:staffId/edit",
            element: (
              <RequireRole>
                <StaffProfileEdit />
              </RequireRole>
            ),
          },
          {
            path: "classes",
            element: (
              <RequireRole>
                <VpClassesOverview />
              </RequireRole>
            ),
          },
          {
            path: "messages",
            element: (
              <RequireRole>
                <MessagesRouter />
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
                <TransportRouter />
              </RequireRole>
            ),
          },
          {
            path: "hostel",
            element: (
              <RequireRole>
                <HostelRouter />
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
