# EMS.Web - Employee Management System Documentation

## 1. Introduction
EMS.Web is a comprehensive Employee Management System designed to streamline HR processes, automate administrative tasks, and provide employees with a self-service portal. The system centralizes all employee data, attendance, payroll, and performance metrics into a single, secure platform.

## 2. Technology Stack
The system is built using modern web technologies to ensure scalability, security, and performance.

*   **Framework:** ASP.NET Core 10.0 (MVC Architecture)
*   **Backend Language:** C# (C-Sharp)
*   **Frontend Engine:** Razor Views (CSHTML)
*   **Styling:** Custom CSS with a professional corporate theme.
*   **Icons:** Font Awesome for a modern and intuitive UI.
*   **Middleware:** Standard ASP.NET Core Authentication and Authorization.

## 3. Controllers & Architecture
The system follows the **Model-View-Controller (MVC)** design pattern. Each controller is built to handle a specific domain of the system:

1.  **AccountsController:** Handles user authentication, login, and access control.
2.  **EmployeesController:** Manages the core database of employees (Hire, Edit, Terminate).
3.  **MyPortalController:** A dedicated area for employees to manage their own data without accessing administrative tools.
4.  **AttendanceController:** Tracks daily clock-in/out logs and calculates work hours.
5.  **LeaveController:** Manages the workflow for leave applications and approvals.
6.  **PayrollController:** Handles salary calculations, taxes, and payslip generation.
7.  **PromotionsController:** Tracks career progression and designation changes.
8.  **PenaltiesController:** Records disciplinary actions and deductions.
9.  **AnnouncementsController:** Allows HR to broadcast news across the company.
10. **SettingsController:** The "Engine Room" of the system where all configurations (Departments, Shifts, etc.) are managed.
11. **AuditLogController:** Keeps a history of every major action for security auditing.
12. **DashboardController:** Provides a visual summary of KPIs (Key Performance Indicators).
13. **HomeController:** Manages landing pages and public-facing content.

## 4. Role-Based Functionality

### A. Admin (Super User)
The Admin has full control over the system's infrastructure.
*   **System Configuration:** Defining Departments, Designations, and Work Locations.
*   **Policy Management:** Setting up Leave Policies and Salary Components.
*   **Security:** Monitoring Audit Logs to see who changed what and when.
*   **Master Data:** Managing Global Holidays and Employee Types.

### B. HR (Human Resources)
HR focuses on managing the workforce and operations.
*   **Recruitment:** Adding new employees and managing their profiles.
*   **Attendance & Leaves:** Monitoring staff presence and approving time-off requests.
*   **Financials:** Processing monthly payroll and ensuring tax compliance.
*   **Communication:** Posting announcements and updates for the whole company.
*   **Growth:** Managing promotions and career paths.

### C. Employee (Self-Service)
Employees use the "My Portal" section to manage their personal work-life.
*   **Dashboard:** View personal attendance summary and upcoming holidays.
*   **Attendance:** Check personal clock-in/out records.
*   **Financials:** View and download monthly payslips.
*   **Leave Requests:** Apply for leaves and track approval status.
*   **Profile:** Keep personal information up to date.
*   **Directory:** Find and contact colleagues within the organization.
